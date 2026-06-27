import Link from 'next/link';

const formatPrice = (price) =>
    new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(Number(price));

const STATUS_LABELS = {
    'created': 'Created',
    'awaiting:payment': 'Awaiting payment',
    'complete': 'Complete',
    'cancelled': 'Cancelled',
};

const StatusBadge = ({ status }) => (
    <span className={`mt-badge mt-badge-${status}`}>
        <span className="mt-badge-dot" />
        {STATUS_LABELS[status] || status}
    </span>
);

const OrderIndex = ({ orders }) => {
    if (!orders || orders.length === 0) {
        return (
            <div>
                <div className="mt-page-header">
                    <div>
                        <h1>Your orders</h1>
                        <p className="subtitle">
                            Reservations and purchases will show up here.
                        </p>
                    </div>
                </div>
                <div className="mt-empty">
                    <h3>No orders yet</h3>
                    <p className="mb-3">
                        Browse the marketplace and reserve a ticket to get started.
                    </p>
                    <Link href="/" className="mt-btn mt-btn-primary">
                        Browse tickets
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div>
            <div className="mt-page-header">
                <div>
                    <h1>Your orders</h1>
                    <p className="subtitle">
                        Reservations and purchases will show up here.
                    </p>
                </div>
            </div>

            <div className="mt-order-list">
                {orders.map((order) => (
                    <div key={order.id} className="mt-order-row">
                        <div className="meta">
                            <span className="title">{order.ticket.title}</span>
                            <span className="sub">
                                {formatPrice(order.ticket.price)} · seller{' '}
                                {order.ticket.owner?.username || 'unknown'}
                            </span>
                        </div>
                        <div className="d-flex align-items-center gap-3">
                            <StatusBadge status={order.status} />
                            {order.status !== 'complete' && order.status !== 'cancelled' && (
                                <Link
                                    href="/orders/[orderId]"
                                    as={`/orders/${order.id}`}
                                    className="mt-btn mt-btn-primary"
                                >
                                    View
                                </Link>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

OrderIndex.getInitialProps = async (context, client) => {
    const { data } = await client.get('/api/orders');

    return { orders: data };
};

export default OrderIndex;
