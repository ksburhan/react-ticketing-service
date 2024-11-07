import { Listener, Subjects, UserCreatedEvent } from "@monkeytickets/common";
import { queueGroupName } from "./queue-group-name";
import { User } from "../../models/users";

import { Message } from "node-nats-streaming";

export class UserCreatedListener extends Listener<UserCreatedEvent> {
    subject: Subjects.UserCreated = Subjects.UserCreated;
    queueGroupName = queueGroupName;

    async onMessage(data: UserCreatedEvent['data'], msg: Message) {
        const { id, username } = data;
        const user = User.build({
            id,
            username,
        });
        await user.save();

        msg.ack();
    }
}