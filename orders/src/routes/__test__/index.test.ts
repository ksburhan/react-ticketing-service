import request from "supertest";
import mongoose from "mongoose";

import { app } from "../../app";
import { Ticket } from "../../models/tickets";
import { User, UserDocument } from "../../models/users";

const buildTicket = async (owner: UserDocument) => {
    const ticket = Ticket.build({
        id: new mongoose.Types.ObjectId().toHexString(),
        title: 'concert',
        price: 20,
        owner
    });
    await ticket.save();

    return ticket;
}

const buildUser = async (id?: string) => {
    const user = User.build({
        id: new mongoose.Types.ObjectId().toHexString(),
        username: id || 'testUser',
    });
    await user.save();

    return user;
}

it('can fetch a list of orders for user', async () => {
    const user1 = await buildUser('testUser1');
    const user2 = await buildUser('testUser2');
    const user1Cookie = global.signin(user1.id);
    const user2Cookie = global.signin(user2.id);
    const ticket1 = await buildTicket(user1);
    const ticket2 = await buildTicket(user2);
    const ticket3 = await buildTicket(user2);

    await request(app)
        .post('/api/orders')
        .set('Cookie', user1Cookie)
        .send({ ticketId: ticket1.id })
        .expect(201);

    const { body: orderOne } = await request(app)
        .post('/api/orders')
        .set('Cookie', user2Cookie)
        .send({ ticketId: ticket2.id })
        .expect(201);

    const { body: orderTwo } = await request(app)
        .post('/api/orders')
        .set('Cookie', user2Cookie)
        .send({ ticketId: ticket3.id })
        .expect(201);

    const response = await request(app)
        .get('/api/orders')
        .set('Cookie', user2Cookie)
        .expect(200);

    expect(response.body.length).toEqual(2);
    expect(response.body[0].id).toEqual(orderOne.id);
    expect(response.body[1].id).toEqual(orderTwo.id);
    expect(response.body[0].ticket.id).toEqual(ticket2.id);
});