// app/opengraph-image.tsx — dynamically generated OG image (1200×630)
import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Momentum Playbook — Stage 2 Trading Journal';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0a0a0f 0%, #0f1420 50%, #0a0a0f 100%)',
          fontFamily: 'system-ui, sans-serif',
          position: 'relative',
        }}
      >
        {/* Grid lines background */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(34,211,238,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.04) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />

        {/* Logo mark */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 80,
            height: 80,
            borderRadius: 20,
            background: 'linear-gradient(135deg, #22D3EE, #10F088)',
            marginBottom: 32,
            boxShadow: '0 0 60px rgba(34,211,238,0.4)',
          }}
        >
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
            <polyline points="17 6 23 6 23 12" />
          </svg>
        </div>

        {/* Wordmark */}
        <div
          style={{
            fontSize: 64,
            fontWeight: 900,
            color: '#f4f4f5',
            letterSpacing: '-2px',
            marginBottom: 16,
            textAlign: 'center',
          }}
        >
          Momentum Playbook
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 26,
            color: 'rgba(244,244,245,0.5)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            textAlign: 'center',
          }}
        >
          Stage 2 Trading Journal · Minervini Trend Template
        </div>

        {/* Bottom accent line */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 4,
            background: 'linear-gradient(90deg, #22D3EE, #10F088)',
          }}
        />
      </div>
    ),
    { ...size },
  );
}
