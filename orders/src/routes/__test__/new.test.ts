import request from "supertest";

import { app } from "../../app";
import { Ticket } from '../../models/tickets';
import { natsWrapper } from "../../nats-wrapper";
import mongoose from "mongoose";
import { Order, OrderStatus } from "../../models/orders";
import { User } from "../../models/users";

it('has a route handler listening to /api/orders for post requests', async () => {
    const response = await request(app)
        .post('/api/orders')
        .send({});

    expect(response.status).not.toEqual(404);
});

it('can only be accessed if the user is signed in', async () => {
    const response = await request(app)
        .post('/api/orders')
        .send({})
        .expect(401);
});

it('returns status other than 401 if user is signed in', async () => {
    const response = await request(app)
        .post('/api/orders')
        .set('Cookie', global.signin())
        .send({});

    expect(response.status).not.toEqual(401);
});

it('returns and error if the ticket does not exist', async () => {
    const ticketId = new mongoose.Types.ObjectId();

    await request(app)
        .post('/api/orders')
        .set('Cookie', global.signin())
        .send({
            ticketId
        })
        .expect(404);
});

it('returns and error if the ticket is already reserved', async () => {
    const owner = User.build({
        id: new mongoose.Types.ObjectId().toHexString(),
        username: 'testUser',
    });
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
        username: 'testUser',
    });
    await buyer.save();

    const order = Order.build({
        buyer: buyer,
        status: OrderStatus.Created,
        expiresAt: new Date(),
        ticket: ticket,
    });
    await order.save();

    await request(app)
        .post('/api/orders')
        .set('Cookie', global.signin(buyer.id))
        .send({
            ticketId: ticket.id
        })
        .expect(400);
});

it('reserves a ticket', async () => {
    const owner = User.build({
        id: new mongoose.Types.ObjectId().toHexString(),
        username: 'testUser',
    });
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
        username: 'testUser',
    });
    await buyer.save();

    await request(app)
        .post('/api/orders')
        .set('Cookie', global.signin(buyer.id))
        .send({
            ticketId: ticket.id
        })
        .expect(201);
});

it('publishes an event', async () => {
    const owner = User.build({
        id: new mongoose.Types.ObjectId().toHexString(),
        username: 'testUser',
    });
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
        username: 'testUser',
    });
    await buyer.save();

    await request(app)
        .post('/api/orders')
        .set('Cookie', global.signin(buyer.id))
        .send({
            ticketId: ticket.id
        })
        .expect(201);

    expect(natsWrapper.client.publish).toHaveBeenCalled();
});