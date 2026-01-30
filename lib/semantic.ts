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
 * Processes in batches to avoid hitting rate limits
 */
export async function fetchCitationCountsBatch(
  arxivIds: string[],
  batchSize: number = 10,
  delayMs: number = 200
): Promise<Map<string, number>> {
  const results = new Map<string, number>();
  
  for (let i = 0; i < arxivIds.length; i += batchSize) {
    const batch = arxivIds.slice(i, i + batchSize);
    
    // Process batch in parallel
    const batchPromises = batch.map(async (arxivId) => {
      const count = await fetchCitationCount(arxivId);
      return { arxivId, count };
    });
    
    const batchResults = await Promise.all(batchPromises);
    
    for (const { arxivId, count } of batchResults) {
      results.set(arxivId, count);
    }
    
    // Delay between batches to respect rate limits
    if (i + batchSize < arxivIds.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  return results;
}
