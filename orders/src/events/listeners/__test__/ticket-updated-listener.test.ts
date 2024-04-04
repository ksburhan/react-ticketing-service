import { TicketUpdatedEvent } from "@monkeytickets/common";
import { natsWrapper } from "../../../nats-wrapper";
import mongoose from "mongoose";
import { Message } from "node-nats-streaming";
import { Ticket } from "../../../models/tickets";
import { TicketUpdatedListener } from "../ticket-updated-listeners";

const setup = async () => {
    // create instance of listener
    const listener = new TicketUpdatedListener(natsWrapper.client);

    // create and save a ticket
    const ticket = Ticket.build({
        id: new mongoose.Types.ObjectId().toHexString(),
        title: 'concert',
        price: 10,
    });
    await ticket.save();

    // create fake data event
    const data: TicketUpdatedEvent['data'] = {
        id: ticket.id,
        version: ticket.version + 1,
        title: 'updated concert',
        price: 20,
        userId: new mongoose.Types.ObjectId().toHexString(),
    };

    // create fake message object
    // @ts-ignore
    const msg: Message = {
        ack: jest.fn()
    };

    return { listener, ticket, data, msg };
}

it('finds, updates and saves a ticket', async () => {
    const { listener, ticket, data, msg } = await setup();

    // call onMessage function with the data object + message object
    await listener.onMessage(data, msg);

    // write assertions to make sure a ticket was created
    const updatedTicket = await Ticket.findById(data.id);

    expect(updatedTicket).toBeDefined();
    expect(updatedTicket!.title).toEqual(data.title);
    expect(updatedTicket!.price).toEqual(data.price);
    expect(updatedTicket!.version).toEqual(data.version);
});

it('acks the message', async () => {
    const { listener, data, msg } = await setup();

    // call onMessage function with the data object + message object
    await listener.onMessage(data, msg);

    // write assertions to make sure ack function is called
    expect(msg.ack).toHaveBeenCalled();
});

it('does not ack the message if the event has a skipped version number', async () => {
    const { listener, ticket, data, msg } = await setup();

    data.version = 10;

    // call onMessage function with the data object + message object
    try {
        await listener.onMessage(data, msg);
    } catch (err) { }

    // write assertions to make sure ack function is called
    expect(msg.ack).not.toHaveBeenCalled();
});