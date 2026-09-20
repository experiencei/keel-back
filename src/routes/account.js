import { Router } from 'express';

export const accountRouter = Router();

accountRouter.get('/', (req, res) => {
  res.json(req.account);
});
