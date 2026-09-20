import { Router } from 'express';
import { pool } from '../db/pool.js';
import { stripe, getOrCreateStripeCustomer } from '../services/stripe.js';

export const checkoutRouter = Router();

checkoutRouter.post('/session', async (req, res) => {
  const account = req.account;
  const customerId = await getOrCreateStripeCustomer({
    pool,
    account,
    email: req.user.email,
  });

  const successUrl = `${process.env.FRONTEND_URL}/upgrade/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${process.env.FRONTEND_URL}/upgrade/plan`;

  let session;
  if (account.plan === 'credits') {
    session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer: customerId,
      line_items: [{ price: process.env.STRIPE_PRICE_CREDITS_BLOCK, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { accountId: account.id, kind: 'credits_topup', creditsAmount: '200000' },
    });
  } else {
    session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: process.env.STRIPE_PRICE_USAGE_METERED }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { accountId: account.id, kind: 'usage_subscription' },
    });
  }

  res.json({ url: session.url });
});

checkoutRouter.get('/session/:id', async (req, res) => {
  const session = await stripe.checkout.sessions.retrieve(req.params.id);
  res.json({ status: session.status, paymentStatus: session.payment_status });
});
