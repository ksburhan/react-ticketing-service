import { Publisher, OrderCancelledEvent, Subjects } from '@monkeytickets/common';

export class OrderCancelledPublisher extends Publisher<OrderCancelledEvent> {
    readonly subject = Subjects.OrderCancelled;
}