import { Listener, OrderCancelledEvent, Subjects } from "@monkeytickets/common";
import { queueGroupName } from "./queue-group-name";
import { Message } from "node-nats-streaming";
import { Ticket } from "../../models/tickets";
import { TicketUpdatedPublisher } from "../publishers/ticket-updated-publisher";

export class OrderCancelledListener extends Listener<OrderCancelledEvent> {
    subject: Subjects.OrderCancelled = Subjects.OrderCancelled;
    queueGroupName = queueGroupName;

    async onMessage(data: OrderCancelledEvent['data'], msg: Message) {
        // Find ticket that order is unreserving
        const ticket = await Ticket.findById(data.ticket.id).populate('owner');

        // If ticket not exist, error
        if (!ticket) {
            throw new Error('Ticket not found');
        }

        // Mark ticket as being unreserved
        ticket.set({ orderId: undefined })

        // Save the ticket
        await ticket.save()
        await new TicketUpdatedPublisher(this.client).publish({
            id: ticket.id,
            price: ticket.price,
            title: ticket.title,
            owner: {
                id: ticket.owner.id,
                username: ticket.owner.username
            },
            orderId: ticket.orderId,
            version: ticket.version,
        })

        // ack the message
        msg.ack()
    }
}