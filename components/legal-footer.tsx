import Link from 'next/link';

export function LegalFooter() {
  return (
    <footer className="mt-auto border-t border-[var(--border-subtle)] px-6 py-4">
      <nav className="flex flex-wrap justify-center gap-x-5 gap-y-1.5 text-[11px] text-[var(--text-faint)]">
        <Link href="/legal/disclaimer" className="hover:text-[var(--text-secondary)] transition-colors">
          Disclaimer
        </Link>
        <Link href="/legal/terms" className="hover:text-[var(--text-secondary)] transition-colors">
          Terms of Use
        </Link>
        <Link href="/legal/privacy" className="hover:text-[var(--text-secondary)] transition-colors">
          Privacy Policy
        </Link>
        <Link href="/legal/refund" className="hover:text-[var(--text-secondary)] transition-colors">
          Refund Policy
        </Link>
        <Link href="/pricing" className="hover:text-[var(--text-secondary)] transition-colors">
          Pricing
        </Link>
        <Link href="/billing" className="hover:text-[var(--text-secondary)] transition-colors">
          Subscription
        </Link>
        <Link href="/contact" className="hover:text-[var(--text-secondary)] transition-colors">
          Contact
        </Link>
      </nav>
    </footer>
  );
}
