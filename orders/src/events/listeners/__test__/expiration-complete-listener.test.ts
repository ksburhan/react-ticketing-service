import mongoose from "mongoose";
import { natsWrapper } from "../../../nats-wrapper";
import { ExpirationCompleteListener } from "../expiration-complete-listener";
import { Ticket } from "../../../models/tickets";
import { Order, OrderStatus } from "../../../models/orders";
import { ExpirationCompleteEvent } from "@monkeytickets/common";
import { User } from "../../../models/users";

const setup = async () => {
    const listener = new ExpirationCompleteListener(natsWrapper.client);

    const owner = User.build({
        id: new mongoose.Types.ObjectId().toHexString(),
        username: 'testUser'
    })
    await owner.save();

    const buyer = User.build({
        id: new mongoose.Types.ObjectId().toHexString(),
        username: 'testUser'
    })
    await buyer.save()

    const ticket = Ticket.build({
        id: new mongoose.Types.ObjectId().toHexString(),
        title: 'concert',
        price: 20,
        owner
    })
    await ticket.save()

    const order = Order.build({
        status: OrderStatus.Created,
        buyer: buyer,
        expiresAt: new Date(),
        ticket,
    })
    await order.save()

    const data: ExpirationCompleteEvent['data'] = {
        orderId: order.id
    }

    // @ts-ignore
    const msg: Message = {
        ack: jest.fn()
    };

    return { listener, order, ticket, data, msg };
}

it('updates to order status to cancelled', async () => {
    const { listener, order, ticket, data, msg } = await setup();

    await listener.onMessage(data, msg);

    const updatedOrder = await Order.findById(order.id)

    expect(updatedOrder!.status).toEqual(OrderStatus.Cancelled)
});

it('emit an OrderCancelled event', async () => {
    const { listener, order, ticket, data, msg } = await setup();

    await listener.onMessage(data, msg);

    expect(natsWrapper.client.publish).toHaveBeenCalled();

    const eventData = JSON.parse(
        (natsWrapper.client.publish as jest.Mock).mock.calls[0][1]
    )
    expect(eventData.id).toEqual(order.id)
});

it('acks the message', async () => {
    const { listener, order, ticket, data, msg } = await setup();

    await listener.onMessage(data, msg);

    expect(msg.ack).toHaveBeenCalled();
});