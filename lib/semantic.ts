// Semantic Scholar API integration for citation counts

export interface SemanticScholarPaper {
  paperId: string;
  title: string;
  citationCount: number;
  referenceCount: number;
  influentialCitationCount: number;
}

/**
 * Fetch citation data from Semantic Scholar API for an arXiv paper
 * Returns citation count, or 0 if not found or on error
 */
export async function fetchCitationCount(arxivId: string): Promise<number> {
  try {
    // Semantic Scholar API endpoint for arXiv papers
    // Format: https://api.semanticscholar.org/graph/v1/paper/arXiv:{arxivId}
    const url = `https://api.semanticscholar.org/graph/v1/paper/arXiv:${arxivId}?fields=citationCount,referenceCount,influentialCitationCount`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'engaged-papers/1.0',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        // Paper not found in Semantic Scholar
        return 0;
      }
      if (response.status === 429) {
        // Rate limit - wait a bit and return 0
        console.warn(`Semantic Scholar rate limit for ${arxivId}`);
        return 0;
      }
      throw new Error(`Semantic Scholar API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const citationCount = data.citationCount || 0;
    
    // Add a small delay to respect rate limits (100 requests per 5 minutes)
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return citationCount;
  } catch (error) {
    console.error(`Error fetching Semantic Scholar data for ${arxivId}:`, error);
    return 0;
  }
}

/**
 * Fetch citation counts for multiple papers with rate limiting
 * Processes sequentially to avoid hitting rate limits (100 requests per 5 minutes)
 */
export async function fetchCitationCountsBatch(
  arxivIds: string[],
  batchSize: number = 1,
  delayMs: number = 3000
): Promise<Map<string, number>> {
  const results = new Map<string, number>();
  
  // Process sequentially with delays to respect rate limits
  // Semantic Scholar allows 100 requests per 5 minutes without API key
  for (let i = 0; i < arxivIds.length; i++) {
    const arxivId = arxivIds[i];
    
    try {
      const count = await fetchCitationCount(arxivId);
      results.set(arxivId, count);
      
      // Delay between requests (3 seconds = ~20 requests per minute = safe limit)
      if (i < arxivIds.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    } catch (error) {
      console.error(`Error fetching citation for ${arxivId}:`, error);
      results.set(arxivId, 0);
    }
  }
  
  return results;
}
