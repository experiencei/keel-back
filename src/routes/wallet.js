import { Router } from 'express';
import { pool } from '../db/pool.js';

export const walletRouter = Router();

walletRouter.get('/', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM wallets WHERE account_id = $1', [req.account.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'wallet not found' });
  res.json({
    balanceCredits: Number(rows[0].balance_credits),
    grantedCredits: Number(rows[0].granted_credits),
  });
});

walletRouter.patch('/settings', async (req, res) => {
  const { softLimitCredits, hardLimitCredits, autoRechargeEnabled, autoRechargeThreshold, autoRechargeTopup } =
    req.body || {};

  await pool.query(
    `UPDATE accounts SET
       soft_limit_credits = COALESCE($1, soft_limit_credits),
       hard_limit_credits = COALESCE($2, hard_limit_credits),
       auto_recharge_enabled = COALESCE($3, auto_recharge_enabled),
       auto_recharge_threshold_credits = COALESCE($4, auto_recharge_threshold_credits),
       auto_recharge_topup_credits = COALESCE($5, auto_recharge_topup_credits)
     WHERE id = $6`,
    [softLimitCredits, hardLimitCredits, autoRechargeEnabled, autoRechargeThreshold, autoRechargeTopup, req.account.id]
  );
  res.json({ ok: true });
});
