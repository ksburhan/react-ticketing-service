import Link from 'next/link';

const Header = ({ currentUser }) => {
    const links = [
        !currentUser && { label: 'Sign In', href: '/auth/signin' },
        !currentUser && { label: 'Sign Up', href: '/auth/signup', cta: true },
        currentUser && { label: 'My Orders', href: '/orders' },
        currentUser && { label: 'Sell Tickets', href: '/tickets/new', cta: true },
        currentUser && { label: 'Sign Out', href: '/auth/signout' },
    ]
        .filter(Boolean)
        .map(({ label, href, cta }) => (
            <li key={href} className="nav-item">
                <Link className={`nav-link${cta ? ' cta' : ''}`} href={href}>
                    {label}
                </Link>
            </li>
        ));

    return (
        <nav className="mt-navbar d-flex align-items-center justify-content-between">
            <Link className="mt-brand" href="/">
                <span className="mt-brand-mark">M</span>
                <span>Monkey Tickets</span>
            </Link>

            <ul className="nav align-items-center gap-1 mb-0">{links}</ul>
        </nav>
    );
};

export default Header;
