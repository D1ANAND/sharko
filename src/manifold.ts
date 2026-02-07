export interface ManifoldMarket {
  id: string;
  question: string;
  probability: number;
  volume: number;
  isResolved: boolean;
  resolution?: string;
  resolutionTime?: number;
  url: string;
}

export async function getMarkets(): Promise<ManifoldMarket[]> {
  try {
    const resp = await fetch('https://api.manifold.markets/v0/markets?limit=50&order=volume');
    const data = await resp.json() as any[];

    return data.map((m: any) => ({
      id: m.id,
      question: m.question,
      probability: m.probability || 0.5,
      volume: m.volume || 0,
      isResolved: m.isResolved || false,
      resolution: m.resolution,
      resolutionTime: m.resolutionTime,
      url: m.url
    }));
  } catch (error) {
    console.error('Manifold API error:', error);
    return [];
  }
}

export async function getMarketResolution(marketId: string) {
  const resp = await fetch(`https://api.manifold.markets/v0/market/${marketId}`);
  const market = await resp.json() as any;

  if (!market.isResolved) {
    throw new Error('Market not resolved yet');
  }

  const outcome = market.resolution === 'YES' ? 'YES' :
    market.resolution === 'NO' ? 'NO' : 'CANCEL';

  return {
    outcome,
    probability: market.resolutionProbability || (outcome === 'YES' ? 1 : 0),
    resolvedAt: market.resolutionTime
  };
}
