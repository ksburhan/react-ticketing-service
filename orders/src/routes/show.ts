import express, { Request, Response } from 'express';
import { NotFoundError } from '@monkeytickets/common';

// import { Order } from '../models/orders';

const router = express.Router();

router.get('/api/orders/:id', async (req: Request, res: Response) => {
    // const order = await Order.findById(req.params.id);
    const order = {};

    if (!order) {
        throw new NotFoundError();
    }

    res.send(order);
});

export { router as showOrderRouter };