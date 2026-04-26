// app/blocked/page.tsx
// Shown when subscription.status = 'blocked'.

export default function BlockedPage() {
  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-6
                 font-[Manrope,ui-sans-serif,system-ui,sans-serif]"
    >
      <div className="max-w-[420px] w-full rounded-2xl border border-[#FF3B5C]/30 bg-[var(--bg-surface)] p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-[#FF3B5C]/10 flex items-center justify-center mx-auto">
          <svg className="w-6 h-6 text-[#FF3B5C]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
          </svg>
        </div>
        <h1 className="text-xl font-extrabold text-[var(--text-primary)]">החשבון הושעה</h1>
        <p className="text-sm text-[var(--text-muted)] leading-relaxed">
          החשבון שלך הושעה. אם אתה חושב שזה טעות, פנה לנו בכתובת{' '}
          <a
            href="mailto:asaf.abllin@gmail.com"
            className="text-[#22D3EE] underline underline-offset-2 hover:brightness-125 transition"
          >
            asaf.abllin@gmail.com
          </a>
        </p>
        <a
          href="/login"
          className="inline-block mt-2 text-xs text-[var(--text-faint)] hover:text-[var(--text-muted)] transition"
        >
          ← חזרה להתחברות
        </a>
      </div>
    </div>
  );
}
