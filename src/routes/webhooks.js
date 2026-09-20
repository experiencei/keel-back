import { Router } from 'express';
import { pool } from '../db/pool.js';
import { stripe } from '../services/stripe.js';
import { addCredits } from '../services/wallet.js';

export const webhooksRouter = Router();

webhooksRouter.post('/stripe', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // more than once. Insert-or-skip makes processing idempotent.
  const { rowCount } = await pool.query(
    'INSERT INTO webhook_events (stripe_event_id, type) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [event.id, event.type]
  );
  if (rowCount === 0) {
    return res.json({ received: true, deduped: true });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const accountId = session.metadata?.accountId;
        if (!accountId) break;

        if (session.metadata.kind === 'credits_topup') {
          const credits = Number(session.metadata.creditsAmount || 0);
          await addCredits(accountId, credits);
          await pool.query(
            `INSERT INTO transactions (account_id, type, amount_usd, credits_added, stripe_payment_intent_id)
             VALUES ($1, 'purchase', $2, $3, $4)`,
            [accountId, (session.amount_total || 0) / 100, credits, session.payment_intent]
          );
        } else if (session.metadata.kind === 'usage_subscription') {
          await pool.query('UPDATE accounts SET stripe_subscription_id = $1 WHERE id = $2', [
            session.subscription,
            accountId,
          ]);
        }
        break;
      }

      case 'invoice.paid':
      case 'invoice.finalized': {
        const invoice = event.data.object;
        const customerId = invoice.customer;
        const { rows } = await pool.query('SELECT id FROM accounts WHERE stripe_customer_id = $1', [
          customerId,
        ]);
        if (rows.length === 0) break;
        const accountId = rows[0].id;

        const { rows: existing } = await pool.query(
          'SELECT id FROM invoices WHERE stripe_invoice_id = $1',
          [invoice.id]
        );
        let invoiceRowId;
        if (existing.length === 0) {
          const inserted = await pool.query(
            `INSERT INTO invoices (account_id, stripe_invoice_id, period_start, period_end, total_usd, status)
             VALUES ($1, $2, to_timestamp($3), to_timestamp($4), $5, $6) RETURNING id`,
            [
              accountId,
              invoice.id,
              invoice.period_start,
              invoice.period_end,
              invoice.total / 100,
              invoice.status,
            ]
          );
          invoiceRowId = inserted.rows[0].id;
          for (const line of invoice.lines.data) {
            await pool.query(
              `INSERT INTO invoice_line_items (invoice_id, model, call_count, credits)
               VALUES ($1, $2, $3, $4)`,
              [invoiceRowId, line.description || 'usage', line.quantity || 0, (line.amount || 0) / 1]
            );
          }
        } else {
          await pool.query('UPDATE invoices SET status = $1, total_usd = $2 WHERE stripe_invoice_id = $3', [
            invoice.status,
            invoice.total / 100,
            invoice.id,
          ]);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        await pool.query(
          `UPDATE accounts SET status = 'cancelled', cancelled_at = now() WHERE stripe_subscription_id = $1`,
          [sub.id]
        );
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const status = sub.status === 'active' ? 'active' : sub.status === 'past_due' ? 'past_due' : 'active';
        await pool.query('UPDATE accounts SET status = $1 WHERE stripe_subscription_id = $2', [
          status,
          sub.id,
        ]);
        break;
      }

      default:
        break; // ignore anything we don't act on
    }
    res.json({ received: true });
  } catch (err) {
    console.error('Webhook handling error:', err);

    res.status(500).json({ error: 'internal error processing webhook' });
  }
});
