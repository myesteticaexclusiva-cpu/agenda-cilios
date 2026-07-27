import { ENV } from "./_core/env";

/**
 * Configuração de taxas do Stripe no Brasil.
 * PIX: sem taxa (cliente paga exatamente o valor)
 * Cartão: 2,9% + R$ 0,30 por transação
 */
const STRIPE_CARD_PERCENTAGE = 0.029;
const STRIPE_CARD_FIXED_CENTS = 30;

/**
 * Calcula o valor total que será cobrado do cliente.
 * Para PIX: retorna o valor base
 * Para cartão: retorna valor base + taxa Stripe
 */
export function calculatePaymentAmount(
  basePriceCents: number,
  paymentMethod: "card" | "pix",
): { amountCents: number; stripeFeesCents: number } {
  if (paymentMethod === "pix") {
    return { amountCents: basePriceCents, stripeFeesCents: 0 };
  }

  // Cartão: calcula a taxa que será adicionada ao valor
  const stripeFeesCents = Math.round(basePriceCents * STRIPE_CARD_PERCENTAGE) + STRIPE_CARD_FIXED_CENTS;
  const amountCents = basePriceCents + stripeFeesCents;

  return { amountCents, stripeFeesCents };
}

/**
 * Formata o valor em centavos para exibição em reais.
 */
export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

/**
 * Valida se o token de acesso Stripe está configurado.
 */
export function validateStripeConfig(): void {
  if (!ENV.stripeSecretKey) {
    throw new Error("Stripe secret key não está configurado (STRIPE_SECRET_KEY).");
  }
}

/**
 * Descrição do item para o Stripe.
 */
export function buildLineItemDescription(
  professionalName: string,
  serviceName: string,
  appointmentDate: string,
): string {
  return `${serviceName} com ${professionalName} em ${appointmentDate}`;
}
