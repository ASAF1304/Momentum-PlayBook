'use client';

export function GridOverlay() {
  return (
    <div
      className="fixed inset-0 pointer-events-none z-0"
      style={{
        backgroundImage:
          'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)',
        backgroundSize: '56px 56px',
        opacity: 0.06,
        maskImage: 'radial-gradient(ellipse at top, black 20%, transparent 75%)',
        WebkitMaskImage: 'radial-gradient(ellipse at top, black 20%, transparent 75%)',
      }}
    />
  );
}
