import Link from 'next/link';

export function LegalFooter() {
  return (
    <footer className="mt-auto border-t border-[var(--border-subtle)] px-6 py-4">
      <nav className="flex flex-wrap justify-center gap-x-5 gap-y-1.5 text-[11px] text-[var(--text-faint)]">
        <Link href="/legal/disclaimer" className="hover:text-[var(--text-secondary)] transition-colors">
          כתב ויתור
        </Link>
        <Link href="/legal/terms" className="hover:text-[var(--text-secondary)] transition-colors">
          תנאי שימוש
        </Link>
        <Link href="/legal/privacy" className="hover:text-[var(--text-secondary)] transition-colors">
          מדיניות פרטיות
        </Link>
        <Link href="/billing" className="hover:text-[var(--text-secondary)] transition-colors">
          מנוי
        </Link>
      </nav>
    </footer>
  );
}
