// components/landing/app-mockups.tsx
//
// Visual mockups of the Momentum Playbook app interface.
// Shared between /billing (logged-in, no-sub) and /welcome (public landing).

export function MockupWindow({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl overflow-hidden border border-[var(--border-strong)]"
      style={{ background: 'var(--bg-surface)', boxShadow: '0 0 0 1px rgba(34,211,238,0.06), 0 16px 56px rgba(0,0,0,0.45)' }}
    >
      <div
        className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--border-subtle)]"
        style={{ background: 'var(--bg-elevated)' }}
      >
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#FF5F57' }} />
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#FEBC2E' }} />
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#28C840' }} />
        </div>
        <div className="flex-1 flex justify-center">
          <div
            className="px-3 py-0.5 rounded-md border border-[var(--border-subtle)]"
            style={{ background: 'var(--bg-surface)' }}
          >
            <span className="text-[9px] text-[var(--text-faint)] font-mono">momentum-playbook.vercel.app</span>
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}

export function DashboardMockup() {
  const BARS = [-0.22, 0.58, 0.44, 0.88, 0.72, -0.14, 0.83, 0.51, 1.0, 0.36, -0.12, 0.70];

  return (
    <MockupWindow>
      <div className="p-4 space-y-3" dir="ltr">
        <div className="flex gap-3">
          <div
            className="flex-1 rounded-[10px] border border-[var(--border-subtle)] p-4"
            style={{ background: 'var(--bg-elevated)' }}
          >
            <div className="flex items-center justify-between mb-2">
              <span
                className="uppercase font-bold text-[var(--text-faint)]"
                style={{ fontSize: 7, letterSpacing: '0.2em' }}
              >
                Account Equity
              </span>
              <span className="flex items-center gap-1 font-bold" style={{ fontSize: 7, color: '#F59E0B' }}>
                <span
                  className="rounded-full inline-block animate-pulse"
                  style={{ width: 5, height: 5, background: '#F59E0B' }}
                />
                Live
              </span>
            </div>
            <div
              className="font-mono font-extrabold tracking-tight text-[var(--text-primary)]"
              style={{ fontSize: 24 }}
            >
              $127,438
            </div>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="font-mono font-bold" style={{ fontSize: 13, color: '#10F088' }}>+$27,438</span>
              <span className="font-mono" style={{ fontSize: 11, color: '#10F088' }}>(+27.4%)</span>
            </div>
            <div className="mt-1 font-mono" style={{ fontSize: 8, color: 'var(--text-faint)' }}>
              3 open positions
            </div>
          </div>

          <div className="flex flex-col gap-2" style={{ width: 96 }}>
            {[
              { l: 'Win Rate', v: '68.4%', c: '#10F088' },
              { l: 'Avg R',    v: '+2.1R',  c: '#10F088' },
              { l: 'Max DD',   v: '-3.2%',  c: '#FF3B5C' },
            ].map(s => (
              <div
                key={s.l}
                className="rounded-[7px] border border-[var(--border-subtle)] px-2.5 py-2"
                style={{ background: 'var(--bg-elevated)' }}
              >
                <div
                  className="uppercase font-bold text-[var(--text-faint)]"
                  style={{ fontSize: 6, letterSpacing: '0.15em' }}
                >
                  {s.l}
                </div>
                <div className="font-mono font-extrabold" style={{ fontSize: 13, color: s.c }}>{s.v}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <div
            className="flex-1 rounded-[8px] border border-[var(--border-subtle)] p-3"
            style={{ background: 'var(--bg-elevated)' }}
          >
            <div
              className="uppercase font-bold text-[var(--text-faint)] mb-2"
              style={{ fontSize: 7, letterSpacing: '0.18em' }}
            >
              Monthly Performance
            </div>
            <div className="relative flex gap-0.5" style={{ height: 48 }}>
              <div
                className="absolute inset-x-0"
                style={{ top: '50%', borderTop: '1px dashed rgba(255,255,255,0.07)' }}
              />
              {BARS.map((v, i) => {
                const hPx = Math.max(Math.abs(v) * 21, 3);
                const isPos = v >= 0;
                return (
                  <div key={i} className="flex-1 flex flex-col" style={{ height: 48 }}>
                    <div style={{ height: 24, display: 'flex', alignItems: 'flex-end' }}>
                      {isPos && (
                        <div
                          style={{
                            width: '100%', height: hPx,
                            background: '#10F088',
                            borderRadius: '2px 2px 0 0',
                            opacity: 0.85,
                          }}
                        />
                      )}
                    </div>
                    <div style={{ height: 24, display: 'flex', alignItems: 'flex-start' }}>
                      {!isPos && (
                        <div
                          style={{
                            width: '100%', height: hPx,
                            background: '#FF3B5C',
                            borderRadius: '0 0 2px 2px',
                            opacity: 0.85,
                          }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div
            className="rounded-[8px] border border-[var(--border-subtle)] p-2.5"
            style={{ background: 'var(--bg-elevated)', width: 100 }}
          >
            <div
              className="uppercase font-bold text-[var(--text-faint)] mb-1.5"
              style={{ fontSize: 7, letterSpacing: '0.18em' }}
            >
              Positions
            </div>
            {[
              { t: 'NVDA', r: '+2.8R', c: '#10F088' },
              { t: 'META', r: '+1.2R', c: '#10F088' },
              { t: 'SMCI', r: '-0.4R', c: '#FF3B5C' },
            ].map(p => (
              <div
                key={p.t}
                className="flex items-center justify-between py-1.5 border-b border-[var(--border-subtle)] last:border-0"
              >
                <span
                  className="font-mono font-extrabold text-[var(--text-primary)]"
                  style={{ fontSize: 10 }}
                >
                  {p.t}
                </span>
                <span className="font-mono font-bold" style={{ fontSize: 9, color: p.c }}>{p.r}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </MockupWindow>
  );
}

export function LeadersMockup() {
  return (
    <div
      className="rounded-xl overflow-hidden border border-[var(--border-subtle)]"
      style={{ background: 'var(--bg-surface)' }}
      dir="ltr"
    >
      <div
        className="px-3 py-2.5 border-b border-[var(--border-subtle)]"
        style={{ background: 'var(--bg-elevated)' }}
      >
        <div className="font-bold text-[var(--text-primary)]" style={{ fontSize: 11 }}>Stage 2 Leaders</div>
        <div className="text-[var(--text-muted)] mt-0.5" style={{ fontSize: 8 }}>
          Minervini Trend Template · Ranked by RS
        </div>
      </div>
      <div className="p-2">
        {[
          { rank: 1, t: 'NVDA', co: 'NVIDIA Corporation',   p: '$875', ch: '+4.2%' },
          { rank: 2, t: 'SMCI', co: 'Super Micro Computer', p: '$743', ch: '+3.8%' },
          { rank: 3, t: 'META', co: 'Meta Platforms',       p: '$530', ch: '+2.1%' },
          { rank: 4, t: 'ANET', co: 'Arista Networks',      p: '$312', ch: '+1.9%' },
          { rank: 5, t: 'CRDO', co: 'Credo Technology',     p: '$38',  ch: '+1.5%' },
        ].map(l => (
          <div key={l.t} className="flex items-center gap-2 px-2 py-1.5">
            <span
              className="font-mono text-[var(--text-faint)] flex-shrink-0 text-right"
              style={{ fontSize: 7, width: 10 }}
            >
              {l.rank}
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-mono font-extrabold text-[var(--text-primary)]" style={{ fontSize: 10 }}>
                {l.t}
              </div>
              <div className="text-[var(--text-faint)] truncate" style={{ fontSize: 7 }}>{l.co}</div>
            </div>
            <span className="font-mono text-[var(--text-muted)] flex-shrink-0" style={{ fontSize: 8 }}>{l.p}</span>
            <span className="font-mono font-bold flex-shrink-0" style={{ fontSize: 8, color: '#10F088' }}>
              {l.ch}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PlaybookMockup() {
  return (
    <div
      className="rounded-xl overflow-hidden border border-[var(--border-subtle)]"
      style={{ background: 'var(--bg-surface)' }}
      dir="ltr"
    >
      <div
        className="px-3 py-2.5 border-b border-[var(--border-subtle)]"
        style={{ background: 'var(--bg-elevated)' }}
      >
        <div className="font-bold text-[var(--text-primary)]" style={{ fontSize: 11 }}>Playbook</div>
        <div className="flex items-center gap-3 mt-1.5">
          {[
            { l: 'Win Rate',  v: '68.4%', c: '#10F088' },
            { l: 'Avg R',     v: '+2.4R', c: '#10F088' },
            { l: 'Total PnL', v: '+$24K', c: '#10F088' },
          ].map(s => (
            <div key={s.l}>
              <div
                className="text-[var(--text-faint)] uppercase"
                style={{ fontSize: 6, letterSpacing: '0.15em' }}
              >
                {s.l}
              </div>
              <div className="font-mono font-extrabold" style={{ fontSize: 10, color: s.c }}>{s.v}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="p-2 space-y-1">
        {[
          { t: 'SMCI', o: 'winner', pnl: '+$4,600', r: '+3.2R' },
          { t: 'NVDA', o: 'winner', pnl: '+$3,200', r: '+2.8R' },
          { t: 'TSLA', o: 'winner', pnl: '+$1,850', r: '+1.9R' },
          { t: 'COIN', o: 'loser',  pnl: '-$820',   r: '-0.8R' },
        ].map(tr => (
          <div
            key={tr.t}
            className="flex items-center gap-2 px-2 py-1.5 rounded-[5px] border border-[var(--border-subtle)]"
            style={{ background: 'var(--bg-elevated)' }}
          >
            <div
              className="rounded-full flex-shrink-0"
              style={{ width: 3, height: 16, background: tr.o === 'winner' ? '#10F088' : '#FF3B5C' }}
            />
            <span
              className="font-mono font-extrabold text-[var(--text-primary)] flex-1"
              style={{ fontSize: 10 }}
            >
              {tr.t}
            </span>
            <span className="font-mono font-bold" style={{ fontSize: 9, color: tr.o === 'winner' ? '#10F088' : '#FF3B5C' }}>
              {tr.pnl}
            </span>
            <span className="font-mono" style={{ fontSize: 8, color: tr.o === 'winner' ? '#10F088' : '#FF3B5C' }}>
              {tr.r}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SizerMockup() {
  return (
    <div
      className="rounded-xl overflow-hidden border border-[var(--border-subtle)]"
      style={{ background: 'var(--bg-surface)' }}
      dir="ltr"
    >
      <div
        className="px-3 py-2.5 border-b border-[var(--border-subtle)]"
        style={{ background: 'var(--bg-elevated)' }}
      >
        <div className="font-bold text-[var(--text-primary)]" style={{ fontSize: 11 }}>Position Sizer</div>
        <div className="text-[var(--text-muted)] mt-0.5" style={{ fontSize: 8 }}>Risk-based · Phase 1 &amp; 2</div>
      </div>
      <div className="p-3 space-y-2">
        {[
          { l: 'Ticker',      v: 'NVDA'    },
          { l: 'Entry Price', v: '$875.20' },
          { l: 'Stop Price',  v: '$841.00' },
          { l: 'Risk %',      v: '1.5%'    },
        ].map(f => (
          <div key={f.l} className="flex items-center justify-between">
            <span
              className="uppercase text-[var(--text-faint)]"
              style={{ fontSize: 7, letterSpacing: '0.15em' }}
            >
              {f.l}
            </span>
            <span
              className="font-mono font-semibold text-[var(--text-primary)] px-2 py-0.5 rounded border border-[var(--border-subtle)]"
              style={{ fontSize: 9, background: 'var(--bg-elevated)' }}
            >
              {f.v}
            </span>
          </div>
        ))}
        <div
          className="rounded-[7px] p-2.5 mt-1"
          style={{ background: 'rgba(34,211,238,0.06)', border: '1px solid rgba(34,211,238,0.2)' }}
        >
          <div
            className="uppercase font-bold mb-1.5"
            style={{ fontSize: 7, color: 'rgba(34,211,238,0.7)', letterSpacing: '0.15em' }}
          >
            Phase 1 Result
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { l: 'Shares',   v: '512 sh'  },
              { l: 'Risk $',   v: '$1,875'  },
              { l: 'Stop %',   v: '3.9%'    },
              { l: 'Invested', v: '$44,800' },
            ].map(r => (
              <div key={r.l}>
                <div
                  className="uppercase"
                  style={{ fontSize: 6, color: 'rgba(34,211,238,0.6)', letterSpacing: '0.15em' }}
                >
                  {r.l}
                </div>
                <div className="font-mono font-extrabold" style={{ fontSize: 10, color: '#22D3EE' }}>{r.v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
