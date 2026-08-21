import {
  randomUUID,
} from "node:crypto";

import {
  access,
  mkdir,
  readFile,
  unlink,
  writeFile,
} from "node:fs/promises";

import {
  constants as fsConstants,
} from "node:fs";

import {
  extname,
  isAbsolute,
  join,
  resolve,
  sep,
} from "node:path";


export type AdminAssetKind =
  | "cover"
  | "pdf";


export const MAX_COVER_UPLOAD_BYTES =
  8 * 1024 * 1024;


export const MAX_PDF_UPLOAD_BYTES =
  120 * 1024 * 1024;


export const MANAGED_COVER_PREFIX =
  "/api/media/covers/";


export const MANAGED_PDF_PREFIX =
  "managed-pdf:";


const SAFE_MANAGED_FILENAME =
  /^\d+-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(png|jpg|webp|pdf)$/i;


const COVER_MIME_BY_EXTENSION: Record<
  string,
  string
> = {
  ".png":
    "image/png",

  ".jpg":
    "image/jpeg",

  ".jpeg":
    "image/jpeg",

  ".webp":
    "image/webp",
};


const GENERATED_EXTENSION_BY_MIME: Record<
  string,
  string
> = {
  "image/png":
    "png",

  "image/jpeg":
    "jpg",

  "image/webp":
    "webp",
};


export class AdminProductStorageError
  extends Error {
  readonly status:
    number;


  constructor(
    message: string,
    status = 400
  ) {
    super(
      message
    );

    this.name =
      "AdminProductStorageError";

    this.status =
      status;
  }
}


export type StoredAdminAsset = {
  kind:
    AdminAssetKind;

  filename:
    string;

  reference:
    string;

  absolutePath:
    string;

  mimeType:
    string;

  size:
    number;
};


function storageError(
  message: string,
  status = 400
): never {
  throw new AdminProductStorageError(
    message,
    status
  );
}


export function getUploadRootDirectory(): string {
  const configured =
    process.env
      .UPLOAD_ROOT_DIR
      ?.trim();


  if (
    !configured
  ) {
    return join(
      process.cwd(),
      "data",
      "uploads"
    );
  }


  if (
    isAbsolute(
      configured
    )
  ) {
    return resolve(
      configured
    );
  }


  return resolve(
    process.cwd(),
    configured
  );
}


export function getCoverUploadDirectory(): string {
  return join(
    getUploadRootDirectory(),
    "covers"
  );
}


export function getPdfUploadDirectory(): string {
  return join(
    getUploadRootDirectory(),
    "pdfs"
  );
}


function assertSafeManagedFilename(
  filename: string
): void {
  if (
    !SAFE_MANAGED_FILENAME.test(
      filename
    )
  ) {
    storageError(
      "Nome de arquivo inválido."
    );
  }
}


function safeStoragePath(
  directory: string,
  filename: string
): string {
  assertSafeManagedFilename(
    filename
  );


  const base =
    resolve(
      directory
    );


  const candidate =
    resolve(
      directory,
      filename
    );


  if (
    !candidate.startsWith(
      `${base}${sep}`
    )
  ) {
    storageError(
      "Caminho de armazenamento inválido."
    );
  }


  return candidate;
}


function bytesStartWith(
  bytes: Uint8Array,
  signature: number[]
): boolean {
  if (
    bytes.length <
    signature.length
  ) {
    return false;
  }


  return signature.every(
    (
      expected,
      index
    ) =>
      bytes[index] ===
      expected
  );
}


function isPng(
  bytes: Uint8Array
): boolean {
  return bytesStartWith(
    bytes,
    [
      0x89,
      0x50,
      0x4e,
      0x47,
      0x0d,
      0x0a,
      0x1a,
      0x0a,
    ]
  );
}


function isJpeg(
  bytes: Uint8Array
): boolean {
  return bytesStartWith(
    bytes,
    [
      0xff,
      0xd8,
      0xff,
    ]
  );
}


function isWebp(
  bytes: Uint8Array
): boolean {
  if (
    bytes.length <
    12
  ) {
    return false;
  }


  return (
    bytes[0] ===
      0x52 &&
    bytes[1] ===
      0x49 &&
    bytes[2] ===
      0x46 &&
    bytes[3] ===
      0x46 &&
    bytes[8] ===
      0x57 &&
    bytes[9] ===
      0x45 &&
    bytes[10] ===
      0x42 &&
    bytes[11] ===
      0x50
  );
}


function hasPdfSignature(
  bytes: Uint8Array
): boolean {
  const limit =
    Math.min(
      bytes.length,
      1024
    );


  const signature = [
    0x25,
    0x50,
    0x44,
    0x46,
    0x2d,
  ];


  for (
    let index = 0;
    index <=
      limit -
        signature.length;
    index += 1
  ) {
    let matches =
      true;


    for (
      let offset = 0;
      offset <
        signature.length;
      offset += 1
    ) {
      if (
        bytes[
          index +
          offset
        ] !==
        signature[
          offset
        ]
      ) {
        matches =
          false;

        break;
      }
    }


    if (
      matches
    ) {
      return true;
    }
  }


  return false;
}


function validateCoverMagicBytes(
  bytes: Uint8Array,
  mimeType: string
): void {
  const valid =
    mimeType ===
      "image/png"
      ? isPng(
          bytes
        )
      : mimeType ===
          "image/jpeg"
        ? isJpeg(
            bytes
          )
        : mimeType ===
            "image/webp"
          ? isWebp(
              bytes
            )
          : false;


  if (
    !valid
  ) {
    storageError(
      "O conteúdo do arquivo não corresponde ao formato de imagem informado.",
      415
    );
  }
}


async function validateCoverFile(
  file: File
): Promise<{
  bytes: Uint8Array;
  extension: string;
  mimeType: string;
}> {
  if (
    file.size <=
    0
  ) {
    storageError(
      "O arquivo de capa está vazio."
    );
  }


  if (
    file.size >
    MAX_COVER_UPLOAD_BYTES
  ) {
    storageError(
      "A capa excede o limite de 8 MB.",
      413
    );
  }


  const originalExtension =
    extname(
      file.name
    ).toLowerCase();


  const expectedMime =
    COVER_MIME_BY_EXTENSION[
      originalExtension
    ];


  if (
    !expectedMime
  ) {
    storageError(
      "A capa deve ser PNG, JPG/JPEG ou WebP.",
      415
    );
  }


  if (
    file.type !==
    expectedMime
  ) {
    storageError(
      "A extensão da capa não corresponde ao MIME informado.",
      415
    );
  }


  const bytes =
    new Uint8Array(
      await file.arrayBuffer()
    );


  validateCoverMagicBytes(
    bytes,
    expectedMime
  );


  return {
    bytes,

    extension:
      GENERATED_EXTENSION_BY_MIME[
        expectedMime
      ],

    mimeType:
      expectedMime,
  };
}


async function validatePdfFile(
  file: File
): Promise<{
  bytes: Uint8Array;
  extension: "pdf";
  mimeType: "application/pdf";
}> {
  if (
    file.size <=
    0
  ) {
    storageError(
      "O PDF está vazio."
    );
  }


  if (
    file.size >
    MAX_PDF_UPLOAD_BYTES
  ) {
    storageError(
      "O PDF excede o limite de 120 MB.",
      413
    );
  }


  if (
    extname(
      file.name
    ).toLowerCase() !==
    ".pdf"
  ) {
    storageError(
      "O material deve possuir extensão .pdf.",
      415
    );
  }


  if (
    file.type !==
    "application/pdf"
  ) {
    storageError(
      "O MIME do material deve ser application/pdf.",
      415
    );
  }


  const bytes =
    new Uint8Array(
      await file.arrayBuffer()
    );


  if (
    !hasPdfSignature(
      bytes
    )
  ) {
    storageError(
      "O conteúdo enviado não possui uma assinatura PDF válida.",
      415
    );
  }


  return {
    bytes,
    extension:
      "pdf",
    mimeType:
      "application/pdf",
  };
}


export function parseAdminAssetKind(
  value: unknown
): AdminAssetKind {
  if (
    value !==
      "cover" &&
    value !==
      "pdf"
  ) {
    storageError(
      'O campo "kind" deve ser "cover" ou "pdf".'
    );
  }


  return value;
}


export async function storeAdminProductAsset(
  productId: number,
  kind: AdminAssetKind,
  file: File
): Promise<StoredAdminAsset> {
  if (
    !Number.isSafeInteger(
      productId
    ) ||
    productId <=
      0
  ) {
    storageError(
      "ID da apostila inválido."
    );
  }


  const validated =
    kind ===
    "cover"
      ? await validateCoverFile(
          file
        )
      : await validatePdfFile(
          file
        );


  const directory =
    kind ===
    "cover"
      ? getCoverUploadDirectory()
      : getPdfUploadDirectory();


  await mkdir(
    directory,
    {
      recursive:
        true,
    }
  );


  const filename =
    `${productId}-${randomUUID()}.${validated.extension}`;


  const absolutePath =
    safeStoragePath(
      directory,
      filename
    );


  await writeFile(
    absolutePath,
    validated.bytes,
    {
      flag:
        "wx",

      mode:
        0o640,
    }
  );


  const reference =
    kind ===
    "cover"
      ? `${MANAGED_COVER_PREFIX}${filename}`
      : `${MANAGED_PDF_PREFIX}${filename}`;


  return {
    kind,
    filename,
    reference,
    absolutePath,
    mimeType:
      validated.mimeType,
    size:
      validated.bytes.length,
  };
}


export function managedCoverFilenameFromReference(
  reference:
    string | null | undefined
): string | null {
  if (
    !reference?.startsWith(
      MANAGED_COVER_PREFIX
    )
  ) {
    return null;
  }


  const filename =
    reference.slice(
      MANAGED_COVER_PREFIX.length
    );


  if (
    !SAFE_MANAGED_FILENAME.test(
      filename
    ) ||
    !/\.(png|jpg|webp)$/i.test(
      filename
    )
  ) {
    return null;
  }


  return filename;
}


export function managedPdfFilenameFromReference(
  reference:
    string | null | undefined
): string | null {
  if (
    !reference?.startsWith(
      MANAGED_PDF_PREFIX
    )
  ) {
    return null;
  }


  const filename =
    reference.slice(
      MANAGED_PDF_PREFIX.length
    );


  if (
    !SAFE_MANAGED_FILENAME.test(
      filename
    ) ||
    !/\.pdf$/i.test(
      filename
    )
  ) {
    return null;
  }


  return filename;
}


export function resolveManagedCoverPath(
  reference:
    string | null | undefined
): string | null {
  const filename =
    managedCoverFilenameFromReference(
      reference
    );


  if (
    !filename
  ) {
    return null;
  }


  return safeStoragePath(
    getCoverUploadDirectory(),
    filename
  );
}


export function resolveManagedPdfPath(
  reference:
    string | null | undefined
): string | null {
  const filename =
    managedPdfFilenameFromReference(
      reference
    );


  if (
    !filename
  ) {
    return null;
  }


  return safeStoragePath(
    getPdfUploadDirectory(),
    filename
  );
}


export async function removeManagedAssetReference(
  kind: AdminAssetKind,
  reference:
    string | null | undefined
): Promise<boolean> {
  const path =
    kind ===
    "cover"
      ? resolveManagedCoverPath(
          reference
        )
      : resolveManagedPdfPath(
          reference
        );


  if (
    !path
  ) {
    return false;
  }


  try {
    await unlink(
      path
    );

    return true;
  } catch (
    error
  ) {
    if (
      error instanceof
        Error &&
      "code" in
        error &&
      error.code ===
        "ENOENT"
    ) {
      return false;
    }


    throw error;
  }
}


export async function removeStoredAdminAsset(
  asset: StoredAdminAsset
): Promise<void> {
  try {
    await unlink(
      asset.absolutePath
    );
  } catch (
    error
  ) {
    if (
      error instanceof
        Error &&
      "code" in
        error &&
      error.code ===
        "ENOENT"
    ) {
      return;
    }


    throw error;
  }
}


export async function readManagedCoverFile(
  filename: string
): Promise<{
  buffer: Buffer;
  mimeType: string;
} | null> {
  if (
    !SAFE_MANAGED_FILENAME.test(
      filename
    ) ||
    !/\.(png|jpg|webp)$/i.test(
      filename
    )
  ) {
    return null;
  }


  const path =
    safeStoragePath(
      getCoverUploadDirectory(),
      filename
    );


  try {
    await access(
      path,
      fsConstants.R_OK
    );


    const buffer =
      await readFile(
        path
      );


    const extension =
      extname(
        filename
      ).toLowerCase();


    const mimeType =
      extension ===
        ".png"
        ? "image/png"
        : extension ===
            ".webp"
          ? "image/webp"
          : "image/jpeg";


    return {
      buffer,
      mimeType,
    };
  } catch (
    error
  ) {
    if (
      error instanceof
        Error &&
      "code" in
        error &&
      error.code ===
        "ENOENT"
    ) {
      return null;
    }


    throw error;
  }
}