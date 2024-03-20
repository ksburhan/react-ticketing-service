import express, { Request, Response } from 'express';
import { NotAuthorizedError, NotFoundError, requireAuth } from '@monkeytickets/common';

import { Order } from '../models/orders';

const router = express.Router();

router.get('/api/orders/:id', requireAuth, async (req: Request, res: Response) => {
    const order = await Order.findById(req.params.id);

    if (!order) {
        throw new NotFoundError();
    }
    if (order.userId !== req.currentUser!.id) {
        throw new NotAuthorizedError();
    }

    res.send(order);
});

export { router as showOrderRouter };