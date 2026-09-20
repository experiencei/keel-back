import { Router } from 'express';
import { pool } from '../db/pool.js';
import { stripe } from '../services/stripe.js';

export const billingRouter = Router();

billingRouter.post('/retention-offer', async (req, res) => {
  const account = req.account;
  const { action } = req.body || {};

  try {
    if (action === 'apply-discount' && account.stripeSubscriptionId) {
      await stripe.subscriptions.update(account.stripeSubscriptionId, {
        coupon: process.env.STRIPE_COUPON_RETENTION,
      });
    } else if (action === 'pause' && account.stripeSubscriptionId) {
      await stripe.subscriptions.update(account.stripeSubscriptionId, {
        pause_collection: { behavior: 'void' },
      });
    } else if (action === 'switch-usage') {
      await pool.query("UPDATE accounts SET plan = 'usage' WHERE id = $1", [account.id]);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('retention-offer error:', err);
    res.status(500).json({ error: 'failed to apply offer' });
  }
});

billingRouter.post('/cancel', async (req, res) => {
  const account = req.account;
  try {
    if (account.stripeSubscriptionId) {
      await stripe.subscriptions.update(account.stripeSubscriptionId, { cancel_at_period_end: true });
    }
    await pool.query("UPDATE accounts SET status = 'cancelled', cancelled_at = now() WHERE id = $1", [
      account.id,
    ]);
    res.json({ ok: true });
  } catch (err) {
    console.error('cancel error:', err);
    res.status(500).json({ error: 'failed to cancel' });
  }
});

billingRouter.post('/reactivate', async (req, res) => {
  const account = req.account;
  if (account.stripeSubscriptionId) {
    await stripe.subscriptions.update(account.stripeSubscriptionId, { cancel_at_period_end: false });
  }
  await pool.query("UPDATE accounts SET status = 'active', cancelled_at = NULL WHERE id = $1", [account.id]);
  res.json({ ok: true });
});
