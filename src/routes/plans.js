import { Router } from 'express';

export const plansRouter = Router();

plansRouter.get('/', (_req, res) => {
  res.json([
    {
      id: 'credits',
      label: 'Credits',
      tag: 'PREPAID',
      description: 'Buy a block of credits up front. Predictable cost, hard-stops or auto-recharges at the limit you set.',
      priceUSD: 2000,
      unitsLabel: '200,000 credits',
      features: ['Budget certainty', 'Soft-limit warnings', 'Optional auto-recharge'],
    },
    {
      id: 'usage',
      label: 'Usage-based',
      tag: 'POSTPAID',
      description: 'Pay for exactly what gets consumed, billed monthly against a transparent rate card.',
      priceUSD: 0,
      unitsLabel: '$0.01 / credit, no minimum',
      features: ['No prepayment', 'Itemized statements', 'Good for variable workloads'],
    },
  ]);
});
