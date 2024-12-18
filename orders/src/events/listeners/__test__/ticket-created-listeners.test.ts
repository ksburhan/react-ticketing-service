import { TicketCreatedEvent } from "@monkeytickets/common";
import { natsWrapper } from "../../../nats-wrapper";
import { TicketCreatedListener } from "../ticket-created-listener";
import mongoose from "mongoose";
import { Message } from "node-nats-streaming";
import { Ticket } from "../../../models/tickets";
import { User } from "../../../models/users";

const setup = async () => {
    // create instance of listener
    const listener = new TicketCreatedListener(natsWrapper.client);

    const owner = User.build({
        id: new mongoose.Types.ObjectId().toHexString(),
        username: 'testUser'
    })
    await owner.save();

    // create fake data event
    const data: TicketCreatedEvent['data'] = {
        version: 0,
        id: new mongoose.Types.ObjectId().toHexString(),
        title: 'concert',
        price: 10,
        owner: {
            id: owner.id,
            username: owner.username
        }
    };

    // create fake message object
    // @ts-ignore
    const msg: Message = {
        ack: jest.fn()
    };

    return { listener, data, msg };
}

it('creates and saves a ticket', async () => {
    const { listener, data, msg } = await setup();

    // call onMessage function with the data object + message object
    await listener.onMessage(data, msg);

    // write assertions to make sure a ticket was created
    const ticket = await Ticket.findById(data.id);
    expect(ticket).toBeDefined();
    expect(ticket!.title).toEqual(data.title);
    expect(ticket!.price).toEqual(data.price);
});

it('acks the message', async () => {
    const { listener, data, msg } = await setup();

    // call onMessage function with the data object + message object
    await listener.onMessage(data, msg);

    // write assertions to make sure ack function is called
    expect(msg.ack).toHaveBeenCalled();
});