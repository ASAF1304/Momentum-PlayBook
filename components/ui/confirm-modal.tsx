'use client';

import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  title:         string;
  message?:      string;
  confirmLabel?: string;
  onConfirm:     () => void;
  onCancel:      () => void;
}

export function ConfirmModal({ title, message, confirmLabel = 'Delete', onConfirm, onCancel }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
      style={{ background: 'var(--modal-overlay)', backdropFilter: 'blur(20px) saturate(130%)', WebkitBackdropFilter: 'blur(20px) saturate(130%)' }}
      onClick={onCancel}
    >
      <div
        className="animate-modal-enter relative w-full max-w-[380px] rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-modal)] p-6 flex flex-col gap-4"
        style={{ boxShadow: 'var(--shadow-modal)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-[#FF3B5C] to-[#FF9F0A] rounded-t-2xl" />

        <div className="flex items-start gap-3 pt-1">
          <div className="w-8 h-8 rounded-lg bg-[#FF3B5C]/10 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-4 h-4 text-[#FF3B5C]" />
          </div>
          <div>
            <h3 className="text-[15px] font-extrabold tracking-tight text-[var(--text-primary)]">{title}</h3>
            {message && <p className="text-xs text-[var(--text-muted)] mt-1">{message}</p>}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-[9px] border border-[var(--border-strong)] text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-dim)] transition-all"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-5 py-2 rounded-[9px] text-xs font-extrabold uppercase tracking-wider bg-[#FF3B5C] text-white hover:brightness-110 transition-all"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
