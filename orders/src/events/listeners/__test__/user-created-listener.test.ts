import { UserCreatedEvent } from "@monkeytickets/common"
import { natsWrapper } from "../../../nats-wrapper"
import { Message } from "node-nats-streaming"
import { UserCreatedListener } from "../user-created-listener"
import { User } from "../../../models/users"
import mongoose from "mongoose"

const setup = async () => {
    const listener = new UserCreatedListener(natsWrapper.client)

    const data: UserCreatedEvent['data'] = {
        id: new mongoose.Types.ObjectId().toHexString(),
        username: 'testUser',
    }

    // @ts-ignore
    const msg: Message = {
        ack: jest.fn(),
    }

    return { listener, data, msg }
}

it('acks the message', async () => {
    const { listener, data, msg } = await setup()

    await listener.onMessage(data, msg)

    expect(msg.ack).toHaveBeenCalled()
})

it('creates a user', async () => {
    const { listener, data, msg } = await setup()

    await listener.onMessage(data, msg)

    const user = await User.findById(data.id)

    expect(user).toBeDefined();
    expect(user!!.id).toEqual(data.id);
    expect(user!!.username).toEqual(data.username);
})