import request from "supertest";

import { app } from "../../app";
import mongoose from "mongoose";
import { Order, OrderStatus } from "../../models/orders";
import { stripe } from "../../stripe";
import { Payment } from "../../models/payments";
import { natsWrapper } from "../../nats-wrapper";

jest.mock('../../stripe.ts');

const buildOrder = async (userId: string, status = OrderStatus.Created) => {
    const order = Order.build({
        id: new mongoose.Types.ObjectId().toHexString(),
        userId,
        version: 0,
        price: 20,
        status,
    });
    await order.save();
    return order;
};

it('records the payment when the intent has succeeded', async () => {
    const userId = new mongoose.Types.ObjectId().toHexString();
    const order = await buildOrder(userId);

    const response = await request(app)
        .post('/api/payments/confirm')
        .set('Cookie', global.signin(userId))
        .send({
            paymentIntentId: 'pi_succeeded',
            orderId: order.id
        });

    expect(response.status).toEqual(201);
    expect((stripe.paymentIntents.retrieve as jest.Mock)).toHaveBeenCalledWith('pi_succeeded');

    const payment = await Payment.findOne({ orderId: order.id });
    expect(payment).not.toBeNull();
    expect(natsWrapper.client.publish).toHaveBeenCalled();
});

it('returns 400 when the intent has not succeeded', async () => {
    (stripe.paymentIntents.retrieve as jest.Mock).mockResolvedValueOnce({
        id: 'pi_pending',
        status: 'requires_payment_method',
    });

    const userId = new mongoose.Types.ObjectId().toHexString();
    const order = await buildOrder(userId);

    const response = await request(app)
        .post('/api/payments/confirm')
        .set('Cookie', global.signin(userId))
        .send({
            paymentIntentId: 'pi_pending',
            orderId: order.id
        });

    expect(response.status).toEqual(400);

    const payment = await Payment.findOne({ orderId: order.id });
    expect(payment).toBeNull();
});

it('returns 401 when confirming an order of another user', async () => {
    const order = await buildOrder(new mongoose.Types.ObjectId().toHexString());

    const response = await request(app)
        .post('/api/payments/confirm')
        .set('Cookie', global.signin())
        .send({
            paymentIntentId: 'pi_succeeded',
            orderId: order.id
        });

    expect(response.status).toEqual(401);
});
