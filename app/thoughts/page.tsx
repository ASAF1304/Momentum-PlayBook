'use client';

import { useCallback, useEffect, useState } from 'react';
import { Brain, Edit2, Plus, Trash2, X, ZoomIn } from 'lucide-react';
import { AppNav } from '@/components/nav/app-nav';
import { GridOverlay } from '@/components/ui/grid-overlay';
import { AddThoughtModal } from '@/components/thoughts/add-thought-modal';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { supabase, type AsafThought } from '@/lib/supabase-client';
import { useAuth } from '@/lib/auth-context';
import { toast } from '@/lib/toast';

const THOUGHTS_ADMIN_EMAIL = 'asaf.abllin@gmail.com';

export default function ThoughtsPage() {
  const { user } = useAuth();
  const isAdmin = user?.email?.toLowerCase() === THOUGHTS_ADMIN_EMAIL;

  const [thoughts,       setThoughts]       = useState<AsafThought[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [modalOpen,      setModalOpen]      = useState(false);
  const [editing,        setEditing]        = useState<AsafThought | null>(null);
  const [lightbox,       setLightbox]       = useState<string | null>(null);
  const [deleteTarget,   setDeleteTarget]   = useState<AsafThought | null>(null);

  const fetchThoughts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('asaf_thoughts')
      .select('*')
      .order('updated_at', { ascending: false });
    if (!error) setThoughts((data as AsafThought[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void fetchThoughts(); }, [fetchThoughts]);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const thought = deleteTarget;
    setDeleteTarget(null);

    // Remove image from Storage before deleting the DB row
    if (thought.image_url) {
      const path = thought.image_url.split('/thoughts-images/')[1];
      if (path) await supabase.storage.from('thoughts-images').remove([path]);
    }

    const { error } = await supabase.from('asaf_thoughts').delete().eq('id', thought.id);
    if (error) { toast({ title: error.message, variant: 'error' }); return; }
    toast({ title: `${thought.ticker} deleted`, variant: 'success' });
    setThoughts(prev => prev.filter(t => t.id !== thought.id));
  };

  const openEdit = (thought: AsafThought) => {
    setEditing(thought);
    setModalOpen(true);
  };

  const handleSaved = () => {
    setModalOpen(false);
    setEditing(null);
    void fetchThoughts();
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] font-[Manrope,ui-sans-serif,system-ui,sans-serif]">
      <AppNav />
      <GridOverlay />

      <main className="relative z-10 max-w-[1400px] mx-auto px-6 py-10">

        {/* Page header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#10F088] to-[#22D3EE] flex items-center justify-center">
              <Brain className="w-4 h-4 text-black" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-[22px] font-extrabold tracking-tight text-[var(--text-primary)] leading-none">
                Asaf&apos;s Thoughts
              </h1>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Market analysis, watchlist observations, and trade ideas
              </p>
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-24">
            <div className="w-6 h-6 rounded-full border-2 border-[#10F088] border-t-transparent animate-spin" />
          </div>
        )}

        {/* Empty state */}
        {!loading && thoughts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Brain className="w-10 h-10 text-[var(--text-faint)]" strokeWidth={1.5} />
            <p className="text-sm text-[var(--text-muted)]">No thoughts yet</p>
            {isAdmin && (
              <button
                onClick={() => { setEditing(null); setModalOpen(true); }}
                className="mt-2 px-4 py-2 rounded-[9px] text-xs font-extrabold uppercase tracking-wider bg-gradient-to-br from-[#10F088] to-[#22D3EE] text-black hover:brightness-110 transition-all"
              >
                Add first thought
              </button>
            )}
          </div>
        )}

        {/* Card grid */}
        {!loading && thoughts.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {thoughts.map(thought => (
              <ThoughtCard
                key={thought.id}
                thought={thought}
                isAdmin={isAdmin}
                onEdit={openEdit}
                onDelete={t => setDeleteTarget(t)}
                onImageClick={url => setLightbox(url)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Admin FAB */}
      {isAdmin && !loading && thoughts.length > 0 && (
        <button
          onClick={() => { setEditing(null); setModalOpen(true); }}
          className="fixed bottom-8 right-8 w-12 h-12 rounded-full bg-gradient-to-br from-[#10F088] to-[#22D3EE] flex items-center justify-center text-black shadow-[0_4px_20px_rgba(16,240,136,0.4)] hover:brightness-110 hover:scale-105 transition-all z-30"
          aria-label="Add thought"
        >
          <Plus className="w-5 h-5" strokeWidth={2.5} />
        </button>
      )}

      {/* Add / Edit modal */}
      {modalOpen && (
        <AddThoughtModal
          existing={editing}
          onClose={() => { setModalOpen(false); setEditing(null); }}
          onSaved={handleSaved}
        />
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <ConfirmModal
          title={`Delete ${deleteTarget.ticker}?`}
          message="The image will also be removed from storage. This cannot be undone."
          confirmLabel="Delete"
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Image lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(8px)' }}
          onClick={() => setLightbox(null)}
        >
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-5 right-5 w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition"
            aria-label="Close image"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={lightbox}
            alt="Chart"
            className="max-w-full max-h-[90vh] rounded-xl object-contain"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

// ── ThoughtCard ────────────────────────────────────────────────────────────────

interface ThoughtCardProps {
  thought:      AsafThought;
  isAdmin:      boolean;
  onEdit:       (t: AsafThought) => void;
  onDelete:     (t: AsafThought) => void;
  onImageClick: (url: string) => void;
}

function ThoughtCard({ thought, isAdmin, onEdit, onDelete, onImageClick }: ThoughtCardProps) {
  const date = new Date(thought.updated_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  return (
    <div className="group relative rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden flex flex-col hover:border-[var(--border-strong)] transition-colors">
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-[#10F088] to-[#22D3EE] opacity-0 group-hover:opacity-100 transition-opacity" />

      {/* Chart image */}
      {thought.image_url && (
        <div
          className="relative cursor-zoom-in overflow-hidden"
          onClick={() => onImageClick(thought.image_url!)}
        >
          <img
            src={thought.image_url}
            alt={`${thought.ticker} chart`}
            className="w-full object-cover max-h-44 group-hover:scale-[1.02] transition-transform duration-300"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
            <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-80 transition-opacity" />
          </div>
        </div>
      )}

      {/* Body */}
      <div className="p-4 flex flex-col gap-3 flex-1">
        <div className="flex items-start justify-between gap-2">
          <span className="text-[17px] font-extrabold tracking-tight font-mono text-[var(--text-primary)]">
            ${thought.ticker}
          </span>
          <span className="text-[10px] text-[var(--text-faint)] mt-0.5 shrink-0">{date}</span>
        </div>

        {thought.notes ? (
          <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap flex-1">
            {thought.notes}
          </p>
        ) : (
          <p className="text-[13px] text-[var(--text-faint)] italic flex-1">No notes</p>
        )}
      </div>

      {/* Admin controls */}
      {isAdmin && (
        <div className="absolute top-3 right-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={e => { e.stopPropagation(); onEdit(thought); }}
            className="w-7 h-7 rounded-lg bg-[var(--bg-modal)]/90 border border-[var(--border-strong)] flex items-center justify-center text-[var(--text-muted)] hover:text-[#22D3EE] transition-colors backdrop-blur-sm"
            aria-label={`Edit ${thought.ticker}`}
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete(thought); }}
            className="w-7 h-7 rounded-lg bg-[var(--bg-modal)]/90 border border-[var(--border-strong)] flex items-center justify-center text-[var(--text-muted)] hover:text-[#FF3B5C] transition-colors backdrop-blur-sm"
            aria-label={`Delete ${thought.ticker}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
