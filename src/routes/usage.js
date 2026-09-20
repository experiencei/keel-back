import { Router } from 'express';
import { pool } from '../db/pool.js';
import { creditsForEvent } from '../lib/pricing.js';
import { deductCredits, addCredits } from '../services/wallet.js';
import { reportMeterUsage } from '../services/stripe.js';
import 'dotenv/config';

export const usageRouter = Router();

usageRouter.post('/events', async (req, res) => {
  const account = req.account;
  const { idempotencyKey, model, tokensIn, tokensOut } = req.body || {};

  if (!idempotencyKey || !model || tokensIn == null || tokensOut == null) {
    return res.status(400).json({ error: 'idempotencyKey, model, tokensIn, tokensOut are required' });
  }

  const cost = creditsForEvent(model, tokensIn, tokensOut);

  if (account.plan === 'credits') {
    const { blocked, balance } = await deductCredits(account.id, cost, account.hardLimitCredits);
    if (blocked) {
      if (account.autoRecharge.enabled) {
        await addCredits(account.id, account.autoRecharge.topupCredits);
        await pool.query(
          `INSERT INTO transactions (account_id, type, amount_usd, credits_added)
           VALUES ($1, 'auto_recharge', $2, $3)`,
          [account.id, account.autoRecharge.topupCredits * 0.01, account.autoRecharge.topupCredits]
        );
      } else {
        return res.status(402).json({ error: 'insufficient balance', balance });
      }
    }
  } else if (account.stripeCustomerId) {
    // Usage-based plan: report consumption to Stripe's Billing Meter, keyed by
    // the same idempotencyKey used in our own ledger insert below — Stripe
    // dedupes meter events on this key too, so a retried request can't be
    // double-counted on either side.
    try {
      await reportMeterUsage({
        eventName: process.env.STRIPE_METER_EVENT_NAME || 'credits_used',
        stripeCustomerId: account.stripeCustomerId,
        quantity: cost,
        idempotencyKey,
      });
    } catch (err) {
      // Don't fail the whole request if Stripe's meter event API hiccups —
      // log it and let a reconciliation job catch the gap later. Our own
      // usage_events row below is still the source of truth for what happened.
      console.error('Failed to report meter usage to Stripe:', err.message);
    }
  }

  // Insert into the append-only ledger. ON CONFLICT DO NOTHING means a retried
  // request with the same idempotencyKey is a safe no-op, not a double charge.
  const inserted = await pool.query(
    `INSERT INTO usage_events (account_id, idempotency_key, model, tokens_in, tokens_out, credits_cost)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (account_id, idempotency_key) DO NOTHING
     RETURNING id`,
    [account.id, idempotencyKey, model, tokensIn, tokensOut, cost]
  );

  res.status(inserted.rowCount > 0 ? 201 : 200).json({ costCredits: cost, deduped: inserted.rowCount === 0 });
});

// GET /api/usage/events?limit=60
usageRouter.get('/events', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 60, 250);
  const { rows } = await pool.query(
    `SELECT id, model, tokens_in, tokens_out, credits_cost, created_at
     FROM usage_events WHERE account_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [req.account.id, limit]
  );
  res.json(rows);
});
