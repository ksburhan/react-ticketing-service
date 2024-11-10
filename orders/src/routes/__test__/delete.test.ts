import request from "supertest";
import mongoose from "mongoose";

import { app } from "../../app";
import { natsWrapper } from "../../nats-wrapper";
import { Ticket } from "../../models/tickets";
import { Order, OrderStatus } from "../../models/orders";
import { User } from "../../models/users";

it('marks an order as cancelled', async () => {
    const owner = User.build({
        id: new mongoose.Types.ObjectId().toHexString(),
        username: 'testUser1'
    })
    await owner.save();

    const ticket = Ticket.build({
        id: new mongoose.Types.ObjectId().toHexString(),
        title: 'concert',
        price: 20,
        owner
    });
    await ticket.save();

    const buyer = User.build({
        id: new mongoose.Types.ObjectId().toHexString(),
        username: 'testUser1'
    })
    await buyer.save();

    const user = global.signin(buyer.id);

    const { body: order } = await request(app)
        .post('/api/orders')
        .set('Cookie', user)
        .send({ ticketId: ticket.id })
        .expect(201);

    await request(app)
        .delete(`/api/orders/${order.id}`)
        .set('Cookie', user)
        .send()
        .expect(204);

    const updatedOrder = await Order.findById(order.id);

    expect(updatedOrder!.status).toEqual(OrderStatus.Cancelled);
});

it('publishes an event', async () => {
    const owner = User.build({
        id: new mongoose.Types.ObjectId().toHexString(),
        username: 'testUser1'
    })
    await owner.save();

    const ticket = Ticket.build({
        id: new mongoose.Types.ObjectId().toHexString(),
        title: 'concert',
        price: 20,
        owner
    });
    await ticket.save();

    const buyer = User.build({
        id: new mongoose.Types.ObjectId().toHexString(),
        username: 'testUser1'
    })
    await buyer.save();

    const user = global.signin(buyer.id);

    const { body: order } = await request(app)
        .post('/api/orders')
        .set('Cookie', user)
        .send({ ticketId: ticket.id })
        .expect(201);

    await request(app)
        .delete(`/api/orders/${order.id}`)
        .set('Cookie', user)
        .send()
        .expect(204);

    expect(natsWrapper.client.publish).toHaveBeenCalled();
});