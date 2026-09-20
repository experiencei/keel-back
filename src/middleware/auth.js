import { pool } from '../db/pool.js';

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'missing bearer token' });

  const { rows } = await pool.query(
    `SELECT s.token, u.id AS user_id, u.email, a.*
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     JOIN accounts a ON a.id = u.account_id
     WHERE s.token = $1 AND s.expires_at > now()`,
    [token]
  );

  if (rows.length === 0) return res.status(401).json({ error: 'invalid or expired session' });

  const row = rows[0];
  req.user = { id: row.user_id, email: row.email };
  req.account = {
    id: row.id,
    companyName: row.company_name,
    domain: row.domain,
    plan: row.plan,
    status: row.status,
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    softLimitCredits: Number(row.soft_limit_credits),
    hardLimitCredits: Number(row.hard_limit_credits),
    autoRecharge: {
      enabled: row.auto_recharge_enabled,
      thresholdCredits: Number(row.auto_recharge_threshold_credits),
      topupCredits: Number(row.auto_recharge_topup_credits),
    },
  };
  next();
}
