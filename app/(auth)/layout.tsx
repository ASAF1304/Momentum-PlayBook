// app/(auth)/layout.tsx
//
// Minimal centered wrapper for login and signup pages.
// Route group (auth) keeps these pages at /login and /signup (no URL segment).

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-4 font-[Manrope,ui-sans-serif,system-ui,sans-serif]">
      <GridOverlay />
      <div className="relative z-10 w-full max-w-[400px]">
        {children}
      </div>
    </div>
  );
}

function GridOverlay() {
  return (
    <div
      className="fixed inset-0 pointer-events-none z-0 opacity-[0.18]"
      style={{
        backgroundImage:
          'linear-gradient(rgba(34,211,238,0.06) 1px, transparent 1px), ' +
          'linear-gradient(90deg, rgba(34,211,238,0.06) 1px, transparent 1px)',
        backgroundSize: '48px 48px',
        maskImage: 'radial-gradient(ellipse at top, black 30%, transparent 80%)',
        WebkitMaskImage: 'radial-gradient(ellipse at top, black 30%, transparent 80%)',
      }}
    />
  );
}
