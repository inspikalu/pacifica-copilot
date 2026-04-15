import { env } from "@/lib/env";

export interface ElfaSentiment {
  symbol: string;
  narrative: string;
}

export async function getTokenSentiment(symbol: string): Promise<ElfaSentiment | null> {
  const apiKey = env.ELFA_API_KEY;
  const cleanSymbol = symbol.split("-")[0] || symbol;

  if (!apiKey) {
    // If no API key, mock for hackathon testing purposes
    return {
      symbol,
      narrative: `Mock Elfa AI: Social sentiment indicates high market mindshare but potential downside risk over the next 24 hours.`,
    };
  }

  try {
    const url = new URL("https://api.elfa.ai/v2/data/keyword-mentions");
    url.searchParams.append("keywords", cleanSymbol);
    url.searchParams.append("limit", "10");

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "x-elfa-api-key": apiKey,
      },
    });

    if (!response.ok) {
      console.warn(`[Elfa] API error ${response.status} for ${cleanSymbol}. Falling back.`);
      return { symbol, narrative: `Social sentiment for ${cleanSymbol} is currently adjusting (API rate limited).` };
    }

    const { data } = await response.json();
    
    if (!Array.isArray(data) || data.length === 0) {
      return { symbol, narrative: `Social volume for ${cleanSymbol} is currently low.` };
    }

    // Summarize social volume
    const totalViews = data.reduce((sum, item) => sum + (item.viewCount || 0), 0);
    const totalLikes = data.reduce((sum, item) => sum + (item.likeCount || 0), 0);
    
    return {
      symbol,
      narrative: `Elfa AI detects significant ongoing social activity for ${cleanSymbol} (${data.length} recent top posts, ${totalViews} views, ${totalLikes} likes). Maintain strict risk limits during periods of high mindshare.`,
    };
  } catch (error) {
    console.error("[Elfa] Failed to fetch sentiment:", error);
    return null;
  }
}
