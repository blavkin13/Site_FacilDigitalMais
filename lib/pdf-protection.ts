import {
  PDFDocument,
  rgb,
  degrees,
  StandardFonts,
} from "pdf-lib";

import {
  mkdir,
  readFile,
  readdir,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";

import {
  isAbsolute,
  join,
} from "node:path";

import {
  randomBytes,
} from "node:crypto";


/**
 * Tokens de download são gerados com:
 *
 * randomBytes(32).toString("hex")
 *
 * portanto possuem exatamente 64 caracteres
 * hexadecimais.
 */
const DOWNLOAD_TOKEN_PATTERN =
  /^[a-f0-9]{64}$/;


/**
 * Retorna o diretório utilizado para PDFs protegidos.
 *
 * Desenvolvimento:
 *
 *   data/protected
 *
 * Testes:
 *
 *   PROTECTED_PDF_DIR=/tmp/...
 *
 * Produção:
 *
 *   PROTECTED_PDF_DIR pode apontar para um diretório
 *   persistente fora do código da aplicação.
 */
export function getProtectedPdfDirectory(): string {
  const configuredPath =
    process.env
      .PROTECTED_PDF_DIR
      ?.trim();


  /**
   * Desenvolvimento local.
   *
   * O caminho padrão fica deliberadamente
   * restrito ao diretório data/protected.
   *
   * Isso permite ao file tracer do Next.js
   * compreender que o armazenamento padrão
   * não aponta arbitrariamente para o projeto.
   */
  if (
    !configuredPath
  ) {
    return join(
      process.cwd(),
      "data",
      "protected"
    );
  }


  /**
   * Quando PROTECTED_PDF_DIR estiver configurada,
   * aceitamos somente caminho absoluto.
   *
   * Exemplo de produção:
   *
   * /var/www/facildigitalmais/storage/protected
   *
   * Não resolvemos caminhos relativos
   * dinamicamente a partir do diretório atual,
   * evitando tracing amplo e ambiguidades quando
   * o processo for iniciado pelo PM2.
   */
  if (
    !isAbsolute(
      configuredPath
    )
  ) {
    throw new Error(
      "PROTECTED_PDF_DIR deve ser um caminho absoluto."
    );
  }


  return configuredPath;
}


/**
 * Garante a existência do diretório privado
 * utilizado pelos PDFs temporários.
 */
async function ensureProtectedDir(): Promise<string> {
  const protectedDirectory =
    getProtectedPdfDirectory();


  await mkdir(
    protectedDirectory,
    {
      recursive:
        true,

      /**
       * Em sistemas POSIX:
       *
       * proprietário → leitura/escrita/execução
       * grupo        → leitura/execução
       * outros       → nenhum acesso
       */
      mode:
        0o750,
    }
  );


  return protectedDirectory;
}


/**
 * Resolve o arquivo temporário exclusivamente
 * através do token completo.
 *
 * Não utilizamos:
 *
 * - nome informado pelo cliente;
 * - prefixo do token;
 * - busca parcial em diretório;
 * - concatenação de caminho arbitrária.
 */
function protectedPdfPathFromToken(
  directory:
    string,
  downloadToken:
    string
): string | null {
  const normalizedToken =
    downloadToken
      .trim()
      .toLowerCase();


  if (
    !DOWNLOAD_TOKEN_PATTERN.test(
      normalizedToken
    )
  ) {
    return null;
  }


  return join(
    directory,
    `protected_${normalizedToken}.pdf`
  );
}


/**
 * Identifica erros Node.js que possuem
 * um determinado código.
 */
function isNodeErrorCode(
  error:
    unknown,
  code:
    string
): boolean {
  return (
    error instanceof
      Error &&
    "code" in
      error &&
    error.code ===
      code
  );
}


/**
 * Validação de CPF.
 */
export function validateCpf(
  cpf:
    string
): boolean {
  const cleanCpf =
    cpf.replace(
      /\D/g,
      ""
    );


  if (
    cleanCpf.length !==
    11
  ) {
    return false;
  }


  if (
    /^(\d)\1{10}$/.test(
      cleanCpf
    )
  ) {
    return false;
  }


  let sum =
    0;


  for (
    let index =
      0;
    index <
      9;
    index +=
      1
  ) {
    sum +=
      Number(
        cleanCpf[index]
      ) *
      (
        10 -
        index
      );
  }


  let check1 =
    (
      sum *
      10
    ) %
    11;


  if (
    check1 ===
    10
  ) {
    check1 =
      0;
  }


  if (
    check1 !==
    Number(
      cleanCpf[9]
    )
  ) {
    return false;
  }


  sum =
    0;


  for (
    let index =
      0;
    index <
      10;
    index +=
      1
  ) {
    sum +=
      Number(
        cleanCpf[index]
      ) *
      (
        11 -
        index
      );
  }


  let check2 =
    (
      sum *
      10
    ) %
    11;


  if (
    check2 ===
    10
  ) {
    check2 =
      0;
  }


  if (
    check2 !==
    Number(
      cleanCpf[10]
    )
  ) {
    return false;
  }


  return true;
}


/**
 * 12345678901
 *
 * →
 *
 * 123.456.789-01
 */
export function formatCpf(
  cpf:
    string
): string {
  const clean =
    cpf.replace(
      /\D/g,
      ""
    );


  return [
    clean.slice(
      0,
      3
    ),

    ".",

    clean.slice(
      3,
      6
    ),

    ".",

    clean.slice(
      6,
      9
    ),

    "-",

    clean.slice(
      9
    ),
  ].join(
    ""
  );
}


/**
 * Insere identificação do comprador em todas
 * as páginas do PDF.
 *
 * O watermark atual utiliza o CPF do comprador.
 *
 * Esta proteção não substitui criptografia,
 * DRM ou assinatura digital, mas permite
 * rastreabilidade visual do material entregue.
 */
export async function addWatermarkToPdf(
  pdfBytes:
    Uint8Array,
  cpf:
    string
): Promise<Uint8Array> {
  const pdfDoc =
    await PDFDocument.load(
      pdfBytes
    );


  const pages =
    pdfDoc.getPages();


  const font =
    await pdfDoc.embedFont(
      StandardFonts
        .HelveticaBold
    );


  const formattedCpf =
    formatCpf(
      cpf
    );


  for (
    const page of
      pages
  ) {
    const {
      width,
      height,
    } =
      page.getSize();


    page.drawText(
      `CPF: ${formattedCpf}`,
      {
        x:
          width /
            2 -
          120,

        y:
          height /
          2,

        size:
          32,

        font,

        color:
          rgb(
            0.85,
            0.85,
            0.85
          ),

        rotate:
          degrees(
            45
          ),

        opacity:
          0.35,
      }
    );


    page.drawText(
      `Documento exclusivo - CPF: ${formattedCpf} - Facil Digital+`,
      {
        x:
          40,

        y:
          20,

        size:
          8,

        font,

        color:
          rgb(
            0.6,
            0.6,
            0.6
          ),

        opacity:
          0.8,
      }
    );
  }


  return pdfDoc.save();
}


/**
 * Compatibilidade temporária.
 *
 * pdf-lib não fornece criptografia de senha
 * nativamente.
 *
 * Esta função NÃO deve ser interpretada como
 * proteção real por senha.
 *
 * A criptografia verdadeira poderá ser adicionada
 * posteriormente com qpdf ou ferramenta equivalente
 * no ambiente de produção.
 */
export async function protectPdfWithPassword(
  pdfBytes:
    Uint8Array,
  password:
    string
): Promise<Uint8Array> {
  void password;


  return pdfBytes;
}


/**
 * Gera a versão temporária e identificada
 * de uma apostila.
 *
 * Segurança:
 *
 * - exige CPF válido;
 * - exige userId válido;
 * - original precisa realmente existir;
 * - original precisa ser um PDF estruturalmente válido;
 * - não existe mais PDF fictício de fallback;
 * - token possui 256 bits de entropia;
 * - nome do arquivo depende do token completo;
 * - escrita utiliza "wx", impedindo sobrescrita;
 * - arquivo recebe permissão restritiva em POSIX;
 * - expiração padrão de 12 horas.
 */
export async function generateProtectedPdf(
  originalPdfPath:
    string,
  userCpf:
    string,
  userId:
    number
): Promise<{
  protectedPath:
    string;

  downloadToken:
    string;

  expiresAt:
    Date;
}> {
  /**
   * Defesa em profundidade.
   *
   * A rota HTTP já deve validar o CPF, mas
   * esta função não depende exclusivamente
   * do chamador.
   */
  if (
    !validateCpf(
      userCpf
    )
  ) {
    throw new Error(
      "CPF inválido para geração do PDF protegido."
    );
  }


  if (
    !Number.isSafeInteger(
      userId
    ) ||
    userId <=
      0
  ) {
    throw new Error(
      "Usuário inválido para geração do PDF protegido."
    );
  }


  const protectedDirectory =
    await ensureProtectedDir();


  /**
   * Não existe mais documento substituto.
   *
   * ENOENT, EACCES ou qualquer outra falha
   * de leitura interrompe a operação.
   */
  const buffer =
    await readFile(
      originalPdfPath
    );


  const pdfBytes =
    new Uint8Array(
      buffer
    );


  /**
   * addWatermarkToPdf() executa PDFDocument.load().
   *
   * Assim, um arquivo que apenas contenha uma
   * assinatura "%PDF-" mas esteja estruturalmente
   * corrompido não será entregue.
   */
  const protectedPdf =
    await addWatermarkToPdf(
      pdfBytes,
      userCpf
    );


  /**
   * 32 bytes = 256 bits.
   *
   * Em hexadecimal:
   *
   * 64 caracteres.
   */
  const downloadToken =
    randomBytes(
      32
    ).toString(
      "hex"
    );


  const protectedPath =
    protectedPdfPathFromToken(
      protectedDirectory,
      downloadToken
    );


  if (
    !protectedPath
  ) {
    throw new Error(
      "Falha ao gerar caminho seguro para o download."
    );
  }


  await writeFile(
    protectedPath,
    protectedPdf,
    {
      /**
       * Cria somente se ainda não existir.
       *
       * Mesmo uma colisão extremamente improvável
       * não sobrescreverá um download existente.
       */
      flag:
        "wx",

      mode:
        0o640,
    }
  );


  const expiresAt =
    new Date(
      Date.now() +
        12 *
          60 *
          60 *
          1000
    );


  return {
    protectedPath,
    downloadToken,
    expiresAt,
  };
}


/**
 * Remove arquivos temporários antigos.
 *
 * A limpeza baseada em mtime continua existindo
 * como proteção adicional.
 *
 * A Fase 3E também passa a remover imediatamente
 * arquivos associados a links expirados ou revogados.
 */
export async function cleanupExpiredPdfs(): Promise<number> {
  const protectedDirectory =
    await ensureProtectedDir();


  let removed =
    0;


  try {
    const files =
      await readdir(
        protectedDirectory
      );


    const now =
      Date.now();


    for (
      const file of
        files
    ) {
      /**
       * O diretório é dedicado aos PDFs protegidos.
       *
       * Mantemos compatibilidade com arquivos
       * temporários produzidos por versões anteriores,
       * portanto não restringimos aqui somente ao
       * novo padrão protected_<token>.pdf.
       */
      if (
        !file.endsWith(
          ".pdf"
        )
      ) {
        continue;
      }


      const filePath =
        join(
          protectedDirectory,
          file
        );


      try {
        const fileStats =
          await stat(
            filePath
          );


        if (
          now -
            fileStats.mtimeMs >
          12 *
            60 *
            60 *
            1000
        ) {
          await unlink(
            filePath
          );


          removed +=
            1;
        }
      } catch {
        /**
         * O arquivo pode ter sido removido entre
         * readdir(), stat() e unlink().
         *
         * A limpeza não deve interromper por causa
         * de um arquivo individual.
         */
      }
    }
  } catch {
    return removed;
  }


  return removed;
}


/**
 * Localiza um PDF protegido utilizando
 * exclusivamente o token completo.
 *
 * Diferente da implementação anterior,
 * não existe:
 *
 * files.find(file.includes(token.slice(0, 8)))
 *
 * Isso elimina colisões e correspondência parcial.
 */
export async function getProtectedPdfByToken(
  downloadToken:
    string
): Promise<{
  filePath:
    string;

  buffer:
    Buffer;
} | null> {
  const protectedDirectory =
    await ensureProtectedDir();


  const filePath =
    protectedPdfPathFromToken(
      protectedDirectory,
      downloadToken
    );


  if (
    !filePath
  ) {
    return null;
  }


  try {
    const buffer =
      await readFile(
        filePath
      );


    return {
      filePath,
      buffer,
    };
  } catch (
    error
  ) {
    if (
      isNodeErrorCode(
        error,
        "ENOENT"
      )
    ) {
      return null;
    }


    /**
     * Erros reais de filesystem não são mascarados
     * como "arquivo não encontrado".
     *
     * Isso permite identificar EACCES, EIO etc.
     */
    throw error;
  }
}


/**
 * Remove exatamente o arquivo correspondente
 * ao token informado.
 *
 * Retorna:
 *
 * true  → arquivo existia e foi removido
 * false → token inválido ou arquivo já não existia
 */
export async function removeProtectedPdfByToken(
  downloadToken:
    string
): Promise<boolean> {
  const protectedDirectory =
    await ensureProtectedDir();


  const filePath =
    protectedPdfPathFromToken(
      protectedDirectory,
      downloadToken
    );


  if (
    !filePath
  ) {
    return false;
  }


  try {
    await unlink(
      filePath
    );


    return true;
  } catch (
    error
  ) {
    if (
      isNodeErrorCode(
        error,
        "ENOENT"
      )
    ) {
      return false;
    }


    throw error;
  }
}