'use client';

import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { Loader2, Upload, X } from 'lucide-react';
import { supabase, type AsafThought } from '@/lib/supabase-client';

interface Props {
  existing: AsafThought | null;
  onClose:  () => void;
  onSaved:  () => void;
}

export function AddThoughtModal({ existing, onClose, onSaved }: Props) {
  const [mounted,   setMounted]   = useState(false);
  const [ticker,    setTicker]    = useState(existing?.ticker    ?? '');
  const [notes,     setNotes]     = useState(existing?.notes     ?? '');
  const [imageUrl,  setImageUrl]  = useState(existing?.image_url ?? '');
  const [uploading, setUploading] = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const fileRef     = useRef<HTMLInputElement>(null);

  useEffect(() => { setMounted(true); }, []);

  const deleteStorageFile = async (url: string) => {
    const path = url.split('/thoughts-images/')[1];
    if (path) await supabase.storage.from('thoughts-images').remove([path]);
  };

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    // Remove old image from Storage before uploading new one
    if (imageUrl) await deleteStorageFile(imageUrl);
    const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from('thoughts-images')
      .upload(path, file, { upsert: true });
    if (upErr) { setError(upErr.message); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from('thoughts-images').getPublicUrl(path);
    setImageUrl(urlData.publicUrl);
    setUploading(false);
  };

  const handleRemoveImage = async () => {
    if (imageUrl) await deleteStorageFile(imageUrl);
    setImageUrl('');
  };

  const handleSave = async () => {
    if (!ticker.trim()) { setError('Ticker is required.'); return; }
    setSaving(true);
    setError(null);

    const payload = {
      ticker:    ticker.trim().toUpperCase(),
      notes:     notes.trim() || null,
      image_url: imageUrl || null,
      updated_at: new Date().toISOString(),
    };

    const { error: dbErr } = existing
      ? await supabase.from('asaf_thoughts').update(payload).eq('id', existing.id)
      : await supabase.from('asaf_thoughts').insert(payload);

    if (dbErr) { setError(dbErr.message); setSaving(false); return; }
    onSaved();
  };

  if (!mounted) return null;

  return createPortal(
    <div
      ref={backdropRef}
      onClick={e => { if (e.target === backdropRef.current) onClose(); }}
      className="fixed inset-0 z-[9999] flex items-center justify-center px-4 py-6"
      style={{ background: 'var(--modal-overlay)', backdropFilter: 'blur(20px) saturate(130%)', WebkitBackdropFilter: 'blur(20px) saturate(130%)' }}
    >
      <div
        className="animate-modal-enter relative w-full max-w-[520px] rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-modal)] flex flex-col max-h-[90vh] overflow-hidden"
        style={{ boxShadow: 'var(--shadow-modal)' }}
      >
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-[#10F088] to-[#22D3EE] z-10" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-6 pb-4 border-b border-[var(--border-subtle)] flex-shrink-0">
          <h2 className="text-[17px] font-extrabold tracking-tight text-[var(--text-primary)]">
            {existing ? 'Edit Thought' : 'New Thought'}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-dim)] hover:bg-[var(--bg-elevated)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 flex flex-col gap-4">
          {/* Ticker */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs uppercase tracking-[0.14em] font-semibold text-[var(--text-secondary)]">
              Ticker <span className="text-[#FF3B5C]">*</span>
            </label>
            <input
              type="text"
              value={ticker}
              onChange={e => setTicker(e.target.value.toUpperCase())}
              placeholder="AAPL"
              className="bg-[var(--bg-input)] border border-[var(--border-dim)] rounded-[8px] px-3 py-2.5 text-[15px] font-mono font-bold text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[#10F088] focus:ring-[3px] focus:ring-[#10F088]/15 transition"
            />
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs uppercase tracking-[0.14em] font-semibold text-[var(--text-secondary)]">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={6}
              placeholder="Write your analysis, thesis, or watchlist observations..."
              className="bg-[var(--bg-input)] border border-[var(--border-dim)] rounded-[8px] px-3 py-2.5 text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[#10F088] focus:ring-[3px] focus:ring-[#10F088]/15 transition resize-none leading-relaxed"
            />
          </div>

          {/* Image upload */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs uppercase tracking-[0.14em] font-semibold text-[var(--text-secondary)]">
              Chart Image
            </label>
            {imageUrl ? (
              <div className="relative rounded-[8px] overflow-hidden border border-[var(--border-subtle)]">
                <img src={imageUrl} alt="Chart preview" className="w-full object-cover max-h-52" />
                <button
                  onClick={() => void handleRemoveImage()}
                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition"
                  aria-label="Remove image"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="w-full rounded-[8px] border-2 border-dashed border-[var(--border-strong)] py-8 flex flex-col items-center gap-2 text-[var(--text-muted)] hover:border-[#10F088]/50 hover:text-[#10F088] transition-colors disabled:opacity-50"
              >
                {uploading
                  ? <Loader2 className="w-5 h-5 animate-spin" />
                  : <Upload className="w-5 h-5" />}
                <span className="text-xs font-semibold">
                  {uploading ? 'Uploading…' : 'Click to upload chart'}
                </span>
                <span className="text-[10px] text-[var(--text-faint)]">PNG, JPG, WEBP — max 5 MB</span>
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".png,.jpg,.jpeg,.webp"
              className="sr-only"
              onChange={e => { const f = e.target.files?.[0]; if (f) void handleImageUpload(f); e.target.value = ''; }}
            />
          </div>

          {error && (
            <div className="px-3 py-2.5 rounded-[8px] bg-[#FF3B5C]/[0.07] border border-[#FF3B5C]/25 text-xs text-[#FF3B5C]">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[var(--border-subtle)] flex items-center justify-end gap-2.5 flex-shrink-0 bg-[var(--bg-modal)]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-[9px] border border-[var(--border-strong)] text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-dim)] transition-all"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={saving || uploading}
            className="px-5 py-2 rounded-[9px] text-xs font-extrabold uppercase tracking-wider bg-gradient-to-br from-[#10F088] to-[#22D3EE] text-black hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {saving ? 'Saving…' : existing ? 'Save Changes' : 'Publish'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
