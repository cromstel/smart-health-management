import Stripe from 'stripe';
import { isConfigured } from '../config/env.js';

let stripeInstance: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeInstance) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!isConfigured(secretKey)) {
      throw new Error('Stripe is not configured');
    }
    stripeInstance = new Stripe(secretKey as string, { apiVersion: '2024-06-20' as any });
  }
  return stripeInstance;
}

export async function createStripeCustomer(email: string, name: string) {
  const stripe = getStripe();
  const customer = await stripe.customers.create({ email, name });
  return customer.id;
}

export async function createStripeCharge(customerId: string, amount: number, description?: string) {
  const stripe = getStripe();
  const charge = await stripe.charges.create({
    amount: Math.round(amount * 100),
    // The currency is configuration. It was hardcoded to US dollars, so a
    // deployment charging in another currency would have sent the wrong
    // amount to the card network.
    currency: (process.env.STRIPE_CURRENCY || 'usd').toLowerCase(),
    customer: customerId,
    description,
  });
  return charge.id;
}