// components/dashboard/daily-touchpoints.tsx
//
// Pillar 3 (Daily Accountability Ritual) — the habit loop that makes the app
// indispensable. Four touchpoints per day, each with its own time window and
// content. Streak counter tracks consecutive perfect 4/4 days.
//
// Touchpoints (IL local time):
//   Morning   06:00–10:00 — review yesterday + set today's intention
//   Noon      12:00–14:00 — pre-market US session, check open positions + plan
//   Evening   16:00–19:00 — US market open, monitor positions, no FOMO
//   Night     21:00–00:00 — US session end, daily review + tomorrow's prep
//
// Each completion is persisted to localStorage with timestamps so a missed
// window cannot be back-filled (no cheating the streak).

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2, Clock, Flame, Moon, Sun, Sunrise, Sunset, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type TouchpointKey = 'morning' | 'noon' | 'evening' | 'night';

interface Touchpoint {
  key:        TouchpointKey;
  label:      string;
  window:     string;          // human-readable window
  startHour:  number;          // inclusive
  endHour:    number;          // exclusive
  icon:       typeof Sun;
  accent:     string;
  prompt:     string;
  questions:  string[];
}

const TOUCHPOINTS: Touchpoint[] = [
  {
    key:       'morning',
    label:     'Morning',
    window:    '6:00–10:00',
    startHour: 6,
    endHour:   10,
    icon:      Sunrise,
    accent:    '#22D3EE',
    prompt:    'Set the tone for today before the market opens.',
    questions: [
      'I reviewed any overnight news on my open positions.',
      'I know today\'s market regime (Stage 2 / 3 / 4).',
      'I set today\'s maximum risk in dollars.',
      'I\'m rested and ready to follow my plan — not chase.',
    ],
  },
  {
    key:       'noon',
    label:     'Noon',
    window:    '12:00–14:00',
    startHour: 12,
    endHour:   14,
    icon:      Sun,
    accent:    '#10F088',
    prompt:    'Pre-market US session — finalize your watchlist.',
    questions: [
      'I reviewed Stage 2 Leaders and my watchlist.',
      'I ran Validator on every ticker I plan to trade today.',
      'I confirmed my stops on open positions.',
      'I have no impulse to override the system.',
    ],
  },
  {
    key:       'evening',
    label:     'Evening',
    window:    '16:00–19:00',
    startHour: 16,
    endHour:   19,
    icon:      Sunset,
    accent:    '#F59E0B',
    prompt:    'US market is opening. Trade your plan — not the moment.',
    questions: [
      'I executed only validated setups.',
      'I took partials at 1R targets if they triggered.',
      'I did not move any stop wider than I logged.',
      'I am not revenge-trading any earlier loss.',
    ],
  },
  {
    key:       'night',
    label:     'Night',
    window:    '21:00–00:00',
    startHour: 21,
    endHour:   24,
    icon:      Moon,
    accent:    '#A78BFA',
    prompt:    'Day is done. Review honestly.',
    questions: [
      'I logged every trade I took today.',
      'I wrote a one-sentence lesson from today.',
      'I prepared tomorrow\'s watchlist.',
      'I closed the book — no late-night chart-staring.',
    ],
  },
];

const STORAGE_KEY  = 'mp_daily_touchpoints_v1';
const STREAK_KEY   = 'mp_touchpoint_streak_v1';

interface DayRecord {
  [key: string]: number; // touchpoint key -> timestamp ms
}

interface Storage {
  [yyyymmdd: string]: DayRecord;
}

interface StreakState {
  current:        number;
  best:           number;
  lastPerfectDay: string | null;
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function yesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function readStorage(): Storage {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Storage) : {};
  } catch { return {}; }
}

function readStreak(): StreakState {
  if (typeof window === 'undefined') return { current: 0, best: 0, lastPerfectDay: null };
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    return raw ? (JSON.parse(raw) as StreakState) : { current: 0, best: 0, lastPerfectDay: null };
  } catch { return { current: 0, best: 0, lastPerfectDay: null }; }
}

function writeStorage(s: Storage): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {}
}

function writeStreak(s: StreakState): void {
  try { localStorage.setItem(STREAK_KEY, JSON.stringify(s)); } catch {}
}

function activeTouchpoint(now = new Date()): TouchpointKey | null {
  const h = now.getHours();
  for (const tp of TOUCHPOINTS) {
    if (h >= tp.startHour && h < tp.endHour) return tp.key;
  }
  return null;
}

export function DailyTouchpoints() {
  const [storage,        setStorage]        = useState<Storage>({});
  const [streak,         setStreak]         = useState<StreakState>({ current: 0, best: 0, lastPerfectDay: null });
  const [openTouchpoint, setOpenTouchpoint] = useState<Touchpoint | null>(null);
  const [mounted,        setMounted]        = useState(false);

  useEffect(() => {
    setStorage(readStorage());
    setStreak(readStreak());
    setMounted(true);
  }, []);

  const today = todayKey();
  const todayRecord = storage[today] ?? {};

  const completedTodayCount = TOUCHPOINTS.filter(tp => todayRecord[tp.key]).length;
  const active = activeTouchpoint();

  // Recompute streak when day flips or a new perfect day is hit
  useEffect(() => {
    if (!mounted) return;
    if (completedTodayCount !== TOUCHPOINTS.length) return;
    if (streak.lastPerfectDay === today) return;

    const wasYesterday = streak.lastPerfectDay === yesterdayKey();
    const newCurrent = wasYesterday ? streak.current + 1 : 1;
    const newStreak: StreakState = {
      current:        newCurrent,
      best:           Math.max(streak.best, newCurrent),
      lastPerfectDay: today,
    };
    setStreak(newStreak);
    writeStreak(newStreak);
  }, [completedTodayCount, today, streak, mounted]);

  const completeTouchpoint = useCallback((key: TouchpointKey) => {
    const next: Storage = {
      ...storage,
      [today]: { ...(storage[today] ?? {}), [key]: Date.now() },
    };
    setStorage(next);
    writeStorage(next);
  }, [storage, today]);

  const handleClickTouchpoint = useCallback((tp: Touchpoint) => {
    setOpenTouchpoint(tp);
  }, []);

  if (!mounted) return null;

  return (
    <>
      <div
        className="rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden"
        style={{ boxShadow: 'var(--shadow-card), var(--inner-highlight)' }}
      >
        {/* Header with streak */}
        <div className="px-5 pt-4 pb-3.5 border-b border-[var(--border-subtle)]">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <h2 className="text-[15px] font-bold tracking-tight text-[var(--text-primary)]">
                  Daily Ritual
                </h2>
                <span className="text-[8.5px] font-extrabold uppercase tracking-[0.18em] px-1.5 py-0.5 rounded bg-[#10F088]/15 text-[#10F088] border border-[#10F088]/25">
                  {completedTodayCount}/4 today
                </span>
              </div>
              <p className="text-[11.5px] text-[var(--text-muted)] leading-relaxed">
                4 check-ins per day. Builds the discipline market noise tries to break.
              </p>
            </div>
            <div className="flex items-center gap-3 text-[10.5px]">
              <div className="text-right">
                <div className="flex items-center gap-1 justify-end">
                  <Flame
                    className="w-3.5 h-3.5"
                    style={{ color: streak.current > 0 ? '#F59E0B' : 'var(--text-faint)' }}
                    strokeWidth={2.2}
                  />
                  <span className="font-mono font-extrabold text-[16px] tabular-nums" style={{ color: streak.current > 0 ? '#F59E0B' : 'var(--text-faint)' }}>
                    {streak.current}
                  </span>
                </div>
                <div className="text-[9px] uppercase tracking-[0.16em] font-bold text-[var(--text-faint)] mt-0.5">
                  current streak
                </div>
              </div>
              {streak.best > streak.current && (
                <div className="text-right border-l border-[var(--border-subtle)] pl-3">
                  <div className="font-mono font-bold text-[14px] text-[var(--text-secondary)] tabular-nums">
                    {streak.best}
                  </div>
                  <div className="text-[9px] uppercase tracking-[0.16em] font-bold text-[var(--text-faint)] mt-0.5">
                    best
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Touchpoints grid */}
        <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-2.5">
          {TOUCHPOINTS.map(tp => {
            const done = !!todayRecord[tp.key];
            const isActive = active === tp.key;
            const Icon = tp.icon;
            return (
              <button
                key={tp.key}
                type="button"
                onClick={() => handleClickTouchpoint(tp)}
                className={cn(
                  'relative flex flex-col items-start gap-2 p-3 rounded-[10px] border text-left transition-all min-h-[88px]',
                  done
                    ? 'border-transparent'
                    : isActive
                      ? 'border-2 hover:-translate-y-px'
                      : 'border border-[var(--border-subtle)] bg-[var(--bg-elevated)] hover:border-[var(--border-strong)] hover:-translate-y-px',
                )}
                style={done
                  ? { background: `${tp.accent}14`, borderColor: `${tp.accent}50`, borderWidth: 1 }
                  : isActive
                    ? { borderColor: `${tp.accent}66`, background: `${tp.accent}08` }
                    : undefined}
              >
                {isActive && !done && (
                  <span
                    className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full animate-pulse"
                    style={{ background: tp.accent }}
                  />
                )}
                <div className="flex items-center justify-between w-full">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center border"
                    style={{
                      background:  done ? `${tp.accent}1F` : `${tp.accent}14`,
                      borderColor: done ? `${tp.accent}80` : `${tp.accent}33`,
                    }}
                  >
                    {done
                      ? <CheckCircle2 className="w-4 h-4" style={{ color: tp.accent }} strokeWidth={2.5} />
                      : <Icon className="w-4 h-4" style={{ color: tp.accent }} strokeWidth={2.2} />}
                  </div>
                  <span
                    className="text-[8.5px] font-mono font-bold tracking-wider uppercase"
                    style={{ color: tp.accent }}
                  >
                    {tp.window}
                  </span>
                </div>
                <div>
                  <div className="text-[12px] font-extrabold text-[var(--text-primary)] tracking-tight">
                    {tp.label}
                  </div>
                  <div className="text-[10.5px] text-[var(--text-muted)] mt-0.5 leading-snug line-clamp-2">
                    {done ? 'Completed' : isActive ? 'Open now →' : 'Tap to start'}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Streak message */}
        {completedTodayCount === TOUCHPOINTS.length ? (
          <div className="px-5 py-2.5 bg-[#10F088]/[0.06] border-t border-[#10F088]/20 flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#10F088]" />
            <p className="text-[11.5px] font-bold text-[#10F088]">
              4/4 today. {streak.current > 1 ? `Day ${streak.current} of your streak.` : 'Streak started.'}
            </p>
          </div>
        ) : active && !todayRecord[active] ? (
          <div className="px-5 py-2.5 bg-[var(--bg-elevated)] border-t border-[var(--border-subtle)] flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-[var(--text-faint)]" />
            <p className="text-[11.5px] text-[var(--text-muted)]">
              You&apos;re in the <span className="font-bold text-[var(--text-secondary)]">{
                TOUCHPOINTS.find(t => t.key === active)?.label
              }</span> window. Don&apos;t break the streak.
            </p>
          </div>
        ) : null}
      </div>

      {/* Modal */}
      {openTouchpoint && (
        <TouchpointModal
          touchpoint={openTouchpoint}
          alreadyDone={!!todayRecord[openTouchpoint.key]}
          onComplete={() => {
            completeTouchpoint(openTouchpoint.key);
            setOpenTouchpoint(null);
          }}
          onClose={() => setOpenTouchpoint(null)}
        />
      )}
    </>
  );
}

// ── Touchpoint Modal ─────────────────────────────────────────────────────────

function TouchpointModal({
  touchpoint, alreadyDone, onComplete, onClose,
}: {
  touchpoint:  Touchpoint;
  alreadyDone: boolean;
  onComplete:  () => void;
  onClose:     () => void;
}) {
  const [checked, setChecked] = useState<boolean[]>(touchpoint.questions.map(() => false));
  const allChecked = checked.every(Boolean);
  const Icon = touchpoint.icon;

  const toggle = (i: number) => setChecked(c => c.map((v, idx) => (idx === i ? !v : v)));

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-[var(--modal-overlay)] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[480px] rounded-[16px] border border-[var(--border-strong)] bg-[var(--bg-modal)] overflow-hidden animate-modal-enter"
        style={{ boxShadow: 'var(--shadow-modal)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="h-[3px] w-full" style={{ background: touchpoint.accent }} />

        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-[var(--border-subtle)] flex items-start gap-3.5">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 border"
            style={{ background: `${touchpoint.accent}14`, borderColor: `${touchpoint.accent}40` }}
          >
            <Icon className="w-5 h-5" style={{ color: touchpoint.accent }} strokeWidth={2.2} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[9px] uppercase tracking-[0.2em] font-extrabold mb-0.5" style={{ color: touchpoint.accent }}>
              {touchpoint.label} · {touchpoint.window} IL
            </div>
            <h2 className="text-[17px] font-extrabold tracking-tight text-[var(--text-primary)] leading-tight">
              {touchpoint.prompt}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--text-faint)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Questions */}
        <div className="px-6 py-5 space-y-2.5">
          {touchpoint.questions.map((q, i) => (
            <label
              key={q}
              className={cn(
                'flex items-start gap-3 px-3 py-2.5 rounded-[10px] cursor-pointer transition-all border',
                checked[i]
                  ? 'border-transparent'
                  : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)] hover:border-[var(--border-strong)]',
              )}
              style={checked[i]
                ? { background: `${touchpoint.accent}14`, borderColor: `${touchpoint.accent}40`, borderWidth: 1 }
                : undefined}
            >
              <input
                type="checkbox"
                checked={checked[i]}
                onChange={() => toggle(i)}
                className="mt-0.5 w-4 h-4 rounded border-[var(--border-strong)] accent-current cursor-pointer flex-shrink-0"
                style={{ accentColor: touchpoint.accent }}
              />
              <span className="text-[12.5px] leading-snug text-[var(--text-secondary)]">{q}</span>
            </label>
          ))}
        </div>

        {/* Action */}
        <div className="px-6 pb-5 pt-1">
          {alreadyDone ? (
            <div className="text-center py-2.5 rounded-[10px] bg-[#10F088]/[0.06] border border-[#10F088]/25 text-[12px] font-bold text-[#10F088] flex items-center justify-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5" />
              You already completed {touchpoint.label} today.
            </div>
          ) : (
            <button
              type="button"
              onClick={onComplete}
              disabled={!allChecked}
              className={cn(
                'w-full py-3 rounded-[10px] text-xs font-extrabold uppercase tracking-wider transition-all flex items-center justify-center gap-2',
                allChecked
                  ? 'text-black hover:brightness-110 hover:-translate-y-px'
                  : 'bg-[var(--bg-elevated)] text-[var(--text-faint)] cursor-not-allowed',
              )}
              style={allChecked
                ? { background: `linear-gradient(135deg, ${touchpoint.accent}, ${touchpoint.accent}DD)`, boxShadow: `0 0 24px ${touchpoint.accent}55` }
                : undefined}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {allChecked ? 'Lock in this touchpoint' : `Check all 4 to lock in (${checked.filter(Boolean).length}/4)`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
