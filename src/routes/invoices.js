import { Router } from 'express';
import { pool } from '../db/pool.js';

export const invoicesRouter = Router();

invoicesRouter.get('/', async (req, res) => {
  const { rows: invoices } = await pool.query(
    'SELECT * FROM invoices WHERE account_id = $1 ORDER BY period_start DESC LIMIT 24',
    [req.account.id]
  );
  const withLines = await Promise.all(
    invoices.map(async (inv) => {
      const { rows: lines } = await pool.query('SELECT * FROM invoice_line_items WHERE invoice_id = $1', [
        inv.id,
      ]);
      return { ...inv, lineItems: lines };
    })
  );
  res.json(withLines);
});
