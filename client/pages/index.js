import Link from 'next/link';

const formatPrice = (price) =>
    new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(Number(price));

const initial = (name) => (name ? name.charAt(0).toUpperCase() : '?');

const LandingPage = ({ currentUser, tickets }) => {
    const hasTickets = tickets && tickets.length > 0;

    return (
        <div>
            <div className="mt-page-header">
                <div>
                    <h1>Tickets to Monkey Island</h1>
                    <p className="subtitle">
                        Browse tickets currently for sale. Click one to reserve and pay.
                    </p>
                </div>
                {currentUser && (
                    <Link href="/tickets/new" className="mt-btn mt-btn-primary">
                        + Sell a ticket
                    </Link>
                )}
            </div>

            {hasTickets ? (
                <div className="mt-ticket-grid">
                    {tickets.map((ticket) => (
                        <div key={ticket.id} className="mt-ticket-card">
                            <p className="title">{ticket.title}</p>
                            <span className="price">{formatPrice(ticket.price)}</span>
                            <span className="owner">
                                <span className="owner-avatar">
                                    {initial(ticket.owner?.username)}
                                </span>
                                Sold by {ticket.owner?.username || 'unknown'}
                            </span>
                            <div className="actions">
                                <Link
                                    href="/tickets/[ticketId]"
                                    as={`/tickets/${ticket.id}`}
                                    className="mt-btn mt-btn-primary mt-btn-block text-center"
                                >
                                    View ticket
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="mt-empty">
                    <h3>No tickets yet</h3>
                    <p className="mb-3">Be the first to list one for sale.</p>
                    {currentUser ? (
                        <Link href="/tickets/new" className="mt-btn mt-btn-primary">
                            Sell a ticket
                        </Link>
                    ) : (
                        <Link href="/auth/signup" className="mt-btn mt-btn-primary">
                            Create an account
                        </Link>
                    )}
                </div>
            )}
        </div>
    );
};

LandingPage.getInitialProps = async (context, client, currentUser) => {
    const { data } = await client.get('/api/tickets');

    return { tickets: data };
};

export default LandingPage;
