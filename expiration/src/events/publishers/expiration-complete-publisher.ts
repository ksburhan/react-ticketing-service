import { Publisher, Subjects, ExpirationCompleteEvent } from '@monkeytickets/common';

export class ExpirationCompletePublisher extends Publisher<ExpirationCompleteEvent> {
    readonly subject = Subjects.ExpirationComplete;
}