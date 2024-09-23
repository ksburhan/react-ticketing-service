import request from "supertest";

import { app } from "../../app";
import mongoose from "mongoose";
import { Order, OrderStatus } from "../../models/orders";
import { stripe } from "../../stripe";
import { Payment } from "../../models/payments";

jest.mock('../../stripe.ts');

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

it('returns a 204 with valid inputs', async () => {
    const userId = new mongoose.Types.ObjectId().toHexString();
    const order = Order.build({
        id: new mongoose.Types.ObjectId().toHexString(),
        userId: userId,
        version: 0,
        price: 20,
        status: OrderStatus.Created
    });
    await order.save();

    const response = await request(app)
        .post('/api/payments')
        .set('Cookie', global.signin(userId))
        .send({
            token: 'tok_visa',
            orderId: order.id
        });

    const chargeOptions = (stripe.charges.create as jest.Mock).mock.calls[0][0];
    const chargeResult = await (stripe.charges.create as jest.Mock).mock.results[0].value;
    expect(chargeOptions.source).toEqual('tok_visa');
    expect(chargeOptions.amount).toEqual(order.price * 100);
    expect(chargeOptions.currency).toEqual('eur');

    const payment = Payment.findOne({
        orderId: order.id,
        stripeId: chargeResult.id
    });
    expect(payment).not.toBeNull()
});