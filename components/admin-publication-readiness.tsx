"use client";

import {
  getProductPublicationIssues,
} from "../lib/product-publication";


interface AdminPublicationReadinessProps {
  slug:
    string;

  title:
    string;

  shortTitle:
    string;

  category:
    string;

  bank:
    string;

  level:
    string;

  organization:
    string;

  contestSlug:
    string;

  description:
    string;

  price:
    string;

  cover:
    string | null;

  pdfPath:
    string | null;

  active:
    boolean;

  publishedAt:
    string | null;
}


function normalizedText(
  value:
    string
): string | null {
  const result =
    value.trim();


  return (
    result ||
    null
  );
}


function formatPublicationDate(
  value:
    string | null
): string | null {
  if (
    !value
  ) {
    return null;
  }


  const date =
    new Date(
      value
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }


  return date.toLocaleString(
    "pt-BR"
  );
}


export function AdminPublicationReadiness({
  slug,
  title,
  shortTitle,
  category,
  bank,
  level,
  organization,
  contestSlug,
  description,
  price,
  cover,
  pdfPath,
  active,
  publishedAt,
}: AdminPublicationReadinessProps) {
  const numericPrice =
    Number(
      price
        .trim()
        .replace(
          ",",
          "."
        )
    );


  const issues =
    getProductPublicationIssues({
      slug:
        slug.trim(),

      title:
        title.trim(),

      shortTitle:
        normalizedText(
          shortTitle
        ),

      category:
        normalizedText(
          category
        ),

      bank:
        normalizedText(
          bank
        ),

      level:
        normalizedText(
          level
        ),

      organization:
        normalizedText(
          organization
        ),

      contestSlug:
        normalizedText(
          contestSlug
        ),

      description:
        normalizedText(
          description
        ),

      price:
        Number.isFinite(
          numericPrice
        )
          ? numericPrice
          : 0,

      cover,

      pdfPath,
    });


  const ready =
    issues.length ===
    0;


  const publicationDate =
    formatPublicationDate(
      publishedAt
    );


  return (
    <aside
      className={`admin-publication-readiness ${
        ready
          ? "ready"
          : "pending"
      }`}
    >
      <header>
        <div>
          <span className="admin-section-kicker">
            Publicação
          </span>

          <h3>
            {active
              ? "Apostila publicada"
              : ready
                ? "Pronta para publicar"
                : "Ainda existem pendências"}
          </h3>
        </div>

        <span
          className={`admin-readiness-badge ${
            ready
              ? "ready"
              : "pending"
          }`}
        >
          {ready
            ? "✓ Pronta"
            : `${issues.length} pendência${
                issues.length ===
                1
                  ? ""
                  : "s"
              }`}
        </span>
      </header>


      {ready ? (
        <div className="admin-readiness-success">
          <strong>
            ✓ Todos os requisitos obrigatórios
            foram preenchidos.
          </strong>

          <span>
            {active
              ? "Esta apostila atende às regras atuais de publicação."
              : "Salve as alterações e use Publicar na listagem administrativa."}
          </span>
        </div>
      ) : (
        <div className="admin-readiness-list">
          {issues.map(
            (
              issue
            ) => (
              <div
                key={
                  issue.field
                }
              >
                <span>
                  ○
                </span>

                <p>
                  <strong>
                    {issue.field}
                  </strong>

                  <small>
                    {issue.message}
                  </small>
                </p>
              </div>
            )
          )}
        </div>
      )}


      {publicationDate && (
        <footer>
          Primeira publicação:{" "}
          <strong>
            {publicationDate}
          </strong>
        </footer>
      )}
    </aside>
  );
}