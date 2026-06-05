import Link from 'next/link';

const LINKS = [
  { href: '/terms',         label: 'Terms' },
  { href: '/privacy',       label: 'Privacy' },
  { href: '/cookies',       label: 'Cookies' },
  { href: '/accessibility', label: 'Accessibility' },
  { href: '/legal/disclaimer', label: 'Disclaimer' },
  { href: '/legal/refund',  label: 'Refund Policy' },
  { href: '/pricing',       label: 'Pricing' },
  { href: '/billing',       label: 'Subscription' },
  { href: '/contact',       label: 'Contact' },
];

export function LegalFooter() {
  return (
    <footer className="mt-auto border-t border-[var(--border-subtle)] px-6 py-4">
      <nav className="flex flex-wrap justify-center gap-x-5 gap-y-1.5 text-[11px] text-[var(--text-faint)]">
        {LINKS.map(({ href, label }) => (
          <Link key={href} href={href} className="hover:text-[var(--text-secondary)] transition-colors">
            {label}
          </Link>
        ))}
      </nav>
    </footer>
  );
}
