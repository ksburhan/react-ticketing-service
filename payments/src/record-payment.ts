import { Payment } from './models/payments';
import { PaymentCreatedPublisher } from './events/publishers/payment-created-publisher';
import { natsWrapper } from './nats-wrapper';

export const recordPayment = async (orderId: string, stripeId: string) => {
    const payment = Payment.build({ orderId, stripeId });
    await payment.save();

    await new PaymentCreatedPublisher(natsWrapper.client).publish({
        id: payment.id,
        orderId: payment.orderId,
        stripeId: payment.stripeId,
    });

    return payment;
};
