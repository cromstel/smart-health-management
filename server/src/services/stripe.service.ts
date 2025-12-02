import Stripe from 'stripe';
import dotenv from 'dotenv';
dotenv.config();

// Helper function to validate environment variables
const getEnvVariable = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    // During module loading, dotenv may not be loaded yet
    // Provide fallback for module initialization
    const fallbacks: { [key: string]: string } = {
      'STRIPE_SECRET_KEY': 'sk_test_dummy',
      'STRIPE_WEBHOOK_SECRET': 'whsec_dummy',
      'STRIPE_CURRENCY': 'usd'
    };
    // console.warn(`${name} not available during module init, using fallback`);
    return fallbacks[name] || '';
  }
  return value;
};

const stripeSecretKey = getEnvVariable('STRIPE_SECRET_KEY');
const stripeWebhookSecret = getEnvVariable('STRIPE_WEBHOOK_SECRET');
const stripeCurrency = getEnvVariable('STRIPE_CURRENCY');

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2024-11-20.acacia' as any,
});

// Modern payment intent creation with confirmation
export const createPaymentIntent = async (
  amount: number,
  currency: string = stripeCurrency,
  customerId?: string,
  metadata?: Record<string, string>
): Promise<Stripe.PaymentIntent> => {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: currency.toLowerCase(),
      customer: customerId,
      metadata: metadata || {},
      automatic_payment_methods: {
        enabled: true,
      },
    });
    return paymentIntent;
  } catch (error: any) {
    console.error('Error creating payment intent:', error);
    throw new Error(`Failed to create payment intent: ${error.message}`);
  }
};

// Confirm a payment intent (typically called after collecting payment method)
export const confirmPaymentIntent = async (
  paymentIntentId: string,
  paymentMethodId?: string
): Promise<Stripe.PaymentIntent> => {
  try {
    const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId, {
      payment_method: paymentMethodId,
      return_url: process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/payment/success` : undefined,
    });
    return paymentIntent;
  } catch (error: any) {
    console.error('Error confirming payment intent:', error);
    throw new Error(`Failed to confirm payment intent: ${error.message}`);
  }
};

// Create a setup intent for saving payment methods
export const createSetupIntent = async (
  customerId: string,
  metadata?: Record<string, string>
): Promise<Stripe.SetupIntent> => {
  try {
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      metadata: metadata || {},
      payment_method_types: ['card', 'us_bank_account'],
    });
    return setupIntent;
  } catch (error: any) {
    console.error('Error creating setup intent:', error);
    throw new Error(`Failed to create setup intent: ${error.message}`);
  }
};

// Attach a payment method to a customer
export const attachPaymentMethodToCustomer = async (
  paymentMethodId: string,
  customerId: string
): Promise<Stripe.PaymentMethod> => {
  try {
    // Attach the payment method to the customer
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });

    // Set as default payment method
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    // Retrieve and return the attached payment method
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
    return paymentMethod;
  } catch (error: any) {
    console.error('Error attaching payment method:', error);
    throw new Error(`Failed to attach payment method: ${error.message}`);
  }
};

// List payment methods for a customer
export const listCustomerPaymentMethods = async (customerId: string): Promise<Stripe.PaymentMethod[]> => {
  try {
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    });
    return paymentMethods.data;
  } catch (error: any) {
    console.error('Error listing payment methods:', error);
    throw new Error(`Failed to list payment methods: ${error.message}`);
  }
};

// Detach payment method from customer
export const detachPaymentMethod = async (paymentMethodId: string): Promise<Stripe.PaymentMethod> => {
  try {
    const paymentMethod = await stripe.paymentMethods.detach(paymentMethodId);
    return paymentMethod;
  } catch (error: any) {
    console.error('Error detaching payment method:', error);
    throw new Error(`Failed to detach payment method: ${error.message}`);
  }
};

// Create a refund
export const createRefund = async (
  paymentIntentId: string,
  amount?: number,
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer'
): Promise<Stripe.Refund> => {
  try {
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: amount ? Math.round(amount * 100) : undefined,
      reason,
    });
    return refund;
  } catch (error: any) {
    console.error('Error creating refund:', error);
    throw new Error(`Failed to create refund: ${error.message}`);
  }
};

// Retrieve a payment intent
export const retrievePaymentIntent = async (paymentIntentId: string): Promise<Stripe.PaymentIntent> => {
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    return paymentIntent;
  } catch (error: any) {
    console.error('Error retrieving payment intent:', error);
    throw new Error(`Failed to retrieve payment intent: ${error.message}`);
  }
};

// Retrieve a customer
export const retrieveCustomer = async (customerId: string): Promise<Stripe.Customer> => {
  try {
    const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer;
    return customer;
  } catch (error: any) {
    console.error('Error retrieving customer:', error);
    throw new Error(`Failed to retrieve customer: ${error.message}`);
  }
};

export const createStripeCustomer = async (email: string, name: string, metadata?: Record<string, string>): Promise<string> => {
  try {
    const customer = await stripe.customers.create({
      email,
      name,
      metadata: metadata || {},
    });
    return customer.id;
  } catch (error: any) {
    console.error('Error creating Stripe customer:', error);
    throw new Error(`Failed to create Stripe customer: ${error.message}`);
  }
};

export const createStripeCharge = async (customerId: string, amount: number, description: string): Promise<string> => {
  try {
    const charge = await stripe.charges.create({
      customer: customerId,
      amount: amount * 100, // Amount in cents
      currency: stripeCurrency,
      description,
    });
    return charge.id;
  } catch (error) {
    console.error('Error creating Stripe charge:', error);
    throw new Error('Failed to create Stripe charge');
  }
};

export const handleStripeWebhook = async (rawBody: Buffer, signature: string): Promise<{
  success: boolean;
  eventType: string;
  eventId: string;
  processed: boolean;
}> => {
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, stripeWebhookSecret);
  } catch (err: any) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    throw new Error(`Webhook Error: ${err.message}`);
  }

  console.log(`Processing webhook event: ${event.type} (${event.id})`);

  try {
    // Handle the event based on type
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log(`PaymentIntent succeeded: ${paymentIntent.id}, amount: ${paymentIntent.amount}`);

        // Update payment status in database
        // This should be implemented based on your database schema
        // await updatePaymentStatus(paymentIntent.id, 'succeeded', paymentIntent.metadata);

        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log(`PaymentIntent failed: ${paymentIntent.id}`);

        // Update payment status and handle failure
        // await updatePaymentStatus(paymentIntent.id, 'failed', paymentIntent.last_payment_error);

        break;
      }

      case 'payment_intent.canceled': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log(`PaymentIntent canceled: ${paymentIntent.id}`);

        // Update payment status
        // await updatePaymentStatus(paymentIntent.id, 'canceled');

        break;
      }

      case 'payment_method.attached': {
        const paymentMethod = event.data.object as Stripe.PaymentMethod;
        console.log(`PaymentMethod attached: ${paymentMethod.id} to customer ${paymentMethod.customer}`);

        // Update customer's payment methods in database
        // await updateCustomerPaymentMethods(paymentMethod.customer as string, paymentMethod.id);

        break;
      }

      case 'payment_method.detached': {
        const paymentMethod = event.data.object as Stripe.PaymentMethod;
        console.log(`PaymentMethod detached: ${paymentMethod.id}`);

        // Remove payment method from customer's records
        // await removeCustomerPaymentMethod(paymentMethod.id);

        break;
      }

      case 'setup_intent.succeeded': {
        const setupIntent = event.data.object as Stripe.SetupIntent;
        console.log(`SetupIntent succeeded: ${setupIntent.id}`);

        // Setup intent completed successfully - payment method can now be used
        // await completeSetupIntent(setupIntent.id, setupIntent.payment_method as string);

        break;
      }

      case 'customer.created': {
        const customer = event.data.object as Stripe.Customer;
        console.log(`Customer created: ${customer.id} (${customer.email})`);

        // Customer was created in Stripe - could sync with local database
        // await syncCustomerData(customer.id, customer);

        break;
      }

      case 'customer.updated': {
        const customer = event.data.object as Stripe.Customer;
        console.log(`Customer updated: ${customer.id}`);

        // Customer data changed - update local records
        // await updateCustomerData(customer.id, customer);

        break;
      }

      case 'charge.succeeded': {
        const charge = event.data.object as Stripe.Charge;
        console.log(`Charge succeeded: ${charge.id}`);

        // Legacy charge handling - update transaction records
        // await updateChargeStatus(charge.id, 'succeeded', charge.amount, charge.currency);

        break;
      }

      case 'charge.failed': {
        const failedCharge = event.data.object as Stripe.Charge;
        console.log(`Charge failed: ${failedCharge.id}, reason: ${failedCharge.failure_message}`);

        // Handle failed charge
        // await handleFailedCharge(failedCharge.id, failedCharge.failure_code, failedCharge.failure_message);

        break;
      }

      case 'refund.created': {
        const refund = event.data.object as Stripe.Refund;
        console.log(`Refund created: ${refund.id}, amount: ${refund.amount}`);

        // Handle refund creation
        // await processRefund(refund.id, refund.payment_intent as string, refund.amount);

        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log(`Invoice payment succeeded: ${invoice.id}`);

        // Invoice payment completed
        // await updateInvoicePaymentStatus(invoice.id, 'paid');

        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log(`Invoice payment failed: ${invoice.id}`);

        // Invoice payment failed
        // await updateInvoicePaymentStatus(invoice.id, 'failed');

        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
        // Log unhandled events for monitoring
        // await logUnhandledWebhookEvent(event.type, event.id);
    }

    return {
      success: true,
      eventType: event.type,
      eventId: event.id,
      processed: true,
    };

  } catch (error: any) {
    console.error(`Error processing webhook event ${event.type}: ${error.message}`);

    // Log processing errors for debugging
    // await logWebhookProcessingError(event.id, event.type, error.message);

    return {
      success: false,
      eventType: event.type,
      eventId: event.id,
      processed: false,
    };
  }
};
