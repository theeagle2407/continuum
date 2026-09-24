export const XSTOCKS_BASE = 'https://api.xstocks.fi/api/v2'
const DEFAULT_RPC_ENDPOINTS = [
  'https://solana-rpc.publicnode.com',
  'https://api.mainnet-beta.solana.com',
  'https://api.mainnet.solana.com',
]

export const SOLANA_RPC = import.meta.env.VITE_SOLANA_RPC_URL?.trim() || DEFAULT_RPC_ENDPOINTS[0]

export type Deployment = { address: string; network: string; solanaTokenProgram?: string }
export type Asset = {
  id: string
  name: string
  symbol: string
  logo?: string
  underlying?: { symbol?: string; type?: string; currency?: string } | null
  deployments?: Deployment[]
}
export type Multiplier = {
  currentMultiplier: number
  newMultiplier?: number
  activationDateTime?: number
  reason?: string | null
}
export type CorporateAction = {
  eventId: string
  version: number
  xstockSymbol?: string | null
  spvSymbol: string
  caType: string
  effectiveTimeUtc?: string | null
  multiplierOld?: string | null
  multiplierNew?: string | null
  grossCashflowUsd?: string | null
  netCashflowUsd?: string | null
  withholdingTaxRate?: string | null
  fromUnits?: string | null
  toUnits?: string | null
  redemptionPriceUsd?: string | null
  notes?: string | null
  createdTimeUtc: string
  status: string
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Request failed (${res.status})`)
  return res.json() as Promise<T>
}

export async function listSolanaAssets(): Promise<Asset[]> {
  const data = await getJson<{ nodes: Asset[] }>(`${XSTOCKS_BASE}/public/assets?network=Solana&page=1&pageSize=100`)
  return data.nodes ?? []
}

export async function getAsset(symbol: string): Promise<Asset> {
  return getJson<Asset>(`${XSTOCKS_BASE}/public/assets/${encodeURIComponent(symbol)}`)
}

export async function getMultiplier(symbol: string): Promise<Multiplier> {
  return getJson<Multiplier>(`${XSTOCKS_BASE}/public/assets/${encodeURIComponent(symbol)}/multiplier?network=Solana`)
}

export async function getPrice(symbol: string): Promise<number | null> {
  const data = await getJson<{ quote: number | null }>(`${XSTOCKS_BASE}/public/assets/${encodeURIComponent(symbol)}/price-data`)
  return data.quote ?? null
}

export async function getCorporateActions(symbol: string): Promise<CorporateAction[]> {
  const params = new URLSearchParams({ page: '1', pageSize: '20', symbol, sortBy: 'createdTimeUtc', sortOrder: 'desc' })
  const data = await getJson<{ nodes: CorporateAction[] }>(`${XSTOCKS_BASE}/public/corporate-actions/history?${params}`)
  return data.nodes ?? []
}

export async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const proxyConfigured = import.meta.env.VITE_HELIUS_RPC_ENABLED === 'true'

  const endpoint = proxyConfigured ? '/__continuum_rpc' : DEFAULT_RPC_ENDPOINTS[0]

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
    })

    if (!response.ok) {
      throw new Error(`${endpoint} returned HTTP ${response.status}`)
    }

    const body = (await response.json()) as { result?: T; error?: { message?: string } }
    if (body.error) {
      throw new Error(body.error.message ?? 'Solana RPC error')
    }
    return body.result as T
  } catch (error) {
    const message = error instanceof Error ? error.message : 'request failed'
    if (proxyConfigured) {
      throw new Error(`Solana RPC unavailable. ${message}`)
    }

    for (const fallback of DEFAULT_RPC_ENDPOINTS.slice(1)) {
      try {
        const response = await fetch(fallback, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
        })
        if (!response.ok) continue
        const body = (await response.json()) as { result?: T; error?: { message?: string } }
        if (!body.error) return body.result as T
      } catch {
        // Try the next public endpoint.
      }
    }
    throw new Error(`Solana RPC unavailable. ${message}`)
  }
}

export type TokenAccount = {
  pubkey: string
  account: {
    data: { parsed: { info: { mint: string; owner: string; tokenAmount: { amount: string; decimals: number; uiAmount: number | null } } } }
  }
}

export async function getToken2022ScaledMultiplier(mint: string): Promise<number> {
  const result = await rpc<{
    value: {
      data: {
        parsed?: {
          info?: {
            extensions?: Array<{
              extension?: string
              state?: {
                multiplier?: string
                newMultiplier?: string
                newMultiplierEffectiveTimestamp?: number
              }
            }>
          }
        }
      }
    } | null
  }>('getAccountInfo', [mint, { encoding: 'jsonParsed' }])

  const extensions = result.value?.data?.parsed?.info?.extensions ?? []
  const scaled = extensions.find(
    extension => extension.extension === 'scaledUiAmountConfig',
  )

  const current = Number(scaled?.state?.multiplier ?? 1)
  const next = Number(scaled?.state?.newMultiplier ?? NaN)
  const activation = Number(
    scaled?.state?.newMultiplierEffectiveTimestamp ?? NaN,
  )

  if (
    Number.isFinite(next) &&
    Number.isFinite(activation) &&
    activation <= Math.floor(Date.now() / 1000)
  ) {
    return next
  }

  return Number.isFinite(current) ? current : 1
}

export async function getToken2022Accounts(owner: string): Promise<TokenAccount[]> {
  const result = await rpc<{ value: TokenAccount[] }>('getTokenAccountsByOwner', [
    owner,
    { programId: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb' },
    { encoding: 'jsonParsed' },
  ])
  return result.value ?? []
}
