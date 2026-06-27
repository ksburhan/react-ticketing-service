import { useEffect, useState } from 'react';
import StripeCheckout from 'react-stripe-checkout';
import useRequest from '../../hooks/use-request';
import Router from 'next/router';

const formatPrice = (price) =>
    new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(Number(price));

const formatTime = (seconds) => {
    if (seconds <= 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
};

const OrderShow = ({ currentUser, order }) => {
    const [timeLeft, setTimeLeft] = useState(null);
    const { doRequest, errors } = useRequest({
        url: '/api/payments',
        method: 'post',
        body: { orderId: order.id },
        onSuccess: () => Router.push('/orders'),
    });

    useEffect(() => {
        const findTimeLeft = () => {
            const msLeft = new Date(order.expiresAt) - new Date();
            setTimeLeft(Math.round(msLeft / 1000));
        };

        findTimeLeft();
        const timerId = setInterval(findTimeLeft, 1000);
        return () => clearInterval(timerId);
    }, [order]);

    const expired = timeLeft !== null && timeLeft < 0;

    return (
        <div className="row justify-content-center">
            <div className="col-lg-7">
                <div className="mt-detail">
                    <p className="label">Complete your purchase</p>
                    <h1 className="title">{order.ticket.title}</h1>
                    <span className="price-tag">
                        {formatPrice(order.ticket.price)}
                        <span className="currency">USD</span>
                    </span>

                    <hr />

                    {expired ? (
                        <>
                            <span className="mt-countdown expired">Order expired</span>
                            <p
                                style={{
                                    color: 'var(--mt-muted)',
                                    marginTop: '1rem',
                                    marginBottom: 0,
                                }}
                            >
                                This reservation timed out. Head back to the marketplace to
                                pick another ticket.
                            </p>
                        </>
                    ) : (
                        <>
                            <span className="mt-countdown">
                                Time left to pay: {timeLeft === null ? '…' : formatTime(timeLeft)}
                            </span>

                            {errors}

                            <div className="d-flex justify-content-center mt-4">
                                <StripeCheckout
                                    token={({ id }) => doRequest({ token: id })}
                                    stripeKey="pk_test_51Q22MMRwMqUJwVBzfJt204TiuznP87mURo2anlgEcxdwoqW8KGvP22K6bWjQzOtTbcmxzUSMBYxSc65fKWkctsjX00Ev4B6lDD"
                                    amount={order.ticket.price * 100}
                                    email={currentUser?.email}
                                    name="Monkey Tickets"
                                    description={order.ticket.title}
                                />
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

OrderShow.getInitialProps = async (context, client) => {
    const { orderId } = context.query;
    const { data } = await client.get(`/api/orders/${orderId}`);

    return { order: data };
};

export default OrderShow;
