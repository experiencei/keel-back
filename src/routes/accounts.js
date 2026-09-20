import { Router } from 'express';
import { pool } from '../db/pool.js';

export const accountsRouter = Router();

accountsRouter.get('/', async (req, res) => {
  if (req.headers['x-admin-key'] !== process.env.ADMIN_API_KEY) {
    return res.status(403).json({ error: 'forbidden' });
  }
  const { rows } = await pool.query(`
    SELECT a.id, a.company_name, a.domain, a.plan, a.status, a.created_at,
           u.email,
           COALESCE(SUM(t.amount_usd), 0) AS lifetime_usd
    FROM accounts a
    JOIN users u ON u.account_id = a.id
    LEFT JOIN transactions t ON t.account_id = a.id
    GROUP BY a.id, u.email
    ORDER BY a.created_at DESC
  `);
  res.json(rows);
});
