/**
 * Formata valores monetários no padrão brasileiro.
 *
 * Este helper é independente do catálogo de produtos.
 * Componentes de checkout, dashboard e cabeçalho podem
 * utilizá-lo sem carregar qualquer dado de apostilas.
 */
export function formatPrice(
  value: number
): string {
  return value.toLocaleString(
    "pt-BR",
    {
      style: "currency",
      currency: "BRL",
    }
  );
}