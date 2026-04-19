'use client';

const COLORS = ['#22D3EE', '#10F088', '#F59E0B'] as const;

export function LoadingDots({ size = 6 }: { size?: number }) {
  return (
    <div className="flex items-center gap-1.5" aria-label="Loading">
      {COLORS.map((color, i) => (
        <span
          key={color}
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            backgroundColor: color,
            display: 'inline-block',
            animation: `pulse-dot 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
    </div>
  );
}
