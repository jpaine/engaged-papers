// GitHub API integration for counting repositories mentioning arXiv IDs

export async function searchRepoCountForArxivId(arxivId: string): Promise<number> {
  const token = process.env.GITHUB_TOKEN;
  
  if (!token) {
    // Gracefully skip if no token
    return 0;
  }

  try {
    // Search for repositories mentioning the arXiv ID
    // Format: "2401.12345" or "arxiv:2401.12345"
    const query = `"${arxivId}" OR "arxiv:${arxivId}"`;
    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&per_page=1`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'engaged-papers',
      },
    });

    if (!response.ok) {
      if (response.status === 403) {
        // Rate limit or forbidden
        console.warn(`GitHub API rate limit or forbidden for ${arxivId}`);
        return 0;
      }
      if (response.status === 404) {
        return 0;
      }
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const totalCount = data.total_count || 0;
    
    // Cap at 1000 to avoid extreme outliers
    return Math.min(totalCount, 1000);
  } catch (error) {
    console.error(`Error searching GitHub for ${arxivId}:`, error);
    return 0;
  }
}
