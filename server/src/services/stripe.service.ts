import Stripe from 'stripe';

let stripeInstance: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeInstance) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error('Stripe is not configured');
    }
    stripeInstance = new Stripe(secretKey, { apiVersion: '2024-06-20' as any });
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
    currency: 'usd',
    customer: customerId,
    description,
  });
  return charge.id;
}