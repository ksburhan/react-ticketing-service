import { requireAuth, validateRequest } from '@monkeytickets/common';
import express, { Request, Response } from 'express';
import { body } from 'express-validator';

const router = express.Router();

router.post('/api/payments',
    requireAuth,
    [
        body('tokey')
            .not()
            .isEmpty(),
        body('orderId')
            .not()
            .isEmpty()
    ],
    validateRequest,
    async (req: Request, res: Response) => {
        res.send({ success: true })
    });

export { router as createChargeRouter };