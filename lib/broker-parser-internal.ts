// lib/broker-parser-internal.ts
//
// Implements Average Cost Basis (ACB) trade grouping.
//
// Key invariant: the FIRST buy for a ticker is stored as phase1_price / phase1_shares
// and is NOT added to pos.partials. Only additional buys (scale-ins after the position
// is already open) appear in partials. This keeps the journal's getCurrentShares formula:
//   phase1_shares + sum(buy-partials) - sum(sell-partials)
// consistent and prevents double-counting.
//
// Orphan sells (no prior buy in the file) are collected per-ticker and emitted
// as a single "inherited" trade so the data isn't silently lost.

import type { BrokerFormat, ImportedTrade, PartialRecord, RawTransaction } from './broker-parser';

interface Position {
  ticker:        string;
  firstDate:     string;
  firstPrice:    number;
  firstShares:   number;
  partials:      PartialRecord[];  // additional buys + all sells (first buy NOT included)
  totalShares:   number;           // ACB running share count
  avgEntry:      number;           // ACB running average cost
  totalInvested: number;           // totalShares × avgEntry
}

interface OrphanPosition {
  ticker:      string;
  sells:       PartialRecord[];
  totalShares: number;
  firstDate:   string;
  firstPrice:  number;   // first sell price (placeholder for unknown entry)
  lastDate:    string;
  lastPrice:   number;
}

export function groupToTrades(transactions: RawTransaction[], _format: BrokerFormat): ImportedTrade[] {
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));

  const openPositions   = new Map<string, Position>();
  const orphanPositions = new Map<string, OrphanPosition>();
  const closedTrades:   ImportedTrade[] = [];

  for (const { ticker, action, quantity, price, date } of sorted) {

    if (action === 'buy') {
      const pos = openPositions.get(ticker);

      if (!pos) {
        // First buy → store as phase1. NOT pushed to partials.
        openPositions.set(ticker, {
          ticker,
          firstDate:     date,
          firstPrice:    price,
          firstShares:   quantity,
          partials:      [],
          totalShares:   quantity,
          avgEntry:      price,
          totalInvested: quantity * price,
        });
      } else {
        // Scale-in buy: add to existing open position using ACB
        pos.totalInvested += quantity * price;
        pos.totalShares   += quantity;
        pos.avgEntry       = pos.totalInvested / pos.totalShares;
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
      }

    } else {
      // SELL
      const pos = openPositions.get(ticker);

      if (!pos) {
        // Orphan sell — no open position (inherited or short not tracked here)
        let orphan = orphanPositions.get(ticker);
        if (!orphan) {
          orphan = {
            ticker,
            sells:       [],
            totalShares: 0,
            firstDate:   date,
            firstPrice:  price,
            lastDate:    date,
            lastPrice:   price,
          };
          orphanPositions.set(ticker, orphan);
        }
        orphan.sells.push({
          id:          crypto.randomUUID(),
          date:        `${date}T12:00:00Z`,
          shares:      quantity,
          price,
          action:      'sell',
          pnl_dollars: 0,   // unknown — no entry price in file
          pnl_pct:     0,
          r_multiple:  0,
        });
        orphan.totalShares += quantity;
        orphan.lastDate     = date;
        orphan.lastPrice    = price;
        continue;
      }

      const sellShares = Math.min(quantity, pos.totalShares);

      // PnL uses current ACB average (not just the original first buy price)
      const pnlDollars = (price - pos.avgEntry) * sellShares;
      const pnlPct     = pos.avgEntry > 0 ? ((price - pos.avgEntry) / pos.avgEntry) * 100 : 0;
      // R-multiple: risk anchored to original stop (8% below first buy)
      const estStop    = pos.firstPrice * 0.92;
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

      // ACB on sell: shares decrease, average cost stays the same
      pos.totalShares   -= sellShares;
      pos.totalInvested  = pos.totalShares * pos.avgEntry;

      if (pos.totalShares <= 0) {
        closedTrades.push(buildRegularTrade(pos, 'closed', price, date));
        openPositions.delete(ticker);
      }
    }
  }

  // Remaining open positions
  const openTrades: ImportedTrade[] = [];
  for (const pos of openPositions.values()) {
    openTrades.push(buildRegularTrade(pos, 'open', null, null));
  }

  // Orphan (inherited) positions
  const inheritedTrades: ImportedTrade[] = [];
  for (const orphan of orphanPositions.values()) {
    inheritedTrades.push(buildOrphanTrade(orphan));
  }

  return [
    ...openTrades.sort((a, b)     => a.phase1_date.localeCompare(b.phase1_date)),
    ...closedTrades.sort((a, b)   => b.phase1_date.localeCompare(a.phase1_date)),
    ...inheritedTrades,
  ];
}

// ── Trade builders ─────────────────────────────────────────────────────────────

function buildRegularTrade(
  pos:           Position,
  status:        'open' | 'closed',
  lastSellPrice: number | null,
  lastSellDate:  string | null,
): ImportedTrade {
  const estStop   = pos.firstPrice * 0.92;   // 8% stop anchored to first buy
  const riskPerSh = pos.firstPrice - estStop;

  const sellPartials = pos.partials.filter(p => p.action === 'sell');
  const buyPartials  = pos.partials.filter(p => p.action === 'buy');
  const totalPnl     = sellPartials.reduce((s, p) => s + p.pnl_dollars, 0);

  // Cost basis: initial lot + all scale-in buys
  const totalInvested = pos.firstPrice * pos.firstShares
    + buyPartials.reduce((s, p) => s + p.price * p.shares, 0);

  const pnlPct    = totalInvested > 0 && status === 'closed' ? (totalPnl / totalInvested) * 100 : null;
  const rMultiple = riskPerSh > 0 && status === 'closed' ? totalPnl / (riskPerSh * pos.firstShares) : null;

  const outcome: ImportedTrade['outcome'] = status === 'closed'
    ? totalPnl > 0.005  ? 'winner'
    : totalPnl < -0.005 ? 'loser'
    : 'breakeven'
    : null;

  return {
    _importId:             crypto.randomUUID(),
    ticker:                pos.ticker,
    phase1_date:           `${pos.firstDate}T12:00:00Z`,
    phase1_price:          pos.firstPrice,
    phase1_shares:         pos.firstShares,
    initial_stop:          estStop,
    current_stop:          estStop,
    stop_distance_pct:     8,
    risk_dollars:          Math.max(0, riskPerSh) * pos.firstShares,
    status,
    exit_date:             status === 'closed' && lastSellDate ? `${lastSellDate}T12:00:00Z` : null,
    exit_price:            lastSellPrice,
    pnl_dollars:           status === 'closed' ? totalPnl : null,
    pnl_pct:               pnlPct,
    r_multiple:            rMultiple,
    outcome,
    partials:              pos.partials,
    current_shares:        pos.totalShares,
    trend_template_passed: false,
    is_what_if:            true,
    failed_gates:          ['imported_from_broker'],
    notes:                 'Imported from broker',
    isDuplicate:           false,
    hasWarning:            false,
    warningMsg:            '',
    isOrphan:              false,
  };
}

function buildOrphanTrade(orphan: OrphanPosition): ImportedTrade {
  // Store phase1_shares = totalShares so that:
  //   getCurrentShares = phase1_shares + 0 buys − totalShares sold = 0  ✓
  // phase1_price = weighted avg sell price as a visible placeholder (user must edit)
  const avgSellPrice = orphan.sells.reduce((s, p) => s + p.price * p.shares, 0) / orphan.totalShares;

  return {
    _importId:             crypto.randomUUID(),
    ticker:                orphan.ticker,
    phase1_date:           `${orphan.firstDate}T12:00:00Z`,
    phase1_price:          avgSellPrice,      // placeholder
    phase1_shares:         orphan.totalShares,
    initial_stop:          avgSellPrice * 0.92,
    current_stop:          avgSellPrice * 0.92,
    stop_distance_pct:     8,
    risk_dollars:          0,
    status:                'closed',
    exit_date:             `${orphan.lastDate}T12:00:00Z`,
    exit_price:            orphan.lastPrice,
    pnl_dollars:           0,    // unknown — no real entry price
    pnl_pct:               null,
    r_multiple:            null,
    outcome:               null,
    partials:              orphan.sells,
    current_shares:        0,
    trend_template_passed: false,
    is_what_if:            true,
    failed_gates:          ['imported_from_broker', 'inherited_position'],
    notes:                 '⚠ Sell with no prior buy — inherited position or short. Edit entry price manually.',
    isDuplicate:           false,
    hasWarning:            true,
    warningMsg:            'Inherited position — review entry price',
    isOrphan:              true,
  };
}
