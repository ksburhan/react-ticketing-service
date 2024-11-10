import express, { Request, Response } from 'express';
import { NotFoundError, requireAuth } from '@monkeytickets/common';

import { Order } from '../models/orders';
import { User } from '../models/users';

const router = express.Router();

router.get('/api/orders', requireAuth, async (req: Request, res: Response) => {

    const buyer = await User.findById(req.currentUser!.id)
    if (!buyer) {
        throw new NotFoundError();
    }

    const orders = await Order.find({ buyer })
        .populate({
            path: 'ticket',
            populate: {
                path: 'owner',
                model: 'User'
            }
        })
        .populate('buyer');

    res.send(orders);
});

export { router as indexOrderRouter };