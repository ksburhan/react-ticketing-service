import { Listener, OrderCreatedEvent, Subjects } from "@monkeytickets/common";
import { queueGroupName } from "./queue-group-name";
import { Message } from "node-nats-streaming";
import { Ticket } from "../../models/tickets";
import { TicketUpdatedPublisher } from "../publishers/ticket-updated-publisher";

export class OrderCreatedListener extends Listener<OrderCreatedEvent> {
    subject: Subjects.OrderCreated = Subjects.OrderCreated;
    queueGroupName = queueGroupName;

    async onMessage(data: OrderCreatedEvent['data'], msg: Message) {
        // Find ticket that order is reserving
        const ticket = await Ticket.findById(data.ticket.id).populate('owner');

        // If ticket not exist, error
        if (!ticket) {
            throw new Error('Ticket not found');
        }

        // Mark ticket as being reserved
        ticket.set({ orderId: data.id })

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