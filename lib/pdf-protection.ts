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
  existsSync,
} from "node:fs";

import {
  isAbsolute,
  join,
  resolve,
} from "node:path";

import {
  randomBytes,
} from "node:crypto";


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


  if (
    !configuredPath
  ) {
    return join(
      process.cwd(),
      "data",
      "protected"
    );
  }


  if (
    isAbsolute(
      configuredPath
    )
  ) {
    return configuredPath;
  }


  return resolve(
    process.cwd(),
    configuredPath
  );
}


async function ensureProtectedDir(): Promise<string> {
  const protectedDirectory =
    getProtectedPdfDirectory();


  await mkdir(
    protectedDirectory,
    {
      recursive: true,
    }
  );


  return protectedDirectory;
}


/**
 * Validação de CPF.
 */
export function validateCpf(
  cpf: string
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


  let sum = 0;


  for (
    let index = 0;
    index < 9;
    index += 1
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
    check1 === 10
  ) {
    check1 = 0;
  }


  if (
    check1 !==
    Number(
      cleanCpf[9]
    )
  ) {
    return false;
  }


  sum = 0;


  for (
    let index = 0;
    index < 10;
    index += 1
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
    check2 === 10
  ) {
    check2 = 0;
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
  cpf: string
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
  ].join("");
}


/**
 * Insere identificação do comprador em todas
 * as páginas do PDF.
 */
export async function addWatermarkToPdf(
  pdfBytes: Uint8Array,
  cpf: string
): Promise<Uint8Array> {
  const pdfDoc =
    await PDFDocument.load(
      pdfBytes
    );


  const pages =
    pdfDoc.getPages();


  const font =
    await pdfDoc.embedFont(
      StandardFonts.HelveticaBold
    );


  const formattedCpf =
    formatCpf(
      cpf
    );


  for (
    const page of pages
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
        x: 40,
        y: 20,
        size: 8,
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
 * pdf-lib ainda não fornece criptografia de senha
 * nativamente.
 *
 * A etapa futura de segurança utilizará uma ferramenta
 * apropriada para criptografia real.
 */
export async function protectPdfWithPassword(
  pdfBytes: Uint8Array,
  password: string
): Promise<Uint8Array> {
  void password;


  return pdfBytes;
}


export async function generateProtectedPdf(
  originalPdfPath: string,
  userCpf: string,
  userId: number
): Promise<{
  protectedPath: string;
  downloadToken: string;
  expiresAt: Date;
}> {
  const protectedDirectory =
    await ensureProtectedDir();


  let pdfBytes:
    Uint8Array;


  try {
    const buffer =
      await readFile(
        originalPdfPath
      );


    pdfBytes =
      new Uint8Array(
        buffer
      );
  } catch {
    /**
     * Compatibilidade temporária da implementação atual.
     *
     * Em uma etapa de endurecimento para produção,
     * arquivo ausente deverá falhar em vez de gerar
     * documento substituto.
     */
    const pdfDoc =
      await PDFDocument.create();


    const page =
      pdfDoc.addPage([
        595,
        842,
      ]);


    const font =
      await pdfDoc.embedFont(
        StandardFonts.Helvetica
      );


    page.drawText(
      "Facil Digital+ - Material de Estudo",
      {
        x: 50,
        y: 750,
        size: 24,
        font,
      }
    );


    page.drawText(
      "Este é um PDF de exemplo gerado para testes.",
      {
        x: 50,
        y: 700,
        size: 14,
        font,
      }
    );


    page.drawText(
      "Em produção, este será o conteúdo real da apostila.",
      {
        x: 50,
        y: 670,
        size: 12,
        font,
      }
    );


    pdfBytes =
      await pdfDoc.save();
  }


  const watermarkedPdf =
    await addWatermarkToPdf(
      pdfBytes,
      userCpf
    );


  const protectedPdf =
    await protectPdfWithPassword(
      watermarkedPdf,
      userCpf
    );


  const downloadToken =
    randomBytes(
      32
    ).toString(
      "hex"
    );


  const fileName =
    [
      "protected",
      userId,
      Date.now(),
      downloadToken.slice(
        0,
        8
      ),
    ].join("_") +
    ".pdf";


  const protectedPath =
    join(
      protectedDirectory,
      fileName
    );


  await writeFile(
    protectedPath,
    protectedPdf
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


export async function cleanupExpiredPdfs(): Promise<number> {
  const protectedDirectory =
    await ensureProtectedDir();


  let removed = 0;


  try {
    const files =
      await readdir(
        protectedDirectory
      );


    const now =
      Date.now();


    for (
      const file of files
    ) {
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


          removed += 1;
        }
      } catch {
        /**
         * Arquivo pode ter sido removido entre
         * readdir() e stat().
         */
      }
    }
  } catch {
    return removed;
  }


  return removed;
}


export async function getProtectedPdfByToken(
  downloadToken: string
): Promise<{
  filePath: string;
  buffer: Buffer;
} | null> {
  try {
    const protectedDirectory =
      await ensureProtectedDir();


    const files =
      await readdir(
        protectedDirectory
      );


    const targetFile =
      files.find(
        (
          file
        ) =>
          file.includes(
            downloadToken.slice(
              0,
              8
            )
          )
      );


    if (
      !targetFile
    ) {
      return null;
    }


    const filePath =
      join(
        protectedDirectory,
        targetFile
      );


    if (
      !existsSync(
        filePath
      )
    ) {
      return null;
    }


    const buffer =
      await readFile(
        filePath
      );


    return {
      filePath,
      buffer,
    };
  } catch {
    return null;
  }
}