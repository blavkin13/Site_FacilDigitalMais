import type {
  NextRequest,
} from "next/server";

import {
  NextResponse,
} from "next/server";

import {
  readManagedCoverFile,
} from "../../../../../lib/admin-product-storage";


type RouteContext = {
  params:
    Promise<{
      filename:
        string;
    }>;
};


export const dynamic =
  "force-dynamic";


export async function GET(
  _request:
    NextRequest,
  context:
    RouteContext
) {
  try {
    const {
      filename,
    } =
      await context.params;


    const file =
      await readManagedCoverFile(
        filename
      );


    if (
      !file
    ) {
      return new NextResponse(
        null,
        {
          status:
            404,

          headers: {
            "X-Content-Type-Options":
              "nosniff",
          },
        }
      );
    }


    /**
     * Faz uma cópia para garantir ArrayBuffer normal
     * e evitar incompatibilidades de tipagem Buffer /
     * SharedArrayBuffer no Next.
     */
    const bytes =
      Uint8Array.from(
        file.buffer
      );


    return new NextResponse(
      bytes.buffer,
      {
        status:
          200,

        headers: {
          "Content-Type":
            file.mimeType,

          "Content-Length":
            String(
              bytes.byteLength
            ),

          "Cache-Control":
            "public, max-age=31536000, immutable",

          "X-Content-Type-Options":
            "nosniff",

          "Content-Security-Policy":
            "default-src 'none'",
        },
      }
    );
  } catch (
    error
  ) {
    console.error(
      "Erro ao servir capa:",
      error
    );


    return new NextResponse(
      null,
      {
        status:
          404,

        headers: {
          "X-Content-Type-Options":
            "nosniff",
        },
      }
    );
  }
}