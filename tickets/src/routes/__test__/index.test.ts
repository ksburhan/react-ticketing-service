import request from "supertest";
import { app } from "../../app";
import { User } from "../../models/users";
import mongoose from "mongoose";

const createTicket = (id: string) => {
    return request(app)
        .post('/api/tickets')
        .set('Cookie', global.signin(id))
        .send({
            title: 'test',
            price: 20
        });
}

it('can fetch a list of tickets', async () => {
    const user = User.build({
        id: new mongoose.Types.ObjectId().toHexString(),
        username: 'testUser'
    })
    await user.save()

    await createTicket(user.id);
    await createTicket(user.id);
    await createTicket(user.id);

    const response = await request(app)
        .get('/api/tickets')
        .send()
        .expect(200);

    expect(response.body.length).toEqual(3);
});