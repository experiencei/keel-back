import Stripe from 'stripe';
import 'dotenv/config';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
});

export async function reportMeterUsage({ eventName, stripeCustomerId, quantity, idempotencyKey }) {
  return stripe.billing.meterEvents.create(
    {
      event_name: eventName,
      payload: { stripe_customer_id: stripeCustomerId, value: String(Math.max(1, Math.round(quantity))) },
    },
    { idempotencyKey } // reuses the same idempotency key as our own ledger insert
  );
}

export async function getOrCreateStripeCustomer({ pool, account, email }) {
  if (account.stripe_customer_id) return account.stripe_customer_id;

  const customer = await stripe.customers.create({
    email,
    name: account.company_name,
    metadata: { accountId: account.id },
  });

  await pool.query('UPDATE accounts SET stripe_customer_id = $1 WHERE id = $2', [
    customer.id,
    account.id,
  ]);

  return customer.id;
}
