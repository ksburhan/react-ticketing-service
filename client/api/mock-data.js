// In-memory mock data for running the frontend without the backend.
// Activated by build-client.js when NEXT_PUBLIC_USE_MOCKS=1.

const mockUser = {
    id: 'u-demo',
    email: 'guybrush@monkeytickets.dev',
    username: 'guybrush',
};

const tickets = [
    {
        id: 't-1',
        title: 'Monkey Island Premiere — Front Row',
        price: 250,
        owner: { id: 'u-1', username: 'guybrush' },
        version: 0,
    },
    {
        id: 't-2',
        title: "LeChuck's Revenge — VIP Box",
        price: 475,
        owner: { id: 'u-2', username: 'elaine' },
        version: 0,
    },
    {
        id: 't-3',
        title: 'Curse of Monkey Island — Balcony',
        price: 80,
        owner: { id: 'u-3', username: 'stan' },
        version: 0,
    },
    {
        id: 't-4',
        title: 'Tales of Monkey Island — Mid Tier',
        price: 145,
        owner: { id: 'u-4', username: 'murray' },
        version: 0,
    },
    {
        id: 't-5',
        title: 'Escape from Monkey Island — Standing',
        price: 60,
        owner: { id: 'u-2', username: 'elaine' },
        version: 0,
    },
    {
        id: 't-6',
        title: 'Secret of Monkey Island — Pit',
        price: 35,
        owner: { id: 'u-3', username: 'stan' },
        version: 0,
    },
];

const orders = [];

let currentUser =
    process.env.NEXT_PUBLIC_MOCK_SIGNED_OUT === '1' ? null : { ...mockUser };

const findTicket = (id) => tickets.find((t) => t.id === id);
const findOrder = (id) => orders.find((o) => o.id === id);

const handlers = [
    {
        method: 'get',
        pattern: /\/api\/users\/currentUser$/,
        handle: () => ({ currentUser }),
    },
    {
        method: 'post',
        pattern: /\/api\/users\/signup$/,
        handle: (_, body) => {
            currentUser = {
                id: 'u-demo',
                email: body.email || mockUser.email,
                username: body.username || mockUser.username,
            };
            return currentUser;
        },
    },
    {
        method: 'post',
        pattern: /\/api\/users\/signin$/,
        handle: (_, body) => {
            currentUser = {
                ...mockUser,
                email: body.email || mockUser.email,
            };
            return currentUser;
        },
    },
    {
        method: 'post',
        pattern: /\/api\/users\/signout$/,
        handle: () => {
            currentUser = null;
            return {};
        },
    },
    {
        method: 'get',
        pattern: /\/api\/tickets$/,
        handle: () => tickets,
    },
    {
        method: 'get',
        pattern: /\/api\/tickets\/([^/?]+)$/,
        handle: ([id]) => findTicket(id) || tickets[0],
    },
    {
        method: 'post',
        pattern: /\/api\/tickets$/,
        handle: (_, body) => {
            const ticket = {
                id: `t-${tickets.length + 1}-${Date.now()}`,
                title: body.title,
                price: Number(body.price),
                owner: currentUser
                    ? { id: currentUser.id, username: currentUser.username }
                    : { id: 'u-demo', username: 'guybrush' },
                version: 0,
            };
            tickets.unshift(ticket);
            return ticket;
        },
    },
    {
        method: 'get',
        pattern: /\/api\/orders$/,
        handle: () => orders,
    },
    {
        method: 'get',
        pattern: /\/api\/orders\/([^/?]+)$/,
        handle: ([id]) => findOrder(id) || orders[0],
    },
    {
        method: 'post',
        pattern: /\/api\/orders$/,
        handle: (_, body) => {
            const ticket = findTicket(body.ticketId) || tickets[0];
            const order = {
                id: `o-${Date.now()}`,
                status: 'created',
                expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
                ticket,
                userId: currentUser ? currentUser.id : 'u-demo',
            };
            orders.push(order);
            return order;
        },
    },
    {
        method: 'post',
        pattern: /\/api\/payments$/,
        handle: (_, body) => {
            const order = findOrder(body.orderId);
            if (order) order.status = 'complete';
            return { id: `p-${Date.now()}` };
        },
    },
];

export const handleMockRequest = (config) => {
    const method = (config.method || 'get').toLowerCase();
    const url = config.url || '';
    let body = {};
    if (config.data) {
        body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
    }

    for (const handler of handlers) {
        if (handler.method !== method) continue;
        const match = url.match(handler.pattern);
        if (match) {
            return handler.handle(match.slice(1), body);
        }
    }

    // Unmatched: return empty so the UI doesn't crash.
    console.warn(`[mock] no handler for ${method.toUpperCase()} ${url}`);
    return null;
};
