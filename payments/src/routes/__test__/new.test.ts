import request from "supertest";

import { app } from "../../app";
import { natsWrapper } from "../../nats-wrapper";
import mongoose from "mongoose";
import { Order, OrderStatus } from "../../models/orders";

it('returns 404 when order does not exist', async () => {
    const response = await request(app)
        .post('/api/payments')
        .set('Cookie', global.signin())
        .send({
            token: 'tests',
            orderId: new mongoose.Types.ObjectId().toHexString()
        });

    expect(response.status).toEqual(404);
});

it('returns 401 when purchasing order of another user', async () => {
    const order = Order.build({
        id: new mongoose.Types.ObjectId().toHexString(),
        userId: new mongoose.Types.ObjectId().toHexString(),
        version: 0,
        price: 20,
        status: OrderStatus.Created
    });
    await order.save();

    const response = await request(app)
        .post('/api/payments')
        .set('Cookie', global.signin())
        .send({
            token: 'tests',
            orderId: order.id
        });

    expect(response.status).toEqual(401);
});

it('returns 400 when purchasing cancelled order', async () => {
    const userId = new mongoose.Types.ObjectId().toHexString();
    const order = Order.build({
        id: new mongoose.Types.ObjectId().toHexString(),
        userId: userId,
        version: 0,
        price: 20,
        status: OrderStatus.Cancelled
    });
    await order.save();

    const response = await request(app)
        .post('/api/payments')
        .set('Cookie', global.signin(userId))
        .send({
            token: 'test',
            orderId: order.id
        });

    expect(response.status).toEqual(400);
});