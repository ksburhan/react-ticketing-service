import { Listener, NotFoundError, Subjects, TicketCreatedEvent } from "@monkeytickets/common";
import { Message } from "node-nats-streaming";

import { queueGroupName } from "./queue-group-name";
import { Ticket } from "../../models/tickets";
import { User } from "../../models/users";

export class TicketCreatedListener extends Listener<TicketCreatedEvent> {
    readonly subject = Subjects.TicketCreated;
    queueGroupName = queueGroupName;

    async onMessage(data: TicketCreatedEvent['data'], msg: Message) {
        const { id, title, price, owner } = data;

        const ownerObject = await User.findById(owner.id);
        if (!ownerObject) {
            throw new NotFoundError();
        }

        const ticket = Ticket.build({
            id,
            title,
            price,
            owner: ownerObject
        });
        await ticket.save();

        msg.ack();
    }
}