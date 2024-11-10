import Link from 'next/link';

const OrderIndex = ({ orders }) => {
    return <ul>
        {orders.map(order => {
            console.log(order)
            return <li key={order.id}>
                {order.ticket.title} - {order.ticket.price} - {order.status} Owner: {order.ticket.owner.username}
                {order.status != "complete" &&
                    <Link href='/orders/[orderId]' as={`/orders/${order.id}`}>
                        View
                    </Link>
                }
            </li>
        })}
    </ul>
};

OrderIndex.getInitialProps = async (context, client) => {
    const { data } = await client.get('/api/orders');

    return { orders: data };
};

export default OrderIndex;