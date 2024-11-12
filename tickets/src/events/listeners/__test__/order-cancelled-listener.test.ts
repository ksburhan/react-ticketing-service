import { OrderCancelledEvent, OrderCreatedEvent, OrderStatus } from "@monkeytickets/common"
import { Ticket } from "../../../models/tickets"
import { natsWrapper } from "../../../nats-wrapper"
import mongoose from "mongoose"
import { Message } from "node-nats-streaming"
import { OrderCancelledListener } from "../order-cancelled-listerner"
import { User } from "../../../models/users"

const setup = async () => {
    const user = User.build({
        id: new mongoose.Types.ObjectId().toHexString(),
        username: 'testUser'
    })
    await user.save()

    // Create instance of listener
    const listener = new OrderCancelledListener(natsWrapper.client)

    // Create and save ticket
    const orderId = new mongoose.Types.ObjectId().toHexString()
    const ticket = Ticket.build({
        title: 'concert',
        price: 99,
        owner: user
    })
    ticket.set({ orderId })
    await ticket.save()

    // Create fake data event
    const data: OrderCancelledEvent['data'] = {
        id: orderId,
        version: 0,
        ticket: {
            id: ticket.id,
        },
    }

    // @ts-ignore
    const msg: Message = {
        ack: jest.fn(),
    }

    return { listener, ticket, orderId, data, msg }
}

it('updates the event to be undefined', async () => {
    const { listener, ticket, data, msg } = await setup()

    await listener.onMessage(data, msg)

    const updatedTicket = await Ticket.findById(ticket.id)

    expect(updatedTicket!.orderId).not.toBeDefined()
})

it('acks the message', async () => {
    const { listener, ticket, data, msg } = await setup()

    await listener.onMessage(data, msg)

    expect(msg.ack).toHaveBeenCalled()
})

it('publishes a ticket updated event', async () => {
    const { listener, ticket, orderId, data, msg } = await setup()

    await listener.onMessage(data, msg)

    expect(natsWrapper.client.publish).toHaveBeenCalled();

    const ticketUpdatedData = JSON.parse((natsWrapper.client.publish as jest.Mock).mock.calls[0][1]);

    expect(orderId).not.toEqual(ticketUpdatedData.orderId)
})