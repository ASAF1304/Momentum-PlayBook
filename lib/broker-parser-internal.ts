// lib/broker-parser-internal.ts
//
// Shared groupToTrades logic used by both broker-parser.ts and broker-parser-manual.ts.
// Do not import this directly from components — use broker-parser.ts instead.

import type { BrokerFormat, ImportedTrade, PartialRecord, RawTransaction } from './broker-parser';

interface Position {
  ticker:        string;
  entries:       { date: string; shares: number; price: number; fees: number }[];
  partials:      PartialRecord[];
  totalShares:   number;
  avgEntry:      number;
  totalInvested: number;
}

export function groupToTrades(transactions: RawTransaction[], _format: BrokerFormat): ImportedTrade[] {
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));

  const openPositions = new Map<string, Position>();
  const closedTrades:  ImportedTrade[] = [];

  for (const tx of sorted) {
    const { ticker, action, quantity, price, date, fees } = tx;

    if (action === 'buy') {
      let pos = openPositions.get(ticker);
      if (!pos) {
        pos = { ticker, entries: [], partials: [], totalShares: 0, avgEntry: 0, totalInvested: 0 };
        openPositions.set(ticker, pos);
      }
      const invested     = quantity * price;
      pos.totalInvested += invested;
      pos.totalShares   += quantity;
      pos.avgEntry       = pos.totalInvested / pos.totalShares;
      pos.entries.push({ date, shares: quantity, price, fees });
      pos.partials.push({
        id:          crypto.randomUUID(),
        date:        `${date}T12:00:00Z`,
        shares:      quantity,
        price,
        action:      'buy',
        pnl_dollars: 0,
        pnl_pct:     0,
        r_multiple:  0,
      });
    } else {
      const pos = openPositions.get(ticker);
      if (!pos) continue; // orphan sell

      const sellShares = Math.min(quantity, pos.totalShares);
      const pnlDollars = (price - pos.avgEntry) * sellShares;
      const pnlPct     = pos.avgEntry > 0 ? ((price - pos.avgEntry) / pos.avgEntry) * 100 : 0;
      const estStop    = pos.entries[0].price * 0.92;
      const riskPerSh  = Math.max(0, pos.avgEntry - estStop);
      const rMult      = riskPerSh > 0 ? pnlDollars / (riskPerSh * sellShares) : 0;

      pos.partials.push({
        id:          crypto.randomUUID(),
        date:        `${date}T12:00:00Z`,
        shares:      sellShares,
        price,
        action:      'sell',
        pnl_dollars: pnlDollars,
        pnl_pct:     pnlPct,
        r_multiple:  rMult,
      });

      pos.totalShares   -= sellShares;
      pos.totalInvested  = pos.totalShares * pos.avgEntry;

      if (pos.totalShares <= 0) {
        closedTrades.push(buildTrade(pos, 'closed', price, date));
        openPositions.delete(ticker);
      }
    }
  }

  const openTrades: ImportedTrade[] = [];
  for (const pos of openPositions.values()) {
    openTrades.push(buildTrade(pos, 'open', null, null));
  }

  return [
    ...openTrades.sort((a, b) => a.phase1_date.localeCompare(b.phase1_date)),
    ...closedTrades.sort((a, b) => b.phase1_date.localeCompare(a.phase1_date)),
  ];
}

function buildTrade(
  pos:           Position,
  status:        'open' | 'closed',
  lastSellPrice: number | null,
  lastSellDate:  string | null,
): ImportedTrade {
  const firstEntry = pos.entries[0];
  const estStop    = firstEntry.price * 0.92;
  const riskPerSh  = firstEntry.price - estStop;

  const sellPartials  = pos.partials.filter(p => p.action === 'sell');
  const totalPnl      = sellPartials.reduce((s, p) => s + p.pnl_dollars, 0);
  const totalInvested = pos.entries.reduce((s, e) => s + e.shares * e.price, 0);
  const pnlPct        = totalInvested > 0 && status === 'closed' ? (totalPnl / totalInvested) * 100 : null;
  const rMultiple     = riskPerSh > 0 && status === 'closed' ? totalPnl / (riskPerSh * firstEntry.shares) : null;

  const outcome: ImportedTrade['outcome'] = status === 'closed'
    ? totalPnl > 0.005  ? 'winner'
    : totalPnl < -0.005 ? 'loser'
    : 'breakeven'
    : null;

  return {
    _importId:            crypto.randomUUID(),
    ticker:               pos.ticker,
    phase1_date:          `${firstEntry.date}T12:00:00Z`,
    phase1_price:         firstEntry.price,
    phase1_shares:        firstEntry.shares,
    initial_stop:         estStop,
    current_stop:         estStop,
    stop_distance_pct:    8,
    risk_dollars:         Math.max(0, riskPerSh) * firstEntry.shares,
    status,
    exit_date:            status === 'closed' && lastSellDate ? `${lastSellDate}T12:00:00Z` : null,
    exit_price:           lastSellPrice,
    pnl_dollars:          status === 'closed' ? totalPnl : null,
    pnl_pct:              pnlPct,
    r_multiple:           rMultiple,
    outcome,
    partials:             pos.partials,
    current_shares:       pos.totalShares,
    trend_template_passed: false,
    is_what_if:           true,
    failed_gates:         ['imported_from_broker'],
    notes:                'Imported from broker',
    isDuplicate:          false,
    hasWarning:           false,
    warningMsg:           '',
  };
}
