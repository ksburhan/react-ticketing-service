import request from "supertest";

import { app } from "../../app";
import { Ticket } from '../../models/tickets';
import { natsWrapper } from "../../nats-wrapper";
import mongoose from "mongoose";
import { Order, OrderStatus } from "../../models/orders";

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
    const ticket = Ticket.build({
        title: 'concert',
        price: 20
    });
    await ticket.save();

    const order = Order.build({
        userId: 'ajshdkasjdhajkd',
        status: OrderStatus.Created,
        expiresAt: new Date(),
        ticket: ticket,
    });
    await order.save();

    await request(app)
        .post('/api/orders')
        .set('Cookie', global.signin())
        .send({
            ticketId: ticket.id
        })
        .expect(400);
});

it('reserves a ticket', async () => {
    const ticket = Ticket.build({
        title: 'concert',
        price: 20
    });
    await ticket.save();

    await request(app)
        .post('/api/orders')
        .set('Cookie', global.signin())
        .send({
            ticketId: ticket.id
        })
        .expect(201);
});

// it('publishes an event', async () => {
//     const ticket = Ticket.build({
//         title: 'concert',
//         price: 20
//     });
//     await ticket.save();

//     await request(app)
//         .post('/api/orders')
//         .set('Cookie', global.signin())
//         .send({
//             ticketId: ticket.id
//         })
//         .expect(201);

//     expect(natsWrapper.client.publish).toHaveBeenCalled();
// });