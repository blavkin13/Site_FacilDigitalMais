import {
  createHash,
  randomBytes,
  scrypt as cryptoScrypt,
  timingSafeEqual,
} from "node:crypto";

import {
  eq,
  lte,
  or,
} from "drizzle-orm";

import {
  getDb,
} from "../db/index";

import {
  sessions,
  users,
} from "../db/schema";

import type {
  Session,
  User,
} from "../db/schema";


// ==========================================
// CONFIGURAÇÃO DE SENHAS
// ==========================================

const PASSWORD_SCHEME =
  "scrypt";

const PASSWORD_VERSION =
  "v1";

/**
 * Perfil de custo atual.
 *
 * N = 32768
 * r = 8
 * p = 1
 *
 * Aproximadamente 32 MiB de memória por
 * derivação, mantendo um equilíbrio razoável
 * para o VPS sem voltar a utilizar um hash
 * rápido inadequado para senhas.
 */
const SCRYPT_N =
  32768;

const SCRYPT_R =
  8;

const SCRYPT_P =
  1;

const SCRYPT_KEY_LENGTH =
  64;

const SCRYPT_SALT_LENGTH =
  16;

const SCRYPT_MAXMEM =
  128 *
  1024 *
  1024;


/**
 * Salt utilizado SOMENTE para reconhecer hashes
 * históricos.
 *
 * Salt não precisa ser segredo.
 *
 * Novos hashes nunca utilizam esse valor.
 */
const LEGACY_PASSWORD_SALT =
  "facildigitalmais_salt_2026";


/**
 * Formato dos novos hashes:
 *
 * scrypt$v1$32768$8$1$<salt>$<derivedKey>
 */
type ParsedScryptHash = {
  N:
    number;

  r:
    number;

  p:
    number;

  salt:
    Buffer;

  derivedKey:
    Buffer;
};


/**
 * A coluna sessions.token passa a guardar apenas
 * um fingerprint do segredo enviado ao browser.
 *
 * O prefixo é proposital.
 *
 * Tokens históricos eram hex de 64 caracteres.
 * Assim conseguimos distinguir:
 *
 * legado:
 *   0123abcd...
 *
 * novo:
 *   sha256:0123abcd...
 *
 * Isso permite migração transparente sem
 * invalidar cookies existentes.
 */
const SESSION_STORAGE_PREFIX =
  "sha256:";


export const SESSION_TTL_SECONDS =
  7 *
  24 *
  60 *
  60;


export type BrowserSession =
  Omit<
    Session,
    "token"
  > & {
    /**
     * Neste objeto retornado à camada HTTP,
     * token é o segredo bruto que irá apenas
     * para o cookie.
     *
     * O banco nunca recebe esse valor em novas
     * sessões.
     */
    token:
      string;
  };


function deriveScryptKey(
  password:
    string,
  salt:
    Buffer,
  parameters: {
    N:
      number;

    r:
      number;

    p:
      number;
  }
): Promise<Buffer> {
  return new Promise(
    (
      resolve,
      reject
    ) => {
      cryptoScrypt(
        password,
        salt,
        SCRYPT_KEY_LENGTH,
        {
          N:
            parameters.N,

          r:
            parameters.r,

          p:
            parameters.p,

          maxmem:
            SCRYPT_MAXMEM,
        },
        (
          error,
          derivedKey
        ) => {
          if (
            error
          ) {
            reject(
              error
            );

            return;
          }


          resolve(
            Buffer.from(
              derivedKey
            )
          );
        }
      );
    }
  );
}


function legacyHashPassword(
  password:
    string
) {
  return createHash(
    "sha256"
  )
    .update(
      password +
      LEGACY_PASSWORD_SALT
    )
    .digest(
      "hex"
    );
}


function isLegacyPasswordHash(
  value:
    string
) {
  return /^[a-f0-9]{64}$/i.test(
    value
  );
}


function parseScryptHash(
  value:
    string
): ParsedScryptHash | null {
  const parts =
    value.split(
      "$"
    );


  if (
    parts.length !==
    7
  ) {
    return null;
  }


  const [
    scheme,
    version,
    rawN,
    rawR,
    rawP,
    saltHex,
    derivedHex,
  ] =
    parts;


  if (
    scheme !==
      PASSWORD_SCHEME ||
    version !==
      PASSWORD_VERSION
  ) {
    return null;
  }


  const N =
    Number(
      rawN
    );

  const r =
    Number(
      rawR
    );

  const p =
    Number(
      rawP
    );


  /**
   * Não confiamos cegamente nos parâmetros
   * armazenados no banco.
   *
   * Caso alguém adultere o hash colocando um N
   * gigantesco, o login não pode transformar isso
   * em um ataque de exaustão de memória.
   */
  if (
    !Number.isInteger(
      N
    ) ||
    N <
      16384 ||
    N >
      65536 ||
    (
      N &
      (
        N -
        1
      )
    ) !==
      0 ||
    r !==
      8 ||
    p !==
      1
  ) {
    return null;
  }


  if (
    !/^[a-f0-9]+$/i.test(
      saltHex
    ) ||
    saltHex.length %
      2 !==
      0 ||
    !/^[a-f0-9]+$/i.test(
      derivedHex
    ) ||
    derivedHex.length %
      2 !==
      0
  ) {
    return null;
  }


  const salt =
    Buffer.from(
      saltHex,
      "hex"
    );


  const derivedKey =
    Buffer.from(
      derivedHex,
      "hex"
    );


  if (
    salt.length !==
      SCRYPT_SALT_LENGTH ||
    derivedKey.length !==
      SCRYPT_KEY_LENGTH
  ) {
    return null;
  }


  return {
    N,
    r,
    p,
    salt,
    derivedKey,
  };
}


function passwordHashNeedsUpgrade(
  value:
    string
) {
  if (
    isLegacyPasswordHash(
      value
    )
  ) {
    return true;
  }


  const parsed =
    parseScryptHash(
      value
    );


  if (
    !parsed
  ) {
    return true;
  }


  return (
    parsed.N !==
      SCRYPT_N ||
    parsed.r !==
      SCRYPT_R ||
    parsed.p !==
      SCRYPT_P
  );
}


/**
 * Executamos uma derivação artificial quando
 * precisamos manter aproximadamente o mesmo custo
 * computacional de uma tentativa normal de login.
 *
 * Isso reduz diferenças grosseiras de tempo entre:
 *
 * - usuário inexistente;
 * - usuário legado com senha errada;
 * - usuário moderno com senha errada.
 */
async function burnPasswordKdf(
  password:
    string
) {
  const dummySalt =
    createHash(
      "sha256"
    )
      .update(
        "facildigitalmais-auth-dummy-salt"
      )
      .digest()
      .subarray(
        0,
        SCRYPT_SALT_LENGTH
      );


  await deriveScryptKey(
    password,
    dummySalt,
    {
      N:
        SCRYPT_N,

      r:
        SCRYPT_R,

      p:
        SCRYPT_P,
    }
  );
}


// ==========================================
// PASSWORD HASH
// ==========================================

export async function hashPassword(
  password:
    string
): Promise<string> {
  if (
    typeof password !==
      "string" ||
    password.length ===
      0
  ) {
    throw new Error(
      "Senha inválida."
    );
  }


  const salt =
    randomBytes(
      SCRYPT_SALT_LENGTH
    );


  const derivedKey =
    await deriveScryptKey(
      password,
      salt,
      {
        N:
          SCRYPT_N,

        r:
          SCRYPT_R,

        p:
          SCRYPT_P,
      }
    );


  return [
    PASSWORD_SCHEME,
    PASSWORD_VERSION,
    String(
      SCRYPT_N
    ),
    String(
      SCRYPT_R
    ),
    String(
      SCRYPT_P
    ),
    salt.toString(
      "hex"
    ),
    derivedKey.toString(
      "hex"
    ),
  ].join(
    "$"
  );
}


export async function verifyPassword(
  password:
    string,
  storedHash:
    string
): Promise<boolean> {
  if (
    typeof password !==
      "string" ||
    password.length ===
      0 ||
    typeof storedHash !==
      "string" ||
    storedHash.length ===
      0
  ) {
    return false;
  }


  const modernHash =
    parseScryptHash(
      storedHash
    );


  if (
    modernHash
  ) {
    const candidate =
      await deriveScryptKey(
        password,
        modernHash.salt,
        {
          N:
            modernHash.N,

          r:
            modernHash.r,

          p:
            modernHash.p,
        }
      );


    return timingSafeEqual(
      candidate,
      modernHash
        .derivedKey
    );
  }


  /**
   * Compatibilidade temporária com usuários
   * criados antes da Fase 4.4B.
   */
  if (
    isLegacyPasswordHash(
      storedHash
    )
  ) {
    const candidate =
      Buffer.from(
        legacyHashPassword(
          password
        ),
        "hex"
      );


    const expected =
      Buffer.from(
        storedHash,
        "hex"
      );


    return timingSafeEqual(
      candidate,
      expected
    );
  }


  return false;
}


// ==========================================
// SESSION TOKENS
// ==========================================

export function generateSessionToken(): string {
  return randomBytes(
    32
  ).toString(
    "hex"
  );
}


function isValidSessionToken(
  token:
    string
) {
  return /^[a-f0-9]{64}$/.test(
    token
  );
}


function sessionTokenForStorage(
  token:
    string
) {
  return (
    SESSION_STORAGE_PREFIX +
    createHash(
      "sha256"
    )
      .update(
        token
      )
      .digest(
        "hex"
      )
  );
}


async function createUserSession(
  userId:
    number
): Promise<BrowserSession> {
  const db =
    getDb();


  const expiresAt =
    new Date(
      Date.now() +
      SESSION_TTL_SECONDS *
        1000
    );


  /**
   * Colisão de 256 bits é impraticável, mas
   * repetimos algumas vezes caso o SQLite informe
   * conflito no índice UNIQUE.
   */
  for (
    let attempt =
      0;
    attempt <
      3;
    attempt +=
      1
  ) {
    const browserToken =
      generateSessionToken();


    const storedToken =
      sessionTokenForStorage(
        browserToken
      );


    try {
      const result =
        await db
          .insert(
            sessions
          )
          .values({
            userId,

            token:
              storedToken,

            expiresAt:
              expiresAt.toISOString(),
          })
          .returning();


      const storedSession =
        result[0];


      if (
        !storedSession
      ) {
        throw new Error(
          "Falha ao criar sessão."
        );
      }


      return {
        ...storedSession,

        /**
         * Sobrescrevemos apenas o objeto entregue
         * à rota HTTP.
         *
         * O segredo bruto não foi persistido.
         */
        token:
          browserToken,
      };
    } catch (
      error
    ) {
      const message =
        error instanceof
          Error
          ? error.message
          : "";


      if (
        message.includes(
          "sessions.token"
        )
      ) {
        continue;
      }


      throw error;
    }
  }


  throw new Error(
    "Não foi possível gerar uma sessão única."
  );
}


// ==========================================
// REGISTRO
// ==========================================

export async function registerUser(
  email:
    string,
  password:
    string,
  name?:
    string,
  cpf?:
    string,
  phone?:
    string,
  role:
    "user" |
    "admin" =
    "user"
): Promise<User | null> {
  const db =
    getDb();


  const normalizedEmail =
    email
      .toLowerCase()
      .trim();


  if (
    normalizedEmail.length ===
      0 ||
    password.length ===
      0
  ) {
    return null;
  }


  const existingUser =
    await db
      .select()
      .from(
        users
      )
      .where(
        eq(
          users.email,
          normalizedEmail
        )
      )
      .get();


  if (
    existingUser
  ) {
    return null;
  }


  const passwordHash =
    await hashPassword(
      password
    );


  try {
    const result =
      await db
        .insert(
          users
        )
        .values({
          email:
            normalizedEmail,

          passwordHash,

          name,

          cpf,

          phone,

          role,
        })
        .returning();


    return result[0] ||
      null;
  } catch (
    error
  ) {
    /**
     * Proteção também contra duas requisições de
     * cadastro concorrentes para o mesmo e-mail.
     */
    const message =
      error instanceof
        Error
        ? error.message
        : "";


    if (
      message.includes(
        "users.email"
      )
    ) {
      return null;
    }


    throw error;
  }
}


// ==========================================
// LOGIN
// ==========================================

export async function authenticateUser(
  email:
    string,
  password:
    string
): Promise<{
  user:
    User;

  session:
    BrowserSession;
} | null> {
  const db =
    getDb();


  const normalizedEmail =
    email
      .toLowerCase()
      .trim();


  const user =
    await db
      .select()
      .from(
        users
      )
      .where(
        eq(
          users.email,
          normalizedEmail
        )
      )
      .get();


  if (
    !user
  ) {
    /**
     * Evita retorno extremamente mais rápido para
     * e-mails inexistentes.
     */
    await burnPasswordKdf(
      password
    );


    return null;
  }


  const passwordValid =
    await verifyPassword(
      password,
      user.passwordHash
    );


  if (
    !passwordValid
  ) {
    /**
     * Hash legado é muito rápido.
     *
     * Se a senha estiver errada, executamos um
     * scrypt artificial para não preservar uma
     * diferença grosseira de custo.
     */
    if (
      !parseScryptHash(
        user.passwordHash
      )
    ) {
      await burnPasswordKdf(
        password
      );
    }


    return null;
  }


  /**
   * Migração oportunista.
   *
   * Usuário com hash legado entra normalmente.
   * Depois da senha ser confirmada, ela é
   * imediatamente regravada no formato moderno.
   */
  if (
    passwordHashNeedsUpgrade(
      user.passwordHash
    )
  ) {
    const upgradedHash =
      await hashPassword(
        password
      );


    await db
      .update(
        users
      )
      .set({
        passwordHash:
          upgradedHash,

        updatedAt:
          new Date()
            .toISOString(),
      })
      .where(
        eq(
          users.id,
          user.id
        )
      );
  }


  const session =
    await createUserSession(
      user.id
    );


  return {
    user,
    session,
  };
}


// ==========================================
// VALIDAÇÃO DE SESSÃO
// ==========================================

export async function validateSession(
  token:
    string
): Promise<User | null> {
  if (
    typeof token !==
      "string" ||
    !isValidSessionToken(
      token
    )
  ) {
    return null;
  }


  const db =
    getDb();


  const protectedToken =
    sessionTokenForStorage(
      token
    );


  /**
   * Primeiro procuramos o formato seguro.
   */
  let session =
    await db
      .select()
      .from(
        sessions
      )
      .where(
        eq(
          sessions.token,
          protectedToken
        )
      )
      .get();


  let legacyStorage =
    false;


  /**
   * Compatibilidade com sessões criadas antes da
   * 4.4B.
   *
   * O cookie antigo contém exatamente o valor que
   * ainda está salvo no banco.
   */
  if (
    !session
  ) {
    session =
      await db
        .select()
        .from(
          sessions
        )
        .where(
          eq(
            sessions.token,
            token
          )
        )
        .get();


    legacyStorage =
      Boolean(
        session
      );
  }


  if (
    !session
  ) {
    return null;
  }


  const expiration =
    Date.parse(
      session.expiresAt
    );


  if (
    !Number.isFinite(
      expiration
    ) ||
    expiration <=
      Date.now()
  ) {
    await db
      .delete(
        sessions
      )
      .where(
        eq(
          sessions.id,
          session.id
        )
      );


    return null;
  }


  /**
   * Sessões antigas são migradas sem fazer logout
   * do usuário.
   *
   * O browser continua possuindo o mesmo segredo.
   * Somente sua representação dentro do SQLite
   * muda para SHA-256:<fingerprint>.
   */
  if (
    legacyStorage
  ) {
    try {
      await db
        .update(
          sessions
        )
        .set({
          token:
            protectedToken,
        })
        .where(
          eq(
            sessions.id,
            session.id
          )
        );
    } catch {
      /**
       * Situação extremamente anormal, como uma
       * colisão UNIQUE.
       *
       * Falhamos fechado em vez de manter uma
       * sessão ambígua.
       */
      await db
        .delete(
          sessions
        )
        .where(
          eq(
            sessions.id,
            session.id
          )
        );


      return null;
    }
  }


  const user =
    await db
      .select()
      .from(
        users
      )
      .where(
        eq(
          users.id,
          session.userId
        )
      )
      .get();


  return user ||
    null;
}


// ==========================================
// LOGOUT
// ==========================================

export async function logoutSession(
  token:
    string
): Promise<void> {
  if (
    typeof token !==
      "string" ||
    !isValidSessionToken(
      token
    )
  ) {
    return;
  }


  const db =
    getDb();


  const protectedToken =
    sessionTokenForStorage(
      token
    );


  /**
   * Remove tanto uma sessão moderna quanto uma
   * sessão legada ainda não migrada.
   */
  await db
    .delete(
      sessions
    )
    .where(
      or(
        eq(
          sessions.token,
          protectedToken
        ),
        eq(
          sessions.token,
          token
        )
      )
    );
}


// ==========================================
// REVOGAÇÃO ADMINISTRATIVA
// ==========================================

export async function revokeUserSessions(
  userId:
    number
): Promise<void> {
  if (
    !Number.isInteger(
      userId
    ) ||
    userId <=
      0
  ) {
    return;
  }


  const db =
    getDb();


  await db
    .delete(
      sessions
    )
    .where(
      eq(
        sessions.userId,
        userId
      )
    );
}


// ==========================================
// MANUTENÇÃO
// ==========================================

export async function cleanupExpiredSessions(): Promise<void> {
  const db =
    getDb();


  const now =
    new Date()
      .toISOString();


  /**
   * O código anterior utilizava igualdade,
   * removendo apenas uma sessão cujo expires_at
   * fosse exatamente igual ao instante atual.
   *
   * Agora removemos todas as sessões vencidas.
   */
  await db
    .delete(
      sessions
    )
    .where(
      lte(
        sessions.expiresAt,
        now
      )
    );
}