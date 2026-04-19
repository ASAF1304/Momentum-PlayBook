// lib/toast.ts
//
// Simple, framework-free toast helper — no external deps.
// Used for "feature pending" notifications across the app.

'use client';

export type ToastVariant = 'info' | 'success' | 'warning' | 'error';

interface ToastOptions {
  title: string;
  body?: string;
  variant?: ToastVariant;
  durationMs?: number;
}

const PALETTES: Record<ToastVariant, { bg: string; border: string; text: string; accent: string }> = {
  info:    { bg: 'rgba(34,211,238,0.08)',  border: 'rgba(34,211,238,0.35)',  text: '#e5e7eb', accent: '#22D3EE' },
  success: { bg: 'rgba(16,240,136,0.08)',  border: 'rgba(16,240,136,0.35)',  text: '#e5e7eb', accent: '#10F088' },
  warning: { bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.35)',  text: '#e5e7eb', accent: '#f59e0b' },
  error:   { bg: 'rgba(255,59,92,0.08)',   border: 'rgba(255,59,92,0.35)',   text: '#e5e7eb', accent: '#FF3B5C' },
};

let container: HTMLDivElement | null = null;

function ensureContainer(): HTMLDivElement {
  if (typeof document === 'undefined') return null as unknown as HTMLDivElement;
  if (container && document.body.contains(container)) return container;
  container = document.createElement('div');
  container.setAttribute('data-toast-root', '');
  container.style.cssText = [
    'position:fixed',
    'top:20px',
    'right:20px',
    'display:flex',
    'flex-direction:column',
    'gap:10px',
    'z-index:99999',
    'max-width:380px',
    'pointer-events:none',
  ].join(';');
  document.body.appendChild(container);
  return container;
}

export function toast({ title, body, variant = 'info', durationMs = 3800 }: ToastOptions) {
  if (typeof document === 'undefined') return;
  const root = ensureContainer();
  const p = PALETTES[variant];

  const el = document.createElement('div');
  el.style.cssText = [
    `background:${p.bg}`,
    `border:1px solid ${p.border}`,
    'border-radius:12px',
    'padding:12px 14px',
    `color:${p.text}`,
    'font-family:"Manrope",ui-sans-serif,system-ui,sans-serif',
    'font-size:13px',
    'backdrop-filter:blur(10px)',
    '-webkit-backdrop-filter:blur(10px)',
    'box-shadow:0 10px 30px rgba(0,0,0,0.35)',
    'pointer-events:auto',
    'opacity:0',
    'transform:translateX(12px)',
    'transition:opacity 180ms ease, transform 180ms ease',
  ].join(';');

  el.innerHTML = `
    <div style="display:flex;align-items:flex-start;gap:10px">
      <span style="width:8px;height:8px;border-radius:50%;background:${p.accent};margin-top:6px;flex-shrink:0;box-shadow:0 0 10px ${p.accent}"></span>
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;letter-spacing:-0.01em;line-height:1.3">${escapeHtml(title)}</div>
        ${body ? `<div style="font-size:12px;color:#a1a1aa;margin-top:4px;line-height:1.45">${escapeHtml(body)}</div>` : ''}
      </div>
    </div>
  `;
  root.appendChild(el);

  requestAnimationFrame(() => {
    el.style.opacity = '1';
    el.style.transform = 'translateX(0)';
  });

  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(12px)';
    setTimeout(() => el.remove(), 220);
  }, durationMs);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
