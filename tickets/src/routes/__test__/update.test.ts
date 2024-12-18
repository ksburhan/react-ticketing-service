import request from "supertest";
import mongoose from "mongoose";

import { app } from "../../app";
import { natsWrapper } from "../../nats-wrapper";
import { Ticket } from "../../models/tickets";
import { User } from "../../models/users";

const createUser = async () => {
    const user = User.build({
        id: new mongoose.Types.ObjectId().toHexString(),
        username: 'testUser'
    })
    await user.save()
    return user
}

it('returns a 404 if provided id does not exist', async () => {
    const id = new mongoose.Types.ObjectId().toHexString();
    return request(app)
        .put(`/api/tickets/${id}`)
        .set('Cookie', global.signin())
        .send({
            title: 'test',
            price: 20
        })
        .expect(404);
});

it('returns a 401 if user is not authenticated', async () => {
    const id = new mongoose.Types.ObjectId().toHexString();
    return request(app)
        .put(`/api/tickets/${id}`)
        .send({
            title: 'test',
            price: 20
        })
        .expect(401);
});

it('returns a 401 if user id does not own ticket', async () => {
    const user = await createUser();

    const response = await request(app)
        .post('/api/tickets')
        .set('Cookie', global.signin(user.id))
        .send({
            title: 'test',
            price: 20
        });

    await request(app)
        .put(`/api/tickets/${response.body.id}`)
        .set('Cookie', global.signin())
        .send({
            title: 'test 2',
            price: 10
        })
        .expect(401);
});

it('returns a 400 if user provides invalid title or price', async () => {
    const cookie = global.signin();

    const response = await request(app)
        .post('/api/tickets')
        .set('Cookie', cookie)
        .send({
            title: 'test',
            price: 20
        });

    await request(app)
        .put(`/api/tickets/${response.body.id}`)
        .set('Cookie', cookie)
        .send({
            title: '',
            price: 10
        })
        .expect(400);

    await request(app)
        .put(`/api/tickets/${response.body.id}`)
        .set('Cookie', cookie)
        .send({
            title: 'test 2',
            price: -10
        })
        .expect(400);
});

it('updates the ticket provided valid inputs', async () => {
    const user = await createUser();
    const cookie = global.signin(user.id);

    const response = await request(app)
        .post('/api/tickets')
        .set('Cookie', cookie)
        .send({
            title: 'test',
            price: 20
        });

    await request(app)
        .put(`/api/tickets/${response.body.id}`)
        .set('Cookie', cookie)
        .send({
            title: 'test 2',
            price: 10
        })
        .expect(200);

    const ticketResponse = await request(app)
        .get(`/api/tickets/${response.body.id}`)
        .send();

    expect(ticketResponse.body.title).toEqual('test 2');
    expect(ticketResponse.body.price).toEqual(10);
});

it('publishes an event', async () => {
    const user = await createUser();
    const cookie = global.signin(user.id);

    const response = await request(app)
        .post('/api/tickets')
        .set('Cookie', cookie)
        .send({
            title: 'test',
            price: 20
        });

    await request(app)
        .put(`/api/tickets/${response.body.id}`)
        .set('Cookie', cookie)
        .send({
            title: 'test 2',
            price: 10
        })
        .expect(200);

    expect(natsWrapper.client.publish).toHaveBeenCalled();
})

it('rejects request if ticket is reserved', async () => {
    const user = await createUser();
    const cookie = global.signin(user.id);

    const response = await request(app)
        .post('/api/tickets')
        .set('Cookie', cookie)
        .send({
            title: 'test',
            price: 20
        });

    const ticket = await Ticket.findById(response.body.id);
    ticket!.set({ orderId: new mongoose.Types.ObjectId().toHexString() })
    await ticket!.save()

    await request(app)
        .put(`/api/tickets/${response.body.id}`)
        .set('Cookie', cookie)
        .send({
            title: 'test 2',
            price: 10
        })
        .expect(400);

    expect(natsWrapper.client.publish).not.toHaveBeenCalledTimes(2);
})