export class PaymentFinancialValidationError
  extends Error {
  readonly code =
    "PAYMENT_FINANCIAL_VALIDATION_ERROR";

  readonly status =
    409;

  constructor(
    message:
      string
  ) {
    super(
      message
    );

    this.name =
      "PaymentFinancialValidationError";
  }
}


export interface PaymentFinancialInput {
  transactionAmount:
    number;

  currencyId:
    string;

  expectedTotal:
    number;

  expectedCurrency?:
    string;
}


export interface PaymentFinancialValidationResult {
  transactionAmountCents:
    number;

  expectedTotalCents:
    number;

  currencyId:
    string;
}


export function financialValueToCents(
  value:
    number,
  label:
    string
): number {
  if (
    typeof value !==
      "number" ||
    !Number.isFinite(
      value
    )
  ) {
    throw new PaymentFinancialValidationError(
      `${label} inválido.`
    );
  }


  if (
    value <=
      0
  ) {
    throw new PaymentFinancialValidationError(
      `${label} inválido.`
    );
  }


  const cents =
    Math.round(
      (
        value +
        Number.EPSILON
      ) *
        100
    );


  if (
    !Number.isSafeInteger(
      cents
    ) ||
    cents <=
      0
  ) {
    throw new PaymentFinancialValidationError(
      `${label} inválido.`
    );
  }


  /**
   * Não aceitamos precisão financeira além de
   * centavos.
   *
   * Exemplo:
   * 39.901 não pode ser silenciosamente tratado
   * como 39.90.
   */
  const normalizedValue =
    cents /
    100;


  if (
    Math.abs(
      normalizedValue -
      value
    ) >
    1e-9
  ) {
    throw new PaymentFinancialValidationError(
      `${label} possui precisão inválida.`
    );
  }


  return cents;
}


export function validatePaymentFinancials(
  input:
    PaymentFinancialInput
): PaymentFinancialValidationResult {
  const expectedCurrency =
    (
      input.expectedCurrency ??
      "BRL"
    )
      .trim()
      .toUpperCase();


  const currencyId =
    input.currencyId
      .trim()
      .toUpperCase();


  if (
    !expectedCurrency
  ) {
    throw new PaymentFinancialValidationError(
      "Moeda esperada inválida."
    );
  }


  if (
    !currencyId
  ) {
    throw new PaymentFinancialValidationError(
      "Pagamento sem moeda."
    );
  }


  if (
    currencyId !==
    expectedCurrency
  ) {
    throw new PaymentFinancialValidationError(
      "Moeda do pagamento diverge da moeda do pedido."
    );
  }


  const transactionAmountCents =
    financialValueToCents(
      input.transactionAmount,
      "Valor pago"
    );


  const expectedTotalCents =
    financialValueToCents(
      input.expectedTotal,
      "Total do pedido"
    );


  /**
   * Nenhuma tolerância monetária.
   *
   * Uma diferença de R$ 0,01 já representa um
   * pagamento diferente do pedido persistido.
   */
  if (
    transactionAmountCents !==
    expectedTotalCents
  ) {
    throw new PaymentFinancialValidationError(
      "Valor pago diverge do total do pedido."
    );
  }


  return {
    transactionAmountCents,

    expectedTotalCents,

    currencyId,
  };
}