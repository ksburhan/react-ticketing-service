import { OrderCreatedEvent, OrderStatus, UserCreatedEvent } from "@monkeytickets/common"
import { natsWrapper } from "../../../nats-wrapper"
import mongoose from "mongoose"
import { Message } from "node-nats-streaming"
import { UserCreatedListener } from "../user-created-listener"
import { User } from "../../../models/users"

const setup = async () => {
    const listener = new UserCreatedListener(natsWrapper.client)

    const user = User.build({
        id: '123',
        username: "testUser",
    })
    await user.save()

    const data: UserCreatedEvent['data'] = {
        id: user.id,
        username: user.username,
    }

    // @ts-ignore
    const msg: Message = {
        ack: jest.fn(),
    }

    return { listener, user, data, msg }
}

it('acks the message', async () => {
    const { listener, user, data, msg } = await setup()

    await listener.onMessage(data, msg)

    expect(msg.ack).toHaveBeenCalled()
})