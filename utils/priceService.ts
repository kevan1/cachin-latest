/**
 * Service for fetching cryptocurrency prices
 */

export interface TokenPrices {
  sol: number;
  usdc: number;
  usdt: number;
  mon: number;
}

export interface ArsQuote {
  name: string;
  buy: number;
  sell: number;
  timestamp: number;
  variation: null;
  spread: number;
  volumen: null;
  extra: null;
}

// Price cache
let cachedPrices: TokenPrices | null = null;
let cachedArsPrice: number | null = null;
let lastFetchTime: number = 0;
let lastArsFetchTime: number = 0;
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes (increased to reduce API calls)

/**
 * Fetch current prices for SOL, USDC, and USDT from CoinGecko API
 * Prices are cached for 10 minutes to avoid rate limiting
 * @param forceFresh - If true, bypasses cache and fetches fresh prices
 */
export async function fetchTokenPrices(forceFresh: boolean = false): Promise<TokenPrices> {
  // Return cached prices if still valid (unless force refresh)
  const now = Date.now();
  if (!forceFresh && cachedPrices && (now - lastFetchTime) < CACHE_DURATION) {
    console.log('Using cached prices:', cachedPrices);
    return cachedPrices;
  }

  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=solana,usd-coin,tether&vs_currencies=usd'
    );
    
    if (!response.ok) {
      console.warn(`Price API error: ${response.status}, using cached or fallback prices`);
      // If rate limited (429), extend cache time
      if (response.status === 429 && cachedPrices) {
        console.log('Rate limited by CoinGecko, using cached prices');
        lastFetchTime = now; // Reset timer to avoid immediate retry
        return cachedPrices;
      }
      // If we have cached prices, return them even if expired
      if (cachedPrices) {
        return cachedPrices;
      }
      throw new Error(`Price API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    const prices: TokenPrices = {
      sol: data.solana?.usd || 0,
      usdc: data['usd-coin']?.usd || 1, // USDC is pegged to $1
      usdt: data.tether?.usd || 1, // USDT is pegged to $1
      mon: 0, // MON is not yet on CoinGecko - will be added when available
    };
    
    // Update cache
    cachedPrices = prices;
    lastFetchTime = now;
    console.log('Fetched fresh prices:', prices);
    
    return prices;
  } catch (error) {
    console.error('Error fetching token prices:', error);
    
    // Return cached prices if available
    if (cachedPrices) {
      console.log('Returning cached prices due to error');
      return cachedPrices;
    }
    
    // Return reasonable fallback prices as last resort
    // Using approximate prices (SOL ~$140, stablecoins at $1)
    return {
      sol: 140,
      usdc: 1,
      usdt: 1,
      mon: 0, // MON testnet has no real value
    };
  }
}

/**
 * Fetch ARS price from Dolarito API
 * Specifically fetches the p2pme sell price
 */
export async function fetchArsPrice(forceFresh: boolean = false): Promise<number> {
  const now = Date.now();
  if (!forceFresh && cachedArsPrice !== null && (now - lastArsFetchTime) < CACHE_DURATION) {
    console.log('Using cached ARS price:', cachedArsPrice);
    return cachedArsPrice;
  }

  try {
    const response = await fetch(
      'https://api.dolarito.ar/api/frontend/quotations/usdt',
      {
        headers: {
          'auth-client': 'f2988deca3ae4e916bfb01406268143b'
        }
      }
    );

    if (!response.ok) {
      console.warn(`ARS Price API error: ${response.status}`);
      if (cachedArsPrice !== null) return cachedArsPrice;
      throw new Error(`ARS Price API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Find p2pme quote
    // The API seems to return an object where keys are the provider names, or an array?
    // Based on the user description: "p2pme": { ... }
    // It's likely an object map.
    
    // Let's assume the response is a map of string -> ArsQuote
    const p2pme = data.p2pme;
    
    if (p2pme && p2pme.sell) {
      cachedArsPrice = p2pme.sell;
      lastArsFetchTime = now;
      console.log('Fetched fresh ARS price:', cachedArsPrice);
      return p2pme.sell;
    }
    
    throw new Error('p2pme quote not found in response');
    
  } catch (error) {
    console.error('Error fetching ARS price:', error);
    if (cachedArsPrice !== null) return cachedArsPrice;
    return 0; // Fallback
  }
}
