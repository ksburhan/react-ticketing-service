import request from "supertest";
import mongoose from "mongoose";

import { app } from "../../app";
import { Ticket } from "../../models/tickets";
import { User } from "../../models/users";

it('returns the order', async () => {
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
        username: 'testUser2'
    })
    await buyer.save();

    const user = global.signin(buyer.id);

    const { body: order } = await request(app)
        .post('/api/orders')
        .set('Cookie', user)
        .send({
            ticketId: ticket.id
        })
        .expect(201);

    const { body: fetchedOrder } = await request(app)
        .get(`/api/orders/${order.id}`)
        .set('Cookie', user)
        .send()
        .expect(200);

    expect(fetchedOrder.id).toEqual(order.id);
});

it('returns an error if user tries other users order', async () => {
    const owner = User.build({
        id: new mongoose.Types.ObjectId().toHexString(),
        username: 'testUser'
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
        username: 'testUser'
    })
    await buyer.save();

    const { body: order } = await request(app)
        .post('/api/orders')
        .set('Cookie', global.signin(buyer.id))
        .send({
            ticketId: ticket.id
        })
        .expect(201);

    await request(app)
        .get(`/api/orders/${order.id}`)
        .set('Cookie', global.signin())
        .send()
        .expect(401);
});