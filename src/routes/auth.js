import { Router } from 'express';
import crypto from 'crypto';
import { pool } from '../db/pool.js';

export const authRouter = Router();

function companyNameFromDomain(domain) {
  const base = domain.split('.')[0];
  return base.charAt(0).toUpperCase() + base.slice(1);
}

authRouter.post('/verify', async (req, res) => {
  const { email, plan } = req.body || {};
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'valid email required' });
  }
  if (!['credits', 'usage'].includes(plan)) {
    return res.status(400).json({ error: 'plan must be "credits" or "usage"' });
  }

  const domain = email.split('@')[1];

  let { rows: userRows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

  let accountId;
  if (userRows.length > 0) {
    accountId = userRows[0].account_id;
  } else {
    const { rows: accountRows } = await pool.query(
      `INSERT INTO accounts (company_name, domain, plan) VALUES ($1, $2, $3) RETURNING id`,
      [companyNameFromDomain(domain), domain, plan]
    );
    accountId = accountRows[0].id;
    await pool.query('INSERT INTO wallets (account_id, balance_credits, granted_credits) VALUES ($1, 0, 0)', [
      accountId,
    ]);
    await pool.query('INSERT INTO users (account_id, email) VALUES ($1, $2)', [accountId, email]);
  }

  const token = crypto.randomBytes(32).toString('hex');
  const { rows: freshUser } = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  await pool.query(
    `INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, now() + interval '30 days')`,
    [token, freshUser[0].id]
  );

  res.json({ token });
});
