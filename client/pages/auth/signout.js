import { useEffect } from 'react';
import Router from 'next/router';
import useRequest from '../../hooks/use-request';

const SignOut = () => {
    const { doRequest } = useRequest({
        url: '/api/users/signout',
        method: 'post',
        body: {},
        onSuccess: () => Router.push('/')
    });

    useEffect(() => {
        doRequest();
    }, []);

    return (
        <div className="mt-auth-shell">
            <div className="mt-auth-card text-center">
                <div className="d-flex justify-content-center mb-3">
                    <div className="mt-spinner" />
                </div>
                <h1>Signing you out…</h1>
                <p className="lead mb-0">See you next time.</p>
            </div>
        </div>
    );
};

export default SignOut;
