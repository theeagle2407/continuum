export type PreStock = {
  symbol: string
  name: string
  contract_address: string
  markPrice: number | null
  markValuation: number | null
  tokenPrice: number | null
  impliedValuation: number | null
  supply: number | null
  description?: string | null
  logo?: string | null
  product_url?: string | null
}

const PRESTOCKS_API = '/api/prestocks'

export async function listPreStocks(): Promise<PreStock[]> {
  const response = await fetch(PRESTOCKS_API)

  if (!response.ok) {
    throw new Error(`PreStocks API unavailable (${response.status})`)
  }

  const data = (await response.json()) as unknown

  if (!Array.isArray(data)) {
    throw new Error('Unexpected PreStocks API response.')
  }

  return data.map((item) => {
    const asset = item as Record<string, unknown>

    return {
      symbol: String(asset.symbol ?? ''),
      name: String(asset.name ?? ''),
      contract_address: String(asset.contract_address ?? ''),
      markPrice: typeof asset.markPrice === 'number' ? asset.markPrice : null,
      markValuation:
        typeof asset.markValuation === 'number' ? asset.markValuation : null,
      tokenPrice: typeof asset.tokenPrice === 'number' ? asset.tokenPrice : null,
      impliedValuation:
        typeof asset.impliedValuation === 'number'
          ? asset.impliedValuation
          : null,
      supply: typeof asset.supply === 'number' ? asset.supply : null,
      description:
        typeof asset.description === 'string' ? asset.description : null,
      logo: typeof asset.image === 'string' ? asset.image : null,
      product_url:
        typeof asset.external_url === 'string' ? asset.external_url : null,
    }
  })
}

export async function getPreStock(symbol: string): Promise<PreStock | null> {
  const assets = await listPreStocks()

  return (
    assets.find(
      (asset) => asset.symbol.toUpperCase() === symbol.toUpperCase(),
    ) ?? null
  )
}

export function getPreStockValue(
  positionAmount: number,
  asset: PreStock,
): number | null {
  if (asset.markPrice == null) return null

  return positionAmount * asset.markPrice
}

export function getPreStockPremium(asset: PreStock): number | null {
  if (
    asset.markPrice == null ||
    asset.tokenPrice == null ||
    asset.tokenPrice === 0
  ) {
    return null
  }

  return ((asset.markPrice - asset.tokenPrice) / asset.tokenPrice) * 100
}

export type PreStockPosition = {
  asset: PreStock
  mint: string
  rawAmount: string
  decimals: number
  rawUnits: number
  multiplier: number
  effectiveUnits: number
  uiAmount: number
}

type ScaledUiAmountConfig = {
  multiplier?: string
  newMultiplier?: string
  newMultiplierEffectiveTimestamp?: number
}

export function resolveScaledMultiplier(
  config: ScaledUiAmountConfig,
  nowSeconds = Math.floor(Date.now() / 1000),
): number {
  const current = Number(config.multiplier ?? 1)
  const next = Number(config.newMultiplier ?? NaN)
  const activation = Number(config.newMultiplierEffectiveTimestamp ?? NaN)

  if (
    Number.isFinite(next) &&
    Number.isFinite(activation) &&
    activation <= nowSeconds
  ) {
    return next
  }

  return Number.isFinite(current) ? current : 1
}

export function matchPreStockPositions(
  assets: PreStock[],
  tokenAccounts: Array<{
    account: {
      data: {
        parsed: {
          info: {
            mint: string
            tokenAmount: {
              amount: string
              decimals: number
              uiAmount: number | null
            }
          }
        }
      }
    }
  }>,
  multipliers: Map<string, number>,
): PreStockPosition[] {
  const byMint = new Map(
    assets.map((asset) => [asset.contract_address, asset]),
  )

  return tokenAccounts
    .map((account) => {
      const info = account.account.data.parsed.info
      const asset = byMint.get(info.mint)

      if (!asset) return null

      const rawUnits =
        Number(info.tokenAmount.amount) / 10 ** info.tokenAmount.decimals

      const multiplier = multipliers.get(info.mint) ?? 1
      const effectiveUnits = rawUnits * multiplier

      if (!Number.isFinite(rawUnits) || rawUnits <= 0) return null

      return {
        asset,
        mint: info.mint,
        rawAmount: info.tokenAmount.amount,
        decimals: info.tokenAmount.decimals,
        rawUnits,
        multiplier,
        effectiveUnits,
        uiAmount: info.tokenAmount.uiAmount ?? effectiveUnits,
      }
    })
    .filter((position): position is PreStockPosition => position !== null)
}
