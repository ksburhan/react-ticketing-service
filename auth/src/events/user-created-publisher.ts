import { Publisher, Subjects, UserCreatedEvent } from '@monkeytickets/common';

export class UserCreatedPublisher extends Publisher<UserCreatedEvent> {
    readonly subject = Subjects.UserCreated;
}