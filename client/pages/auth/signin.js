import { useState } from 'react';
import Link from 'next/link';
import Router from 'next/router';
import useRequest from '../../hooks/use-request';

const SignIn = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const { doRequest, errors } = useRequest({
        url: '/api/users/signin',
        method: 'post',
        body: { email, password },
        onSuccess: () => Router.push('/')
    });

    const onSubmit = async (event) => {
        event.preventDefault();
        await doRequest();
    };

    return (
        <div className="mt-auth-shell">
            <div className="mt-auth-card">
                <h1>Welcome back</h1>
                <p className="lead">Sign in to buy and sell Monkey Island tickets.</p>

                <form onSubmit={onSubmit} className="mt-form">
                    <div className="mb-3">
                        <label htmlFor="email">Email address</label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="form-control"
                            placeholder="you@example.com"
                            autoComplete="email"
                        />
                    </div>
                    <div className="mb-3">
                        <label htmlFor="password">Password</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="form-control"
                            placeholder="••••••••"
                            autoComplete="current-password"
                        />
                    </div>

                    {errors}

                    <button className="mt-btn mt-btn-primary mt-btn-block">
                        Sign in
                    </button>
                </form>

                <p className="swap">
                    Don&apos;t have an account?{' '}
                    <Link href="/auth/signup">Create one</Link>
                </p>
            </div>
        </div>
    );
};

export default SignIn;
