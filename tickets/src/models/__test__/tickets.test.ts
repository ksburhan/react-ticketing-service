import { Ticket } from "../tickets";
import { User } from "../users";

it('implements optimistic concurrency control', async () => {

    const user = User.build({
        id: '123',
        username: 'testUser'
    })
    // Create instance of ticket
    const ticket = Ticket.build({
        title: 'concert',
        price: 20,
        owner: user,
    });

    // Save the ticket to the database
    await ticket.save();

    // fetch the ticket twice
    const firstInstance = await Ticket.findById(ticket.id);
    const secondInstance = await Ticket.findById(ticket.id);

    // make two seperate changes to the tickets we fetched
    firstInstance!.set({ price: 10 });
    secondInstance!.set({ price: 15 });

    // save the first fetched ticket
    await firstInstance!.save();

    // save the second fetched ticket and expect an error
    try {
        await secondInstance!.save();
    } catch (err) {
        return;
    }

    throw new Error('Should not reach this point');
});

it('increments the version number on multiple saves', async () => {
    const user = User.build({
        id: '123',
        username: 'testUser'
    })

    const ticket = Ticket.build({
        title: 'concert',
        price: 20,
        owner: user
    });

    await ticket.save();
    expect(ticket.version).toEqual(0);
    await ticket.save();
    expect(ticket.version).toEqual(1);
    await ticket.save();
    expect(ticket.version).toEqual(2);
});