import { PaymentCreatedEvent, Publisher, Subjects } from '@monkeytickets/common';

export class PaymentCreatedPublisher extends Publisher<PaymentCreatedEvent> {
    readonly subject = Subjects.PaymentCreated;
}