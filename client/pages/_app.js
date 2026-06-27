import 'bootstrap/dist/css/bootstrap.css';
import '../styles/globals.css';
import buildClient from '../api/build-client';
import Header from '../components/Header';

const AppComponent = ({ Component, pageProps, currentUser }) => {
    return (
        <div>
            <Header currentUser={currentUser} />
            <main className="mt-page">
                <div className="container">
                    <Component currentUser={currentUser} {...pageProps} />
                </div>
            </main>
        </div>
    );
};

AppComponent.getInitialProps = async (appContext) => {
    const client = buildClient(appContext.ctx);
    const { data } = await client.get('/api/users/currentUser');

    let pageProps = {};
    if (appContext.Component.getInitialProps) {
        pageProps = await appContext.Component.getInitialProps(
            appContext.ctx,
            client,
            data.currentUser
        );
    }

    return {
        pageProps,
        ...data
    };
}

export default AppComponent;
