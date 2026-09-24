import { useEffect, useMemo, useState } from 'react'
import {
  Asset,
  CorporateAction,
  getCorporateActions,
  getMultiplier,
  getPrice,
  getToken2022Accounts,
  getToken2022ScaledMultiplier,
  listSolanaAssets,
  Multiplier,
} from './api'
import { listPreStocks, matchPreStockPositions, type PreStockPosition } from './prestocks'
import type { SolanaProvider } from './vite-env'

type Holding = {
  symbol: string
  name: string
  logo?: string
  mint: string
  rawAmount: string
  rawUnits: number
  decimals: number
  multiplier: number
  price: number | null
  value: number
  asset: Asset
  assetType?: 'xstock' | 'prestocks'
  productUrl?: string
}

type View = 'portfolio' | 'timeline' | 'actions'

type Mode = 'demo' | 'live'

const DEMO_HOLDINGS: Holding[] = [
  {
    symbol: 'NVDA',
    name: 'NVIDIA Corporation',
    mint: 'demo-nvda',
    rawAmount: '4800000',
    rawUnits: 4.8,
    decimals: 6,
    multiplier: 10,
    price: 182,
    value: 8736,
    asset: {} as Asset,
    assetType: 'xstock',
  },
  {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    mint: 'demo-aapl',
    rawAmount: '28000000',
    rawUnits: 28,
    decimals: 6,
    multiplier: 1,
    price: 246,
    value: 6888,
    asset: {} as Asset,
    assetType: 'xstock',
  },
  {
    symbol: 'TSLA',
    name: 'Tesla, Inc.',
    mint: 'demo-tsla',
    rawAmount: '18000000',
    rawUnits: 18,
    decimals: 6,
    multiplier: 1,
    price: 512,
    value: 9216,
    asset: {} as Asset,
    assetType: 'xstock',
  },
  {
    symbol: 'OPENAI',
    name: 'OpenAI PreStocks',
    mint: 'PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF',
    rawAmount: '8000000000',
    rawUnits: 8,
    decimals: 9,
    multiplier: 1.4861347,
    price: 32,
    value: 380.45,
    asset: {} as Asset,
    assetType: 'prestocks',
  },
  {
    symbol: 'ANTHROPIC',
    name: 'Anthropic PreStocks',
    mint: 'Pren1FvFX6J3E4kXhJuCiAD5aDmGEb7qJRncwA8Lkhw',
    rawAmount: '12000000000',
    rawUnits: 12,
    decimals: 9,
    multiplier: 1.2,
    price: 24,
    value: 345.60,
    asset: {} as Asset,
    assetType: 'prestocks',
  },
  {
    symbol: 'FIGUREAI',
    name: 'Figure AI PreStocks',
    mint: 'PreZad18qfPtbxNpMtMuAuX2zVpvkEU8DnJx56faCWd',
    rawAmount: '20000000000',
    rawUnits: 20,
    decimals: 9,
    multiplier: 1,
    price: 18,
    value: 360,
    asset: {} as Asset,
    assetType: 'prestocks',
  },
]

const DEMO_PRESTOCK_ACTIONS = [
  {
    eventId: 'demo-openai-scale',
    version: 1,
    status: 'demo',
    xstockSymbol: 'OPENAI',
    spvSymbol: 'OPENAI',
    caType: 'Token2022Scale',
    effectiveTimeUtc: '2026-09-23T00:00:00Z',
    createdTimeUtc: '2026-09-23T00:00:00Z',
    multiplierOld: '1',
    multiplierNew: '1.4861347',
    notes: 'Token-2022 scaled accounting changes the effective position without requiring the raw token balance to move. Illustrative demo event.',
  },
] as CorporateAction[]

const DEMO_ACTIONS = [
  { eventId: 'demo-nvda-split', xstockSymbol: 'NVDA', spvSymbol: 'NVDA', caType: 'ForwardSplit', effectiveTimeUtc: '2026-06-10T00:00:00Z', createdTimeUtc: '2026-06-10T00:00:00Z', multiplierOld: 1, multiplierNew: 10, notes: 'The position representation changed through a 10-for-1 split.' },
  { eventId: 'demo-aapl-dividend', xstockSymbol: 'AAPL', spvSymbol: 'AAPL', caType: 'CashDividend', effectiveTimeUtc: '2026-07-18T00:00:00Z', createdTimeUtc: '2026-07-18T00:00:00Z', notes: 'A dividend event was recorded for the position.' },
  { eventId: 'demo-tsla-split', xstockSymbol: 'TSLA', spvSymbol: 'TSLA', caType: 'ForwardSplit', effectiveTimeUtc: '2026-08-01T00:00:00Z', createdTimeUtc: '2026-08-01T00:00:00Z', multiplierOld: 1, multiplierNew: 3, notes: 'The economic share representation changed through a stock split.' },
] as CorporateAction[]


function provider(): SolanaProvider | null {
  return window.phantom?.solana ?? window.solflare ?? window.solana ?? null
}

function short(value: string) { return `${value.slice(0, 4)}…${value.slice(-4)}` }
function money(value: number) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value) }
function shares(value: number) { return new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 }).format(value) }
function date(value?: string | null) { return value ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value)) : '—' }

function Sparkline({ points = 32, active = false }: { points?: number; active?: boolean }) {
  const width = 720
  const height = 190
  const padX = 12
  const padY = 18

  const values = Array.from({ length: points }, (_, i) => {
    const t = i / Math.max(1, points - 1)
    return 38 + t * 42 + Math.sin(i * 0.42) * 5 + Math.sin(i * 0.13) * 3
  })

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = Math.max(1, max - min)

  const coords = values.map((v, i) => {
    const x = padX + (i / Math.max(1, points - 1)) * (width - padX * 2)
    const y = height - padY - ((v - min) / range) * (height - padY * 2)
    return [x, y] as const
  })

  const line = coords.map(([x, y], i) => `${i ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const area = `${line} L ${width - padX} ${height - padY} L ${padX} ${height - padY} Z`

  const markers = [
    { x: 0.34, label: 'NVDA split' },
    { x: 0.61, label: 'AAPL dividend' },
    { x: 0.79, label: 'TSLA split' },
    { x: 0.94, label: 'OPENAI scale' },
  ]

  return <div className="sparkline-wrap">
    <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-label="Illustrative portfolio history">
      <defs>
        <linearGradient id="continuum-history-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopOpacity="0.16" />
          <stop offset="100%" stopOpacity="0" />
        </linearGradient>
      </defs>

      <path d={area} fill="url(#continuum-history-fill)" />
      <path d={line} fill="none" stroke="currentColor" strokeWidth="2.2" vectorEffect="non-scaling-stroke" />

      {active && markers.map(marker => {
        const index = Math.round(marker.x * (coords.length - 1))
        const [x] = coords[index]
        const y = coords[index][1]

        return <g key={marker.label}>
          <line x1={x} x2={x} y1={18} y2={height - padY} stroke="currentColor" strokeOpacity="0.16" strokeDasharray="3 5" />
          <circle cx={x} cy={y} r="4" fill="currentColor" />
          <circle cx={x} cy={y} r="8" fill="none" stroke="currentColor" strokeOpacity="0.18" />
        </g>
      })}
    </svg>

    {active && <div className="chart-events">
      {markers.map(marker => <span key={marker.label}>{marker.label}</span>)}
    </div>}
  </div>
}
function Mark({ symbol }: { symbol: string }) {
  return <div className="asset-mark">{symbol.replace(/x$/i, '').slice(0, 1)}</div>
}

export default function App() {
  const [view, setView] = useState<View>('portfolio')
  const [wallet, setWallet] = useState<string | null>(null)
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [actions, setActions] = useState<CorporateAction[]>([])
  const [preStockPositions, setPreStockPositions] = useState<PreStockPosition[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<Holding | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [mode, setMode] = useState<Mode>('demo')
  const displayHoldings = mode === 'demo' ? DEMO_HOLDINGS : holdings
  const displayActions = mode === 'demo' ? [...DEMO_ACTIONS, ...DEMO_PRESTOCK_ACTIONS] : actions

  useEffect(() => {
    if (mode === 'demo') {
      setSelected(DEMO_HOLDINGS[0])
      setLoading(false)
      setError('')
    }
  }, [mode])
  const total = useMemo(() => displayHoldings.reduce((sum, h) => sum + h.value, 0), [displayHoldings])


  useEffect(() => {
    setView('portfolio')
    setSelected(null)
  }, [mode])

  async function connect() {
    setError('')
    const p = provider()
    if (!p) {
      setError('No Solana wallet detected. Install Phantom or Solflare, then reload this page.')
      return
    }
    try {
      const result = await p.connect()
      setWallet(result.publicKey.toString())
    } catch (e) { setError(e instanceof Error ? e.message : 'Wallet connection failed') }
  }

  async function disconnect() {
    try { await provider()?.disconnect() } catch { /* wallet may already be disconnected */ }
    setWallet(null); setHoldings([]); setActions([]); setPreStockPositions([]); setSelected(null)
  }

  useEffect(() => {
    if (mode !== 'live' || !wallet) {
      setLoading(false)
      if (mode === 'demo') setError('')
      return
    }

    let cancelled = false
    async function load() {
      setLoading(true); setError('')
      try {
        const [assets, tokenAccounts, preStocks] = await Promise.all([
          listSolanaAssets(),
          getToken2022Accounts(wallet!),
          listPreStocks(),
        ])

        const preStockMultipliers = new Map<string, number>()

        for (const preStock of preStocks) {
          const multiplier = await getToken2022ScaledMultiplier(preStock.contract_address)
          preStockMultipliers.set(preStock.contract_address, multiplier)
        }

        const matchedPreStocks = matchPreStockPositions(
          preStocks,
          tokenAccounts,
          preStockMultipliers,
        )

        if (!cancelled) setPreStockPositions(matchedPreStocks)

        const preStockHoldings: Holding[] = matchedPreStocks
          .map(position => {
            const price = position.asset.tokenPrice
            const value = price == null ? 0 : position.effectiveUnits * price

            return {
              symbol: position.asset.symbol,
              name: position.asset.name ?? `${position.asset.symbol} PreStocks`,
              logo: position.asset.logo ?? undefined,
              mint: position.mint,
              rawAmount: position.rawAmount,
              rawUnits: position.rawUnits,
              decimals: position.decimals,
              multiplier: position.multiplier,
              price,
              value,
              asset: {} as Asset,
              assetType: 'prestocks' as const,
              productUrl: position.asset.product_url ?? undefined,
            }
          })
          .filter(position => position.rawUnits > 0)

        const byMint = new Map<string, Asset>()
        for (const asset of assets) {
          const deployment = asset.deployments?.find(d => d.network === 'Solana')
          if (deployment?.address) byMint.set(deployment.address, asset)
        }
        const candidates = tokenAccounts.filter(a => BigInt(a.account.data.parsed.info.tokenAmount.amount) > 0n && byMint.has(a.account.data.parsed.info.mint))
        const result = await Promise.all(candidates.map(async account => {
          const info = account.account.data.parsed.info
          const asset = byMint.get(info.mint)!
          const symbol = asset.symbol
          const [multiplier, price] = await Promise.all([getMultiplier(symbol), getPrice(symbol)])
          const rawUnits = Number(info.tokenAmount.amount) / 10 ** info.tokenAmount.decimals
          const scaled = rawUnits * multiplier.currentMultiplier
          return { symbol, name: asset.name, logo: asset.logo, mint: info.mint, rawAmount: info.tokenAmount.amount, rawUnits, decimals: info.tokenAmount.decimals, multiplier: multiplier.currentMultiplier, price, value: price == null ? 0 : scaled * price, asset, assetType: 'xstock' as const }
        }))
        if (cancelled) return
        const combinedHoldings = [...result, ...preStockHoldings]
          .sort((a, b) => b.value - a.value)

        setHoldings(combinedHoldings)
        if (combinedHoldings[0]) setSelected(combinedHoldings[0])
        const allActions = await Promise.all(
          result
            .slice(0, 6)
            .map(h => getCorporateActions(h.symbol).catch(() => [])),
        )
        if (!cancelled) setActions(allActions.flat().sort((a, b) => new Date(b.effectiveTimeUtc ?? b.createdTimeUtc).getTime() - new Date(a.effectiveTimeUtc ?? a.createdTimeUtc).getTime()))
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load the portfolio')
      } finally { if (!cancelled) setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [wallet, reloadKey, mode])

  const allocation = displayHoldings.map(h => ({ ...h, pct: total ? h.value / total * 100 : 0 }))

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">◒</span><span>Continuum</span></div>
      <div className="eyebrow">Portfolio intelligence</div>
      <nav>
        {([['portfolio','Portfolio','⌂'], ['timeline','Timeline','◌'], ['actions','Corporate actions','✦']] as const).map(([id,label,icon]) => <button key={id} className={`nav-item ${view === id ? 'active' : ''}`} onClick={() => setView(id)}><span>{icon}</span>{label}</button>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="proof"><span className="pulse" /> Solana mainnet<br /><small>Live on-chain data</small></div>
        {wallet ? <button className="wallet-pill" onClick={disconnect}><span className="wallet-dot" />{short(wallet)}<span>↗</span></button> : <button className="connect" onClick={connect}>Connect wallet <span>→</span></button>}
      </div>
    </aside>

    <main className="main">
      <header className="topbar">
          <div className="mobile-brand">Continuum</div>
          <div className="mode-switch">
            <button className={mode === 'demo' ? 'mode-active' : ''} onClick={() => setMode('demo')}>Demo</button>
            <button className={mode === 'live' ? 'mode-active' : ''} onClick={() => setMode('live')}>Live</button>
          </div>
          <div className="top-actions">
            <span className="live-dot" /> {mode === 'demo' ? 'Demo mode' : 'Live data'}
            <button className="icon-btn">⌕</button>
          </div>
        </header>

      {!wallet ? <section className="landing">
        <div className="landing-copy">
          <div className="kicker">TOKENIZED EQUITIES / SOLANA</div>
          <h1>Your portfolio<br /><em>remembers.</em></h1>
          <p>Continuum reconstructs the story behind your tokenized stock positions — from raw on-chain balances to corporate actions and the equity they represent.</p>
          <button className="hero-connect" onClick={connect}>Connect Solana wallet <span>↗</span></button>
          {error && <div className="error">{error}</div>}
        </div>
        <div className="hero-instrument">
          <div className="instrument-top"><span>POSITION / TRUTH</span><span>ON-CHAIN</span></div>
          <div className="instrument-number">—</div>
          <div className="instrument-line"><span>raw balance</span><span>×</span><span>multiplier</span><span>=</span><strong>effective position</strong></div>
          <Sparkline points={48} active />
          <div className="instrument-events"><span>DIVIDEND</span><span>SPLIT</span><span>TRADE</span></div>
        </div>
      </section> : <>
        {error && <div className="error wide">{error}</div>}
        {view === 'portfolio' && <>
          <section className="page-head">
            <div>
              <div className="kicker">{mode === 'demo' ? 'CONTINUUM / DEMO' : 'YOUR PORTFOLIO'}</div>
              <h1>{mode === 'demo' ? 'Your portfolio, understood.' : 'Good day.'}</h1>
              <p>{mode === 'demo' ? 'See how Continuum explains positions, events, and the story behind your portfolio.' : 'Real positions. Real events. The full picture.'}</p>
            </div>
            <button className="refresh" onClick={() => setReloadKey(k => k + 1)}>↻ Refresh</button>
          </section>


          <section className="hero-grid">

            <div className="value-card">
              <div className="card-label">Portfolio value</div>
              <div className="value">{loading ? 'Loading…' : money(total)}</div>
              <div className="value-meta">
                <span className="positive">↗ {mode === 'demo' ? 'Illustrative' : 'Live'}</span>
                <span>{mode === 'demo' ? 'controlled scenario · 6 positions' : `across ${displayHoldings.length} verified position${displayHoldings.length === 1 ? '' : 's'}`}</span>
              </div>
            </div>

            <div className="chart-card">
              <div className="chart-head">
                <span>Portfolio history{mode === 'demo' ? ' · illustrative' : ''}</span>
                {mode === 'demo' && <div className="range">
                  <button className="selected">1M</button>
                  <button>3M</button>
                  <button>1Y</button>
                  <button>ALL</button>
                </div>}
              </div>

              {mode === 'demo' ? (
                <>
                  <Sparkline points={72} active />
                  <div className="chart-axis">
                    <span>Earlier</span>
                    <span>Now</span>
                  </div>
                </>
              ) : (
                <div className="history-empty">
                  <strong>No verified portfolio history yet.</strong>
                  <span>Continuum only charts history reconstructed from verified on-chain positions and events.</span>
                </div>
              )}
            </div>

          </section>

          <section className="section-head">
            <div>
              <h2>Holdings</h2>
              <span>{mode === 'demo' ? 'Controlled scenario · public equity + private-market exposure' : (holdings.length ? 'Verified from Token-2022 accounts' : 'No tokenized positions found')}</span>
            </div>
            <div className="portfolio-context">
              
              <span className="mono">{mode === 'demo' ? 'Illustrative · 6 positions' : (wallet ? short(wallet) : '')}</span>
            </div>
          </section>

          {loading && mode === 'live' ? <div className="empty">Reading your verified Token-2022 accounts…</div> : displayHoldings.length === 0 ? <div className="empty">
            <div className="empty-icon">○</div>
            <strong>No tokenized stock positions detected.</strong>
            <span>Continuum only displays positions it can verify from your connected Solana wallet.</span>
          </div> : <div className="holdings-layout">

            <div className="holdings-list">
              {allocation.map(h => <button
  className={`holding ${selected?.symbol === h.symbol ? 'selected' : ''}`}
  data-asset-type={h.assetType}
  key={h.mint}
  onClick={() => setSelected(h)}
>
                <Mark symbol={h.symbol} />
                <div className="holding-main">
                  <strong>{h.symbol}</strong>
                  <span>{h.name}</span>
                  <small className="holding-type">{h.assetType === 'prestocks' ? 'Private-market exposure' : 'Public equity'}</small>
                </div>
                <div className="holding-share">
                  <div>
                    <span>{shares(h.rawUnits * h.multiplier)} {h.assetType === 'prestocks' ? 'effective units' : 'shares'}</span>
                    <small>{h.pct.toFixed(1)}%</small>
                  </div>
                  <div className="bar">
                    <i style={{ width: `${Math.max(4, h.pct)}%` }} />
                  </div>
                </div>
                <div className="holding-value">{h.price == null ? '—' : money(h.value)}</div>
                <span className="arrow">→</span>
              </button>)}
            </div>

            <div className="position-panel">
              {selected ? <PositionPanel holding={selected} actions={displayActions.filter(a => (a.xstockSymbol ?? a.spvSymbol) === selected.symbol).slice(0, 4)} /> : null}
            </div>

          </div>}

        </>}

        {view === 'timeline' && <Timeline actions={displayActions} holdings={displayHoldings} />}
        {view === 'actions' && <Actions actions={displayActions} holdings={displayHoldings} />}
      </>}
    </main>
  </div>
}

function PositionPanel({ holding, actions }: { holding: Holding; actions: CorporateAction[] }) {
  const effective = holding.rawUnits * holding.multiplier
  const isPreStock = holding.assetType === 'prestocks'

  return <div className="position-card">
    <div className="position-header">
      <div>
        <div className="kicker">POSITION / VERIFIED</div>
        <h2>{holding.symbol}</h2>
        <span>{holding.name}</span>
        <small className="position-type">
          {isPreStock ? 'Private-market exposure' : 'Public equity'}
        </small>
      </div>
      <Mark symbol={holding.symbol} />
    </div>

    <div className="position-price">
      {holding.price == null ? '—' : money(holding.price)}
      <small>{isPreStock ? 'token price' : 'indicative price'}</small>
    </div>

    <div className="truth-grid">
      <div>
        <span>Raw on-chain</span>
        <strong>{shares(holding.rawUnits)}</strong>
        <small>{holding.rawAmount} base units</small>
      </div>

      <div>
        <span>Multiplier</span>
        <strong>×{holding.multiplier.toFixed(6)}</strong>
        <small>Token-2022 metadata</small>
      </div>

      <div className="truth-result">
        <span>{isPreStock ? 'Effective exposure' : 'Effective position'}</span>
        <strong>{shares(effective)}</strong>
        <small>{isPreStock ? 'economic units' : 'economic share equivalent'}</small>
      </div>
    </div>

    <div className="position-equation" aria-label="Position calculation">
      <span>{shares(holding.rawUnits)}</span>
      <b>×</b>
      <span>×{holding.multiplier.toFixed(6)}</span>
      <b>=</b>
      <strong>{shares(effective)}</strong>
      <small>{isPreStock ? 'effective units' : 'effective shares'}</small>
    </div>

    {isPreStock && holding.productUrl && (
      <div className="prestocks-action">
        <div>
          <span className="kicker">PRESTOCKS</span>
          <strong>View this asset</strong>
          <small>Open the verified PreStocks product page for {holding.symbol}.</small>
        </div>
        <a
          href={holding.productUrl}
          target="_blank"
          rel="noreferrer"
        >
          Open ↗
        </a>
      </div>
    )}

    <div className="trace">
      <div className="trace-title">
        <span>Why the number changed</span>
        <span>TRACE</span>
      </div>

      {actions.length ? actions.map(a => <div className="trace-row" key={a.eventId}>
        <span className="trace-dot" />
        <div>
          <strong>{humanAction(a.caType)}</strong>
          <span>{date(a.effectiveTimeUtc ?? a.createdTimeUtc)}</span>
        </div>
        <b>{a.multiplierOld && a.multiplierNew ? `${a.multiplierOld} → ${a.multiplierNew}` : 'Recorded'}</b>
      </div>) : <div className="trace-empty">
        {isPreStock
          ? `No historical lifecycle event is available from PreStocks. The current effective exposure is verified from the Token-2022 multiplier above.`
          : 'No corporate-action history returned for this asset.'}
      </div>}
    </div>

    <div className="source-row">
      <span>✓ Verified on Solana</span>
      <a
        href={"https://solscan.io/token/" + holding.mint}
        target="_blank"
        rel="noreferrer"
      >
        View mint ↗
      </a>
    </div>
  </div>
}

function Timeline({ actions, holdings }: { actions: CorporateAction[]; holdings: Holding[] }) {
  const eventSymbols = new Set(actions.map(a => a.xstockSymbol ?? a.spvSymbol))
  const unrecorded = holdings.filter(h => !eventSymbols.has(h.symbol))

  return <section className="timeline-view">
    <div className="section-head">
      <div>
        <h2>Portfolio timeline</h2>
        <span>Events and position states across your detected tokenized assets</span>
      </div>
    </div>

    {actions.length ? <div className="timeline">
      {actions.map(a => <div className="timeline-item" key={a.eventId}>
        <div className="timeline-date">{date(a.effectiveTimeUtc ?? a.createdTimeUtc)}</div>
        <div className="timeline-marker">{actionIcon(a.caType)}</div>
        <div className="timeline-content">
          <div>
            <strong>{a.xstockSymbol ?? a.spvSymbol}</strong>
            <span>{humanAction(a.caType)}</span>
          </div>
          <p>{actionCopy(a)}</p>
          {a.multiplierOld && a.multiplierNew && <div className="multiplier">
            Multiplier <b>{a.multiplierOld}</b> <span>→</span> <b>{a.multiplierNew}</b>
          </div>}
        </div>
      </div>)}
    </div> : <div className="empty">
      Connect a wallet with tokenized positions to build your verified timeline.
    </div>}

    {unrecorded.length > 0 && <div className="state-table">
      <div className="section-head">
        <div>
          <h3>Position states</h3>
          <span>Detected positions with no lifecycle event recorded in this scenario</span>
        </div>
        <span className="action-count">{unrecorded.length} positions</span>
      </div>

      <div className="action-table-head">
        <span>Asset</span>
        <span>State</span>
        <span>Type</span>
        <span>Position</span>
      </div>

      {unrecorded.map(h => <div className="state-row" key={h.mint}>
        <strong>{h.symbol}</strong>
        <span>No recorded lifecycle event</span>
        <span>{h.assetType === 'prestocks' ? 'PreStocks' : 'xStock'}</span>
        <span>{shares(h.rawUnits * h.multiplier)} {h.assetType === 'prestocks' ? 'effective units' : 'effective shares'}</span>
      </div>)}
    </div>}
  </section>
}

function Actions({ actions, holdings }: { actions: CorporateAction[]; holdings: Holding[] }) {
  const eventSymbols = new Set(actions.map(a => a.xstockSymbol ?? a.spvSymbol))
  const unrecorded = holdings.filter(h => !eventSymbols.has(h.symbol))

  return <section className="timeline-view">
    <div className="section-head">
      <div>
        <h2>Corporate actions</h2>
        <span>Events and position states affecting your detected assets</span>
      </div>
      <span className="action-count">{actions.length} recorded events</span>
    </div>

    <div className="action-table">
      <div className="action-table-head">
        <span>Asset</span>
        <span>Event</span>
        <span>Effective</span>
        <span>Multiplier</span>
      </div>

      {actions.map(a => <div className="action-row" key={a.eventId}>
        <strong>{a.xstockSymbol ?? a.spvSymbol}</strong>
        <span>{humanAction(a.caType)}</span>
        <span>{date(a.effectiveTimeUtc ?? a.createdTimeUtc)}</span>
        <span>{a.multiplierOld && a.multiplierNew ? `${a.multiplierOld} → ${a.multiplierNew}` : '—'}</span>
      </div>)}
    </div>

    {unrecorded.length > 0 && <div className="state-table">
      <div className="section-head">
        <div>
          <h3>Positions without recorded events</h3>
          <span>These assets are detected, but no lifecycle event is recorded in this scenario</span>
        </div>
        <span className="action-count">{unrecorded.length}</span>
      </div>

      <div className="action-table-head">
        <span>Asset</span>
        <span>State</span>
        <span>Type</span>
        <span>Position</span>
      </div>

      {unrecorded.map(h => <div className="state-row" key={h.mint}>
        <strong>{h.symbol}</strong>
        <span>No recorded lifecycle event</span>
        <span>{h.assetType === 'prestocks' ? 'PreStocks' : 'xStock'}</span>
        <span>{shares(h.rawUnits * h.multiplier)} {h.assetType === 'prestocks' ? 'effective units' : 'effective shares'}</span>
      </div>)}
    </div>}
  </section>
}
function humanAction(type: string) { return ({
  CashDividend: 'Dividend reinvestment',
  StockDividend: 'Stock dividend',
  CashAndStockDividend: 'Cash + stock dividend',
  ForwardSplit: 'Forward split',
  ReverseSplit: 'Reverse split',
  UnitSplit: 'Unit split',
  SpinOff: 'Spin-off',
  CashMerger: 'Cash merger',
  StockMerger: 'Stock merger',
  StockAndCashMerger: 'Stock + cash merger',
  Redemption: 'Redemption',
  NameChange: 'Name change',
  RightsDistribution: 'Rights distribution',
  Reorganization: 'Reorganization',
  Token2022Scale: 'Token-2022 scaling',
} as Record<string,string>)[type] ?? type }
function actionIcon(type: string) {
  const value = type.toLowerCase()
  if (value.includes('dividend')) return '＋'
  if (value.includes('split')) return '×'
  if (value.includes('token2022')) return '↗'
  return '◆'
}
function actionCopy(a: CorporateAction) {
  const type = a.caType.toLowerCase()
  if (type.includes('dividend')) return 'Dividend proceeds were reflected through the tokenized position’s corporate-action mechanism.'
  if (type.includes('split')) return 'The economic share representation changed while the underlying on-chain accounting remains traceable.'
  if (type.includes('token2022')) return 'The Token-2022 multiplier changes the effective position while the raw token balance remains directly traceable.'
  return a.notes ?? 'Corporate action recorded by xStocks.'
}
