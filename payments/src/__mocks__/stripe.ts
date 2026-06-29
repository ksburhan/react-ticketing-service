export const stripe = {
    paymentIntents: {
        create: jest
            .fn()
            .mockResolvedValue({
                id: 'test_pi',
                status: 'succeeded',
                client_secret: 'test_secret',
            }),
        retrieve: jest
            .fn()
            .mockResolvedValue({
                id: 'test_pi',
                status: 'succeeded',
            }),
    },
};
