import { useState } from 'react';
import Link from 'next/link';
import Router from 'next/router';
import useRequest from '../../hooks/use-request';

const SignUp = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const { doRequest, errors } = useRequest({
        url: '/api/users/signup',
        method: 'post',
        body: { email, password, username },
        onSuccess: () => Router.push('/')
    });

    const onSubmit = async (event) => {
        event.preventDefault();
        await doRequest();
    };

    return (
        <div className="mt-auth-shell">
            <div className="mt-auth-card">
                <h1>Create your account</h1>
                <p className="lead">It only takes a minute. No credit card required.</p>

                <form onSubmit={onSubmit} className="mt-form">
                    <div className="mb-3">
                        <label htmlFor="username">Username</label>
                        <input
                            id="username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="form-control"
                            placeholder="captain_guybrush"
                            autoComplete="username"
                        />
                    </div>
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
                            placeholder="At least 4 characters"
                            autoComplete="new-password"
                        />
                    </div>

                    {errors}

                    <button className="mt-btn mt-btn-primary mt-btn-block">
                        Sign up
                    </button>
                </form>

                <p className="swap">
                    Already have an account?{' '}
                    <Link href="/auth/signin">Sign in</Link>
                </p>
            </div>
        </div>
    );
};

export default SignUp;
