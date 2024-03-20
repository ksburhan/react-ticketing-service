import express, { Request, Response } from 'express';
import { body } from 'express-validator';
import {
    validateRequest,
    requireAuth,
    NotAuthorizedError,
    NotFoundError
} from '@monkeytickets/common';

// import { Order } from '../models/orders';
import { natsWrapper } from '../nats-wrapper';

const router = express.Router();

router.delete(
    '/api/tickets/:id',
    requireAuth,
    [
        body('title')
            .not()
            .isEmpty()
            .withMessage('Title is required'),
        body('price')
            .isFloat({ gt: 0 }).withMessage('Price must be greater than 0')
    ],
    validateRequest,
    async (req: Request, res: Response) => {
        const ticket = {};

        res.send(ticket);
    });

export { router as deleteOrderRouter };