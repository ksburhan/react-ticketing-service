import { useEffect, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
    Elements,
    CardElement,
    useStripe,
    useElements,
} from '@stripe/react-stripe-js';
import useRequest from '../../hooks/use-request';
import Router from 'next/router';

const STRIPE_PUBLISHABLE_KEY =
    'pk_test_51Q22MMRwMqUJwVBzfJt204TiuznP87mURo2anlgEcxdwoqW8KGvP22K6bWjQzOtTbcmxzUSMBYxSc65fKWkctsjX00Ev4B6lDD';

const stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);

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

const cardElementOptions = {
    style: {
        base: {
            color: '#1f2330',
            fontSize: '16px',
            '::placeholder': { color: '#6b7184' },
        },
        invalid: { color: '#dc2626' },
    },
};

const CheckoutForm = ({ order }) => {
    const stripe = useStripe();
    const elements = useElements();
    const [submitting, setSubmitting] = useState(false);
    const [cardError, setCardError] = useState(null);

    const { doRequest, errors } = useRequest({
        url: '/api/payments',
        method: 'post',
        body: { orderId: order.id },
    });

    const confirmRequest = useRequest({
        url: '/api/payments/confirm',
        method: 'post',
        body: { orderId: order.id },
    });

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!stripe || !elements || submitting) return;

        setSubmitting(true);
        setCardError(null);

        const { error: methodError, paymentMethod } =
            await stripe.createPaymentMethod({
                type: 'card',
                card: elements.getElement(CardElement),
            });

        if (methodError) {
            setCardError(methodError.message);
            setSubmitting(false);
            return;
        }

        const payment = await doRequest({ paymentMethodId: paymentMethod.id });
        if (!payment) {
            setSubmitting(false);
            return;
        }

        if (payment.requiresAction) {
            const { error: confirmError, paymentIntent } =
                await stripe.confirmCardPayment(payment.clientSecret);

            if (confirmError) {
                setCardError(confirmError.message);
                setSubmitting(false);
                return;
            }

            const finalized = await confirmRequest.doRequest({
                paymentIntentId: paymentIntent.id,
            });
            if (!finalized) {
                setSubmitting(false);
                return;
            }
        }

        Router.push('/orders');
    };

    return (
        <form onSubmit={handleSubmit}>
            <div
                style={{
                    padding: '0.85rem 1rem',
                    border: '1px solid var(--mt-border, #e5e7eb)',
                    borderRadius: '8px',
                    background: 'var(--mt-surface, #ffffff)',
                    marginBottom: '1rem',
                }}
            >
                <CardElement options={cardElementOptions} />
            </div>

            {cardError && (
                <div className="mt-alert">
                    <h4>Something went wrong</h4>
                    <ul>
                        <li>{cardError}</li>
                    </ul>
                </div>
            )}
            {errors}
            {confirmRequest.errors}

            <button
                type="submit"
                className="btn btn-primary w-100"
                disabled={!stripe || submitting}
            >
                {submitting
                    ? 'Processing…'
                    : `Pay ${formatPrice(order.ticket.price)}`}
            </button>
        </form>
    );
};

const OrderShow = ({ order }) => {
    const [timeLeft, setTimeLeft] = useState(null);

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

                            <div className="mt-4">
                                <Elements stripe={stripePromise}>
                                    <CheckoutForm order={order} />
                                </Elements>
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
