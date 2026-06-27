import { useState } from 'react';
import Router from 'next/router';
import useRequest from '../../hooks/use-request';

const NewTicket = () => {
    const [title, setTitle] = useState('');
    const [price, setPrice] = useState('');
    const { doRequest, errors } = useRequest({
        url: '/api/tickets',
        method: 'post',
        body: { title, price },
        onSuccess: () => Router.push('/'),
    });

    const onSubmit = (event) => {
        event.preventDefault();
        doRequest();
    };

    const onBlur = () => {
        const value = parseFloat(price);
        if (isNaN(value)) return;
        setPrice(value.toFixed(2));
    };

    return (
        <div className="mt-auth-shell">
            <div className="mt-auth-card">
                <h1>List a ticket</h1>
                <p className="lead">
                    Set a title and price. Buyers can reserve your ticket for 15 minutes
                    before paying.
                </p>

                <form onSubmit={onSubmit} className="mt-form">
                    <div className="mb-3">
                        <label htmlFor="title">Title</label>
                        <input
                            id="title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="form-control"
                            placeholder="e.g. Front-row, opening night"
                        />
                    </div>
                    <div className="mb-3">
                        <label htmlFor="price">Price</label>
                        <div className="input-group">
                            <span className="input-group-text">$</span>
                            <input
                                id="price"
                                value={price}
                                onBlur={onBlur}
                                onChange={(e) => setPrice(e.target.value)}
                                className="form-control"
                                placeholder="0.00"
                                inputMode="decimal"
                            />
                        </div>
                    </div>

                    {errors}

                    <button className="mt-btn mt-btn-primary mt-btn-block">
                        List ticket
                    </button>
                </form>
            </div>
        </div>
    );
};

export default NewTicket;
