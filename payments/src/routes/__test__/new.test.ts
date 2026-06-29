import request from "supertest";

import { app } from "../../app";
import mongoose from "mongoose";
import { Order, OrderStatus } from "../../models/orders";
import { stripe } from "../../stripe";
import { Payment } from "../../models/payments";
import { natsWrapper } from "../../nats-wrapper";

jest.mock('../../stripe.ts');

it('returns 404 when order does not exist', async () => {
    const response = await request(app)
        .post('/api/payments')
        .set('Cookie', global.signin())
        .send({
            paymentMethodId: 'pm_card_visa',
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
            paymentMethodId: 'pm_card_visa',
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
            paymentMethodId: 'pm_card_visa',
            orderId: order.id
        });

    expect(response.status).toEqual(400);
});

it('creates a payment intent and records the payment with valid inputs', async () => {
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
            paymentMethodId: 'pm_card_visa',
            orderId: order.id
        });

    expect(response.status).toEqual(201);

    const intentOptions = (stripe.paymentIntents.create as jest.Mock).mock.calls[0][0];
    expect(intentOptions.payment_method).toEqual('pm_card_visa');
    expect(intentOptions.amount).toEqual(order.price * 100);
    expect(intentOptions.currency).toEqual('eur');
    expect(intentOptions.confirm).toEqual(true);

    const payment = await Payment.findOne({ orderId: order.id });
    expect(payment).not.toBeNull();
    expect(natsWrapper.client.publish).toHaveBeenCalled();
});

it('returns 200 with a client secret when the intent requires action (3DS)', async () => {
    (stripe.paymentIntents.create as jest.Mock).mockResolvedValueOnce({
        id: 'pi_requires_action',
        status: 'requires_action',
        client_secret: 'pi_secret_123',
    });

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
            paymentMethodId: 'pm_card_authenticationRequired',
            orderId: order.id
        });

    expect(response.status).toEqual(200);
    expect(response.body.requiresAction).toEqual(true);
    expect(response.body.clientSecret).toEqual('pi_secret_123');
    expect(response.body.paymentIntentId).toEqual('pi_requires_action');

    const payment = await Payment.findOne({ orderId: order.id });
    expect(payment).toBeNull();
});
