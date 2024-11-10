import express, { Request, Response } from 'express';
import { body } from 'express-validator';
import { NotFoundError, requireAuth, validateRequest } from '@monkeytickets/common';
import { Ticket } from '../models/tickets';
import { TicketCreatedPublisher } from '../events/publishers/ticket-created-publisher';
import { natsWrapper } from '../nats-wrapper';
import { User } from '../models/users';

const router = express.Router();

router.post('/api/tickets',
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
        const { title, price } = req.body;

        const user = await User.findById(req.currentUser!.id)
        if (!user) {
            throw new NotFoundError();
        }

        const ticket = Ticket.build({
            title,
            price,
            owner: user
        });

        await ticket.save();
        await new TicketCreatedPublisher(natsWrapper.client).publish({
            id: ticket.id,
            version: ticket.version,
            title: ticket.title,
            price: ticket.price,
            owner: {
                id: ticket.owner.id,
                username: ticket.owner.username
            }
        });

        res.status(201).send(ticket);
    });

export { router as createTicketRouter };