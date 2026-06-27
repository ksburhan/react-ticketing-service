import Router from 'next/router';
import useRequest from '../../hooks/use-request';

const formatPrice = (price) =>
    new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(Number(price));

const initial = (name) => (name ? name.charAt(0).toUpperCase() : '?');

const TicketShow = ({ ticket }) => {
    const { doRequest, errors } = useRequest({
        url: '/api/orders',
        method: 'post',
        body: { ticketId: ticket.id },
        onSuccess: (order) =>
            Router.push('/orders/[orderId]', `/orders/${order.id}`),
    });

    return (
        <div className="row justify-content-center">
            <div className="col-lg-8">
                <div className="mt-detail">
                    <p className="label">Ticket</p>
                    <h1 className="title">{ticket.title}</h1>
                    <span className="price-tag">
                        {formatPrice(ticket.price)}
                        <span className="currency">USD</span>
                    </span>

                    <hr />

                    <div className="mt-seller">
                        <span className="mt-seller-avatar">
                            {initial(ticket.owner?.username)}
                        </span>
                        <div>
                            <div className="mt-seller-name">
                                {ticket.owner?.username || 'unknown'}
                            </div>
                            <div className="mt-seller-role">Seller</div>
                        </div>
                    </div>

                    {errors}

                    <button
                        onClick={() => doRequest()}
                        className="mt-btn mt-btn-primary mt-btn-block"
                    >
                        Reserve & purchase
                    </button>
                    <p className="mt-detail-hint">
                        You&apos;ll have 15 minutes to complete payment.
                    </p>
                </div>
            </div>
        </div>
    );
};

TicketShow.getInitialProps = async (context, client) => {
    const { ticketId } = context.query;
    const { data } = await client.get(`/api/tickets/${ticketId}`);

    return { ticket: data };
};

export default TicketShow;
