import express from 'express';
import 'express-async-errors';
import cors from 'cors';
import morgan from 'morgan';
import 'dotenv/config';

import { requireAuth } from './middleware/auth.js';
import { authRouter } from './routes/auth.js';
import { plansRouter } from './routes/plans.js';
import { checkoutRouter } from './routes/checkout.js';
import { webhooksRouter } from './routes/webhooks.js';
import { usageRouter } from './routes/usage.js';
import { walletRouter } from './routes/wallet.js';
import { invoicesRouter } from './routes/invoices.js';
import { billingRouter } from './routes/billing.js';
import { accountsRouter } from './routes/accounts.js';
import { accountRouter } from './routes/account.js';

const app = express();

const allowedOrigins = [
  'https://keel-rose-ten.vercel.app',
  'http://localhost:3000',
];

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(morgan('dev'));

app.use('/api/webhooks', express.raw({ type: 'application/json' }), webhooksRouter);

app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth', authRouter);
app.use('/api/plans', plansRouter);
app.use('/api/checkout', requireAuth, checkoutRouter);
app.use('/api/usage', requireAuth, usageRouter);
app.use('/api/account', requireAuth, accountRouter);
app.use('/api/wallet', requireAuth, walletRouter);
app.use('/api/invoices', requireAuth, invoicesRouter);
app.use('/api/billing', requireAuth, billingRouter);
app.use('/api/admin/accounts', accountsRouter); 
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'internal server error' });
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Keel API listening on :${port}`));
