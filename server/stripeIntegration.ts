import Stripe from "stripe";
import { ENV } from "./_core/env";

let stripeInstance: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (!stripeInstance) {
    if (!ENV.stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY não está configurado");
    }
    stripeInstance = new Stripe(ENV.stripeSecretKey);
  }
  return stripeInstance;
}

export interface CreateCheckoutSessionInput {
  appointmentCode: string;
  appointmentId: number;
  paymentMethod: "card" | "pix";
  amountCents: number;
  stripeFeesCents?: number;
  description: string;
  clientEmail?: string | null;
  clientName: string;
  successUrl: string;
  cancelUrl: string;
}

export async function createCheckoutSession(input: CreateCheckoutSessionInput): Promise<{
  sessionId: string;
  url: string;
}> {
  const stripe = getStripeClient();

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    {
      price_data: {
        currency: "brl",
        product_data: {
          name: input.description,
          metadata: {
            appointmentCode: input.appointmentCode,
            appointmentId: String(input.appointmentId),
          },
        },
        unit_amount: input.amountCents,
      },
      quantity: 1,
    },
  ];

  const paymentMethodTypes: Stripe.Checkout.SessionCreateParams.PaymentMethodType[] = [];
  if (input.paymentMethod === "card") {
    paymentMethodTypes.push("card");
  } else if (input.paymentMethod === "pix") {
    paymentMethodTypes.push("pix");
  } else {
    paymentMethodTypes.push("card", "pix");
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: paymentMethodTypes,
    line_items: lineItems,
    mode: "payment",
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    customer_email: input.clientEmail || undefined,
    metadata: {
      appointmentCode: input.appointmentCode,
      appointmentId: String(input.appointmentId),
      clientName: input.clientName,
    },
  });

  if (!session.url) {
    throw new Error("Stripe não retornou URL de checkout");
  }

  return {
    sessionId: session.id,
    url: session.url,
  };
}

export async function retrieveCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session> {
  const stripe = getStripeClient();
  return stripe.checkout.sessions.retrieve(sessionId);
}

export async function retrievePaymentIntent(intentId: string): Promise<Stripe.PaymentIntent> {
  const stripe = getStripeClient();
  return stripe.paymentIntents.retrieve(intentId);
}
