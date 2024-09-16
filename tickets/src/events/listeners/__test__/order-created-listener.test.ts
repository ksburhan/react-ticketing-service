import { OrderCreatedEvent, OrderStatus } from "@monkeytickets/common"
import { Ticket } from "../../../models/tickets"
import { natsWrapper } from "../../../nats-wrapper"
import { OrderCreatedListener } from "../order-created-listener"
import mongoose from "mongoose"
import { Message } from "node-nats-streaming"

const setup = async () => {
    // Create instance of listener
    const listener = new OrderCreatedListener(natsWrapper.client)

    // Create and save ticket
    const ticket = Ticket.build({
        title: 'concert',
        price: 99,
        userId: 'me'
    })
    await ticket.save()

    // Create fake data event
    const data: OrderCreatedEvent['data'] = {
        id: new mongoose.Types.ObjectId().toHexString(),
        version: 0,
        status: OrderStatus.Created,
        userId: 'me2',
        expiresAt: 'string',
        ticket: {
            id: ticket.id,
            price: ticket.price,
        },
    }

    // @ts-ignore
    const msg: Message = {
        ack: jest.fn(),
    }

    return { listener, ticket, data, msg }
}

it('sets the userId of the ticket', async () => {
    const { listener, ticket, data, msg } = await setup()

    await listener.onMessage(data, msg)

    const updatedTicket = await Ticket.findById(ticket.id)

    expect(updatedTicket?.orderId!).toEqual(data.id)
})

it('acks the message', async () => {
    const { listener, ticket, data, msg } = await setup()

    await listener.onMessage(data, msg)

    expect(msg.ack).toHaveBeenCalled()
})