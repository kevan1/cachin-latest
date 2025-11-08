/**
 * Service for fetching cryptocurrency prices
 */

export interface TokenPrices {
  sol: number;
  usdc: number;
  usdt: number;
}

// Price cache
let cachedPrices: TokenPrices | null = null;
let lastFetchTime: number = 0;
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
    };
  }
}
