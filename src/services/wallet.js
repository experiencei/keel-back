import { withTransaction } from '../db/pool.js';

export async function deductCredits(accountId, credits, hardLimitCredits) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      'SELECT balance_credits FROM wallets WHERE account_id = $1 FOR UPDATE',
      [accountId]
    );
    if (rows.length === 0) throw new Error('wallet not found');

    const current = Number(rows[0].balance_credits);
    if (current - credits < hardLimitCredits) {
      return { blocked: true, balance: current };
    }

    const next = current - credits;
    await client.query(
      'UPDATE wallets SET balance_credits = $1, updated_at = now() WHERE account_id = $2',
      [next, accountId]
    );
    return { blocked: false, balance: next };
  });
}

export async function addCredits(accountId, credits) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE wallets SET balance_credits = balance_credits + $1,
        granted_credits = granted_credits + $1, updated_at = now()
       WHERE account_id = $2 RETURNING balance_credits`,
      [credits, accountId]
    );
    return Number(rows[0].balance_credits);
  });
}
