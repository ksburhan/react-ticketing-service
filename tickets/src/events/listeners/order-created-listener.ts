import { Listener, OrderCreatedEvent, Subjects } from "@monkeytickets/common";
import { queueGroupName } from "./queue-group-name";
import { Message } from "node-nats-streaming";
import { Ticket } from "../../models/tickets";

export class OrderCreatedListener extends Listener<OrderCreatedEvent> {
    subject: Subjects.OrderCreated = Subjects.OrderCreated;
    queueGroupName = queueGroupName;

    async onMessage(data: OrderCreatedEvent['data'], msg: Message) {
        // Find ticket that order is reserving
        const ticket = await Ticket.findById(data.ticket.id);

        // If ticket not exist, error
        if (!ticket) {
            throw new Error('Ticket not found');
        }

        // Mark ticket as being reserved
        ticket.set({ orderId: data.id })

        // Save the ticket
        await ticket.save()

        // ack the message
        msg.ack()
    }
}