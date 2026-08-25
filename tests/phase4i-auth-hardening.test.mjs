import {
  after,
  before,
  describe,
  test,
} from "node:test";

import assert from "node:assert/strict";

import {
  createHash,
  randomBytes,
} from "node:crypto";

import {
  readFile,
} from "node:fs/promises";

import {
  join,
} from "node:path";

import {
  createIsolatedDatabase,
} from "./helpers/isolated-database.mjs";


const LEGACY_SALT =
  "facildigitalmais_salt_2026";


function legacyPasswordHash(
  password
) {
  return createHash(
    "sha256"
  )
    .update(
      password +
      LEGACY_SALT
    )
    .digest(
      "hex"
    );
}


describe(
  "Fase 4.4B.1A - Hardening de autenticação e sessão",
  () => {
    let isolated;

    let db;
    let sqlite;
    let schema;
    let eq;

    let auth;


    before(
      async () => {
        isolated =
          await createIsolatedDatabase();


        schema =
          await import(
            "../db/schema.ts"
          );


        const database =
          await import(
            "../db/index.ts"
          );


        ({
          eq,
        } =
          await import(
            "drizzle-orm"
          ));


        auth =
          await import(
            "../lib/auth.ts"
          );


        db =
          database.getDb();


        sqlite =
          database
            .getSqliteConnection();
      }
    );


    test(
      "novos hashes devem usar scrypt com salt aleatório",
      async () => {
        const password =
          "SenhaSegura123!";


        const first =
          await auth.hashPassword(
            password
          );


        const second =
          await auth.hashPassword(
            password
          );


        assert.match(
          first,
          /^scrypt\$v1\$32768\$8\$1\$/
        );


        assert.match(
          second,
          /^scrypt\$v1\$32768\$8\$1\$/
        );


        assert.notEqual(
          first,
          second,
          "mesma senha deve gerar hashes diferentes por causa do salt aleatório"
        );


        assert.equal(
          await auth.verifyPassword(
            password,
            first
          ),
          true
        );


        assert.equal(
          await auth.verifyPassword(
            "SenhaErrada123!",
            first
          ),
          false
        );
      }
    );


    test(
      "registro deve armazenar somente hash scrypt",
      async () => {
        const user =
          await auth.registerUser(
            "novo-scrypt@teste.local",
            "SenhaNova123!",
            "Usuário Scrypt"
          );


        assert.ok(
          user
        );


        const stored =
          await db
            .select()
            .from(
              schema.users
            )
            .where(
              eq(
                schema.users.id,
                user.id
              )
            )
            .get();


        assert.ok(
          stored
        );


        assert.match(
          stored.passwordHash,
          /^scrypt\$v1\$/
        );


        assert.doesNotMatch(
          stored.passwordHash,
          /^[a-f0-9]{64}$/
        );
      }
    );


    test(
      "login legado deve funcionar e migrar senha automaticamente",
      async () => {
        const password =
          "SenhaLegada123!";


        const user =
          await auth.registerUser(
            "legado@teste.local",
            "SenhaTemporaria123!",
            "Usuário Legado"
          );


        assert.ok(
          user
        );


        await db
          .update(
            schema.users
          )
          .set({
            passwordHash:
              legacyPasswordHash(
                password
              ),
          })
          .where(
            eq(
              schema.users.id,
              user.id
            )
          );


        const before =
          await db
            .select()
            .from(
              schema.users
            )
            .where(
              eq(
                schema.users.id,
                user.id
              )
            )
            .get();


        assert.match(
          before.passwordHash,
          /^[a-f0-9]{64}$/
        );


        const login =
          await auth.authenticateUser(
            user.email,
            password
          );


        assert.ok(
          login
        );


        const after =
          await db
            .select()
            .from(
              schema.users
            )
            .where(
              eq(
                schema.users.id,
                user.id
              )
            )
            .get();


        assert.match(
          after.passwordHash,
          /^scrypt\$v1\$/
        );


        assert.equal(
          await auth.verifyPassword(
            password,
            after.passwordHash
          ),
          true
        );
      }
    );


    test(
      "senha errada não deve migrar hash legado",
      async () => {
        const correctPassword =
          "SenhaLegadaCorreta123!";


        const legacyHash =
          legacyPasswordHash(
            correctPassword
          );


        const user =
          await auth.registerUser(
            "legado-errado@teste.local",
            "SenhaTemporaria123!",
            "Legado Errado"
          );


        assert.ok(
          user
        );


        await db
          .update(
            schema.users
          )
          .set({
            passwordHash:
              legacyHash,
          })
          .where(
            eq(
              schema.users.id,
              user.id
            )
          );


        const login =
          await auth.authenticateUser(
            user.email,
            "SenhaIncorreta123!"
          );


        assert.equal(
          login,
          null
        );


        const stored =
          await db
            .select()
            .from(
              schema.users
            )
            .where(
              eq(
                schema.users.id,
                user.id
              )
            )
            .get();


        assert.equal(
          stored.passwordHash,
          legacyHash
        );
      }
    );


    test(
      "nova sessão não deve armazenar o bearer token bruto",
      async () => {
        const user =
          await auth.registerUser(
            "sessao-protegida@teste.local",
            "SenhaSessao123!",
            "Sessão Protegida"
          );


        assert.ok(
          user
        );


        const login =
          await auth.authenticateUser(
            user.email,
            "SenhaSessao123!"
          );


        assert.ok(
          login
        );


        assert.match(
          login.session.token,
          /^[a-f0-9]{64}$/
        );


        const stored =
          sqlite
            .prepare(`
              SELECT
                token
              FROM sessions
              WHERE user_id = ?
              ORDER BY id DESC
              LIMIT 1
            `)
            .get(
              user.id
            );


        assert.ok(
          stored
        );


        assert.notEqual(
          stored.token,
          login.session.token
        );


        assert.match(
          stored.token,
          /^sha256:[a-f0-9]{64}$/
        );


        const resolved =
          await auth.validateSession(
            login.session.token
          );


        assert.equal(
          resolved?.id,
          user.id
        );
      }
    );


    test(
      "sessão legada deve continuar válida e migrar sem logout",
      async () => {
        const user =
          await auth.registerUser(
            "sessao-legada@teste.local",
            "SenhaSessaoLegada123!",
            "Sessão Legada"
          );


        assert.ok(
          user
        );


        const rawToken =
          randomBytes(
            32
          ).toString(
            "hex"
          );


        const inserted =
          sqlite
            .prepare(`
              INSERT INTO sessions (
                user_id,
                token,
                expires_at
              )
              VALUES (
                ?,
                ?,
                ?
              )
            `)
            .run(
              user.id,
              rawToken,
              new Date(
                Date.now() +
                  60 *
                  60 *
                  1000
              ).toISOString()
            );


        const resolved =
          await auth.validateSession(
            rawToken
          );


        assert.equal(
          resolved?.id,
          user.id
        );


        const migrated =
          sqlite
            .prepare(`
              SELECT token
              FROM sessions
              WHERE id = ?
            `)
            .get(
              Number(
                inserted.lastInsertRowid
              )
            );


        assert.ok(
          migrated
        );


        assert.notEqual(
          migrated.token,
          rawToken
        );


        assert.match(
          migrated.token,
          /^sha256:[a-f0-9]{64}$/
        );


        /**
         * Mesmo cookie continua funcionando
         * depois da migração do banco.
         */
        const secondResolution =
          await auth.validateSession(
            rawToken
          );


        assert.equal(
          secondResolution?.id,
          user.id
        );
      }
    );


    test(
      "logout deve remover sessão armazenada como fingerprint",
      async () => {
        const user =
          await auth.registerUser(
            "logout-hash@teste.local",
            "SenhaLogout123!",
            "Logout Hash"
          );


        const login =
          await auth.authenticateUser(
            user.email,
            "SenhaLogout123!"
          );


        assert.ok(
          login
        );


        const storedBefore =
          sqlite
            .prepare(`
              SELECT
                id,
                token
              FROM sessions
              WHERE user_id = ?
              ORDER BY id DESC
              LIMIT 1
            `)
            .get(
              user.id
            );


        assert.ok(
          storedBefore
        );


        await auth.logoutSession(
          login.session.token
        );


        const storedAfter =
          sqlite
            .prepare(`
              SELECT id
              FROM sessions
              WHERE id = ?
            `)
            .get(
              storedBefore.id
            );


        assert.equal(
          storedAfter,
          undefined
        );


        assert.equal(
          await auth.validateSession(
            login.session.token
          ),
          null
        );
      }
    );


    test(
      "cleanup deve remover sessões anteriores ao instante atual",
      async () => {
        const user =
          await auth.registerUser(
            "cleanup-session@teste.local",
            "SenhaCleanup123!",
            "Cleanup Session"
          );


        const expiredToken =
          randomBytes(
            32
          ).toString(
            "hex"
          );


        const futureToken =
          randomBytes(
            32
          ).toString(
            "hex"
          );


        const expired =
          sqlite
            .prepare(`
              INSERT INTO sessions (
                user_id,
                token,
                expires_at
              )
              VALUES (?, ?, ?)
            `)
            .run(
              user.id,
              expiredToken,
              new Date(
                Date.now() -
                  60_000
              ).toISOString()
            );


        const future =
          sqlite
            .prepare(`
              INSERT INTO sessions (
                user_id,
                token,
                expires_at
              )
              VALUES (?, ?, ?)
            `)
            .run(
              user.id,
              futureToken,
              new Date(
                Date.now() +
                  60_000
              ).toISOString()
            );


        await auth.cleanupExpiredSessions();


        assert.equal(
          sqlite
            .prepare(`
              SELECT id
              FROM sessions
              WHERE id = ?
            `)
            .get(
              Number(
                expired.lastInsertRowid
              )
            ),
          undefined
        );


        assert.ok(
          sqlite
            .prepare(`
              SELECT id
              FROM sessions
              WHERE id = ?
            `)
            .get(
              Number(
                future.lastInsertRowid
              )
            )
        );
      }
    );


    test(
      "seed administrativo não deve conter senha real hard-coded",
      async () => {
        const source =
          await readFile(
            join(
              process.cwd(),
              "db",
              "seed.ts"
            ),
            "utf8"
          );


        assert.match(
          source,
          /ADMIN_SEED_PASSWORD/
        );


        assert.match(
          source,
          /NODE_ENV/
        );


        /**
         * Não deve existir algo equivalente a:
         *
         * const adminPassword = "senha-real";
         */
        assert.doesNotMatch(
          source,
          /const\s+adminPassword\s*=\s*["'][^"']+["']/
        );
      }
    );


    test(
      "script de rotação administrativa deve revogar sessões",
      async () => {
        const source =
          await readFile(
            join(
              process.cwd(),
              "scripts",
              "set-admin-password.ts"
            ),
            "utf8"
          );


        assert.match(
          source,
          /hashPassword/
        );


        assert.match(
          source,
          /DELETE FROM sessions/
        );


        assert.match(
          source,
          /transaction\.immediate\(\)/
        );


        assert.doesNotMatch(
          source,
          /console\.log\([^)]*password/i
        );
      }
    );


    after(
      () => {
        isolated?.cleanup();
      }
    );
  }
);