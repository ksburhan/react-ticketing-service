import { BadRequestError, NotAuthorizedError, NotFoundError, OrderStatus, requireAuth, validateRequest } from '@monkeytickets/common';
import express, { Request, Response } from 'express';
import { body } from 'express-validator';
import { Order } from '../models/orders';
import { stripe } from '../stripe';
import { recordPayment } from '../record-payment';

const router = express.Router();

router.post('/api/payments/confirm',
    requireAuth,
    [
        body('paymentIntentId')
            .not()
            .isEmpty(),
        body('orderId')
            .not()
            .isEmpty()
    ],
    validateRequest,
    async (req: Request, res: Response) => {
        const { paymentIntentId, orderId } = req.body;

        const order = await Order.findById(orderId);

        if (!order) {
            throw new NotFoundError();
        }
        if (order.userId !== req.currentUser!.id) {
            throw new NotAuthorizedError();
        }
        if (order.status === OrderStatus.Cancelled) {
            throw new BadRequestError('Cannot pay for cancelled order!');
        }

        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        if (paymentIntent.status !== 'succeeded') {
            throw new BadRequestError('Payment not completed');
        }

        const payment = await recordPayment(order.id, paymentIntent.id);

        res.status(201).send({ id: payment.id });
    });

export { router as confirmPaymentRouter };
