import {
  access,
  readdir,
  stat,
  unlink,
} from "node:fs/promises";

import {
  constants as fsConstants,
} from "node:fs";

import {
  join,
} from "node:path";

import {
  eq,
} from "drizzle-orm";

import {
  getDb,
} from "../db/index";

import {
  products,
  protectedDownloads,
} from "../db/schema";

import type {
  Product as DatabaseProduct,
} from "../db/schema";

import {
  getCoverUploadDirectory,
  getPdfUploadDirectory,
  managedCoverFilenameFromReference,
  managedPdfFilenameFromReference,
  MANAGED_COVER_PREFIX,
  MANAGED_PDF_PREFIX,
  resolveManagedCoverPath,
  resolveManagedPdfPath,
} from "./admin-product-storage";

import {
  getProtectedPdfDirectory,
  removeProtectedPdfByToken,
} from "./pdf-protection";

import type {
  ProductPublicationIssue,
} from "./product-publication";


const DEFAULT_ORPHAN_GRACE_MS =
  15 *
  60 *
  1000;


const PROTECTED_FILE_PATTERN =
  /^protected_([a-f0-9]{64})\.pdf$/;


type ProductAssetFields =
  Pick<
    DatabaseProduct,
    | "cover"
    | "pdfPath"
  >;


export type ManagedStorageMaintenanceOptions = {
  apply?:
    boolean;

  now?:
    Date;

  orphanGraceMs?:
    number;
};


export type ManagedStorageMaintenanceReport = {
  apply:
    boolean;

  brokenReferences: Array<{
    productId:
      number;

    field:
      "cover" | "pdfPath";

    reference:
      string;

    message:
      string;
  }>;

  managedAssets: {
    coverOrphans:
      string[];

    pdfOrphans:
      string[];

    removedCoverOrphans:
      number;

    removedPdfOrphans:
      number;
  };

  protectedDownloads: {
    expiredRecords:
      number[];

    invalidExpiryRecords:
      number[];

    orphanFiles:
      string[];

    removedRecords:
      number;

    removedFiles:
      number;

    removedOrphanFiles:
      number;
  };
};


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


async function readableRegularFile(
  path:
    string
): Promise<boolean> {
  try {
    await access(
      path,
      fsConstants.R_OK
    );


    const fileStat =
      await stat(
        path
      );


    return fileStat
      .isFile();
  } catch (
    error
  ) {
    if (
      isNodeErrorCode(
        error,
        "ENOENT"
      ) ||
      isNodeErrorCode(
        error,
        "EACCES"
      )
    ) {
      return false;
    }


    throw error;
  }
}


async function readDirectorySafely(
  directory:
    string
) {
  try {
    return await readdir(
      directory,
      {
        withFileTypes:
          true,
      }
    );
  } catch (
    error
  ) {
    if (
      isNodeErrorCode(
        error,
        "ENOENT"
      )
    ) {
      return [];
    }


    throw error;
  }
}


async function fileOldEnough(
  path:
    string,
  nowMs:
    number,
  graceMs:
    number
): Promise<boolean> {
  try {
    const fileStat =
      await stat(
        path
      );


    return (
      nowMs -
        fileStat.mtimeMs >=
      graceMs
    );
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


export async function getManagedProductAssetIntegrityIssues(
  product:
    ProductAssetFields
): Promise<ProductPublicationIssue[]> {
  const issues:
    ProductPublicationIssue[] =
    [];


  if (
    product.cover
      ?.startsWith(
        MANAGED_COVER_PREFIX
      )
  ) {
    const filename =
      managedCoverFilenameFromReference(
        product.cover
      );


    const path =
      resolveManagedCoverPath(
        product.cover
      );


    if (
      !filename ||
      !path ||
      !await readableRegularFile(
        path
      )
    ) {
      issues.push({
        field:
          "cover",

        message:
          "A capa cadastrada não existe ou não está acessível no armazenamento.",
      });
    }
  }


  if (
    product.pdfPath
      ?.startsWith(
        MANAGED_PDF_PREFIX
      )
  ) {
    const filename =
      managedPdfFilenameFromReference(
        product.pdfPath
      );


    const path =
      resolveManagedPdfPath(
        product.pdfPath
      );


    if (
      !filename ||
      !path ||
      !await readableRegularFile(
        path
      )
    ) {
      issues.push({
        field:
          "pdfPath",

        message:
          "O PDF cadastrado não existe ou não está acessível no armazenamento privado.",
      });
    }
  }


  return issues;
}


async function collectManagedOrphans({
  referencedCoverFiles,
  referencedPdfFiles,
  nowMs,
  graceMs,
}: {
  referencedCoverFiles:
    Set<string>;

  referencedPdfFiles:
    Set<string>;

  nowMs:
    number;

  graceMs:
    number;
}) {
  const coverDirectory =
    getCoverUploadDirectory();


  const pdfDirectory =
    getPdfUploadDirectory();


  const coverEntries =
    await readDirectorySafely(
      coverDirectory
    );


  const pdfEntries =
    await readDirectorySafely(
      pdfDirectory
    );


  const coverOrphans:
    string[] =
    [];


  const pdfOrphans:
    string[] =
    [];


  for (
    const entry of
      coverEntries
  ) {
    if (
      !entry.isFile()
    ) {
      continue;
    }


    const validFilename =
      managedCoverFilenameFromReference(
        `${MANAGED_COVER_PREFIX}${entry.name}`
      );


    if (
      !validFilename ||
      referencedCoverFiles.has(
        validFilename
      )
    ) {
      continue;
    }


    const path =
      join(
        coverDirectory,
        validFilename
      );


    if (
      await fileOldEnough(
        path,
        nowMs,
        graceMs
      )
    ) {
      coverOrphans.push(
        validFilename
      );
    }
  }


  for (
    const entry of
      pdfEntries
  ) {
    if (
      !entry.isFile()
    ) {
      continue;
    }


    const validFilename =
      managedPdfFilenameFromReference(
        `${MANAGED_PDF_PREFIX}${entry.name}`
      );


    if (
      !validFilename ||
      referencedPdfFiles.has(
        validFilename
      )
    ) {
      continue;
    }


    const path =
      join(
        pdfDirectory,
        validFilename
      );


    if (
      await fileOldEnough(
        path,
        nowMs,
        graceMs
      )
    ) {
      pdfOrphans.push(
        validFilename
      );
    }
  }


  return {
    coverOrphans,
    pdfOrphans,
  };
}


async function removeFileIfPresent(
  path:
    string
): Promise<boolean> {
  try {
    await unlink(
      path
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


export async function runManagedStorageMaintenance(
  options:
    ManagedStorageMaintenanceOptions =
      {}
): Promise<ManagedStorageMaintenanceReport> {
  const apply =
    options.apply ===
    true;


  const now =
    options.now ??
    new Date();


  const nowMs =
    now.getTime();


  const graceMs =
    options.orphanGraceMs ??
    DEFAULT_ORPHAN_GRACE_MS;


  if (
    !Number.isFinite(
      nowMs
    )
  ) {
    throw new Error(
      "Data de manutenção inválida."
    );
  }


  if (
    !Number.isFinite(
      graceMs
    ) ||
    graceMs <
      0
  ) {
    throw new Error(
      "Período de tolerância inválido."
    );
  }


  const db =
    getDb();


  const allProducts =
    await db
      .select({
        id:
          products.id,

        cover:
          products.cover,

        pdfPath:
          products.pdfPath,
      })
      .from(
        products
      )
      .all();


  const referencedCoverFiles =
    new Set<string>();


  const referencedPdfFiles =
    new Set<string>();


  const brokenReferences:
    ManagedStorageMaintenanceReport[
      "brokenReferences"
    ] =
    [];


  for (
    const product of
      allProducts
  ) {
    const coverFilename =
      managedCoverFilenameFromReference(
        product.cover
      );


    if (
      coverFilename
    ) {
      referencedCoverFiles.add(
        coverFilename
      );
    }


    const pdfFilename =
      managedPdfFilenameFromReference(
        product.pdfPath
      );


    if (
      pdfFilename
    ) {
      referencedPdfFiles.add(
        pdfFilename
      );
    }


    const issues =
      await getManagedProductAssetIntegrityIssues(
        product
      );


    for (
      const issue of
        issues
    ) {
      const reference =
        issue.field ===
        "cover"
          ? product.cover
          : product.pdfPath;


      if (
        reference
      ) {
        brokenReferences.push({
          productId:
            product.id,

          field:
            issue.field ===
            "cover"
              ? "cover"
              : "pdfPath",

          reference,

          message:
            issue.message,
        });
      }
    }
  }


  const {
    coverOrphans,
    pdfOrphans,
  } =
    await collectManagedOrphans({
      referencedCoverFiles,
      referencedPdfFiles,
      nowMs,
      graceMs,
    });


  let removedCoverOrphans =
    0;


  let removedPdfOrphans =
    0;


  if (
    apply
  ) {
    for (
      const filename of
        coverOrphans
    ) {
      if (
        await removeFileIfPresent(
          join(
            getCoverUploadDirectory(),
            filename
          )
        )
      ) {
        removedCoverOrphans +=
          1;
      }
    }


    for (
      const filename of
        pdfOrphans
    ) {
      if (
        await removeFileIfPresent(
          join(
            getPdfUploadDirectory(),
            filename
          )
        )
      ) {
        removedPdfOrphans +=
          1;
      }
    }
  }


  const downloadRecords =
    await db
      .select()
      .from(
        protectedDownloads
      )
      .all();


  const activeTokens =
    new Set<string>();


  const expiredRecords:
    number[] =
    [];


  const invalidExpiryRecords:
    number[] =
    [];


  let removedRecords =
    0;


  let removedFiles =
    0;


  for (
    const record of
      downloadRecords
  ) {
    const expirationMs =
      new Date(
        record.expiresAt
      ).getTime();


    const invalidExpiry =
      !Number.isFinite(
        expirationMs
      );


    const expired =
      invalidExpiry ||
      expirationMs <=
        nowMs;


    if (
      invalidExpiry
    ) {
      invalidExpiryRecords.push(
        record.id
      );
    }


    if (
      expired
    ) {
      expiredRecords.push(
        record.id
      );


      if (
        apply
      ) {
        try {
          const removed =
            await removeProtectedPdfByToken(
              record.downloadToken
            );


          if (
            removed
          ) {
            removedFiles +=
              1;
          }


          await db
            .delete(
              protectedDownloads
            )
            .where(
              eq(
                protectedDownloads.id,
                record.id
              )
            );


          removedRecords +=
            1;
        } catch (
          cleanupError
        ) {
          console.error(
            `Falha ao limpar download protegido ${record.id}:`,
            cleanupError
          );
        }
      }


      continue;
    }


    activeTokens.add(
      record.downloadToken
    );
  }


  const protectedDirectory =
    getProtectedPdfDirectory();


  const protectedEntries =
    await readDirectorySafely(
      protectedDirectory
    );


  const orphanFiles:
    string[] =
    [];


  let removedOrphanFiles =
    0;


  for (
    const entry of
      protectedEntries
  ) {
    if (
      !entry.isFile()
    ) {
      continue;
    }


    const match =
      PROTECTED_FILE_PATTERN.exec(
        entry.name
      );


    if (
      !match
    ) {
      continue;
    }


    const token =
      match[1];


    if (
      activeTokens.has(
        token
      )
    ) {
      continue;
    }


    const path =
      join(
        protectedDirectory,
        entry.name
      );


    if (
      !await fileOldEnough(
        path,
        nowMs,
        graceMs
      )
    ) {
      continue;
    }


    orphanFiles.push(
      entry.name
    );


    if (
      apply &&
      await removeFileIfPresent(
        path
      )
    ) {
      removedOrphanFiles +=
        1;
    }
  }


  return {
    apply,

    brokenReferences,

    managedAssets: {
      coverOrphans,
      pdfOrphans,
      removedCoverOrphans,
      removedPdfOrphans,
    },

    protectedDownloads: {
      expiredRecords,
      invalidExpiryRecords,
      orphanFiles,
      removedRecords,
      removedFiles,
      removedOrphanFiles,
    },
  };
}