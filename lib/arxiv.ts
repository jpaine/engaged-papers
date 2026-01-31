import { XMLParser } from 'fast-xml-parser';

export interface ArxivPaper {
  id: string;
  title: string;
  abstract: string;
  authors: string[];
  categories: string[];
  published_at: string;
  updated_at: string;
}

// Extract arXiv ID from full ID (e.g., "http://arxiv.org/abs/2401.12345v1" -> "2401.12345")
function extractArxivId(fullId: string): string {
  const match = fullId.match(/arxiv\.org\/abs\/(\d{4}\.\d{4,5})/);
  return match ? match[1] : fullId.split('/').pop()?.replace('v1', '').replace('v2', '').replace('v3', '').replace('v4', '').replace('v5', '') || '';
}

export async function fetchRecentPapers(hoursBack: number): Promise<ArxivPaper[]> {
  const categories = ['cs.AI', 'cs.LG', 'stat.ML'];
  const cutoffDate = new Date();
  cutoffDate.setHours(cutoffDate.getHours() - hoursBack);

  const allPapers: ArxivPaper[] = [];

  for (const category of categories) {
    // Fetch recent papers without date filtering in query (more reliable)
    // We'll filter by date in code after fetching
    const url = `http://export.arxiv.org/api/query?search_query=cat:${category}&sortBy=submittedDate&sortOrder=descending&max_results=200`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`Failed to fetch ${category}: ${response.statusText}`);
        continue;
      }

      const xmlText = await response.text();
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        textNodeName: '#text',
      });

      const result = parser.parse(xmlText);
      const entries = result.feed?.entry || [];
      
      if (!Array.isArray(entries)) {
        continue;
      }

      for (const entry of entries) {
        const published = entry.published?.['#text'] || entry.published;
        const updated = entry.updated?.['#text'] || entry.updated;
        
        // Parse dates and check if within time window
        const publishedDate = published ? new Date(published) : null;
        const updatedDate = updated ? new Date(updated) : null;
        
        // Include paper if published or updated within the time window
        const isRecent = (publishedDate && publishedDate >= cutoffDate) || 
                        (updatedDate && updatedDate >= cutoffDate);
        
        if (!isRecent) {
          continue;
        }

        const fullId = entry.id?.['#text'] || entry.id || '';
        const arxivId = extractArxivId(fullId);
        
        if (!arxivId) {
          continue;
        }

        const title = entry.title?.['#text'] || entry.title || '';
        const abstract = entry.summary?.['#text'] || entry.summary || '';
        
        // Extract authors
        const authors: string[] = [];
        const authorEntries = entry.author || [];
        const authorArray = Array.isArray(authorEntries) ? authorEntries : [authorEntries];
        for (const author of authorArray) {
          const name = author.name?.['#text'] || author.name;
          if (name) {
            authors.push(name);
          }
        }

        // Extract categories
        const categories: string[] = [];
        const categoryEntries = entry.category || [];
        const categoryArray = Array.isArray(categoryEntries) ? categoryEntries : [categoryEntries];
        for (const cat of categoryArray) {
          const term = cat['@_term'] || cat.term;
          if (term && (term.startsWith('cs.') || term.startsWith('stat.'))) {
            categories.push(term);
          }
        }

        // Only include if it's one of our target categories
        if (!categories.some(cat => ['cs.AI', 'cs.LG', 'stat.ML'].includes(cat))) {
          continue;
        }

        allPapers.push({
          id: arxivId,
          title: title.trim(),
          abstract: abstract.trim(),
          authors,
          categories: [...new Set(categories)], // Deduplicate
          published_at: publishedDate?.toISOString() || new Date().toISOString(),
          updated_at: updatedDate?.toISOString() || publishedDate?.toISOString() || new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error(`Error fetching ${category}:`, error);
    }
  }

  // Deduplicate by ID
  const uniquePapers = new Map<string, ArxivPaper>();
  for (const paper of allPapers) {
    if (!uniquePapers.has(paper.id)) {
      uniquePapers.set(paper.id, paper);
    }
  }

  return Array.from(uniquePapers.values());
}

/**
 * Fetch papers from a date range (for backfilling)
 * Fetches papers in batches and filters by date in code (more reliable than API date filtering)
 */
export async function fetchPapersByDateRange(
  startDate: Date,
  endDate: Date
): Promise<ArxivPaper[]> {
  const categories = ['cs.AI', 'cs.LG', 'stat.ML'];
  const allPapers: ArxivPaper[] = [];

  console.log(`Fetching papers from ${startDate.toISOString()} to ${endDate.toISOString()}...`);

  for (const category of categories) {
    // Fetch papers in batches - arXiv API returns up to 2000 results per query
    // We'll fetch multiple batches to cover the date range
    let startIndex = 0;
    const batchSize = 2000;
    let hasMore = true;
    let batchCount = 0;
    // For small date ranges (7 days), 1 batch should be enough (~2000 papers)
    // For larger ranges, increase maxBatches
    const maxBatches = 1; // Start with 1 batch to avoid timeouts

    while (hasMore && batchCount < maxBatches) {
      const url = `http://export.arxiv.org/api/query?search_query=cat:${category}&sortBy=submittedDate&sortOrder=descending&start=${startIndex}&max_results=${batchSize}`;

      try {
        console.log(`Fetching ${category} batch ${batchCount + 1} (start=${startIndex})...`);
        const response = await fetch(url);
        if (!response.ok) {
          console.warn(`Failed to fetch ${category} batch ${batchCount + 1}: ${response.statusText}`);
          break;
        }

        const xmlText = await response.text();
        const parser = new XMLParser({
          ignoreAttributes: false,
          attributeNamePrefix: '@_',
          textNodeName: '#text',
        });

        const result = parser.parse(xmlText);
        const entries = result.feed?.entry || [];

        if (!Array.isArray(entries) || entries.length === 0) {
          hasMore = false;
          break;
        }

        let papersInRange = 0;
        let papersOutOfRange = 0;

        for (const entry of entries) {
          const published = entry.published?.['#text'] || entry.published;
          const updated = entry.updated?.['#text'] || entry.updated;

          const publishedDate = published ? new Date(published) : null;
          const updatedDate = updated ? new Date(updated) : null;

          // Filter by date range
          const isInRange = (publishedDate && publishedDate >= startDate && publishedDate <= endDate) ||
                           (updatedDate && updatedDate >= startDate && updatedDate <= endDate);

          if (!isInRange) {
            papersOutOfRange++;
            // If we're getting papers that are too old, we can stop fetching more batches
            if (publishedDate && publishedDate < startDate) {
              hasMore = false;
              break;
            }
            continue;
          }

          papersInRange++;

          const fullId = entry.id?.['#text'] || entry.id || '';
          const arxivId = extractArxivId(fullId);

          if (!arxivId) {
            continue;
          }

          const title = entry.title?.['#text'] || entry.title || '';
          const abstract = entry.summary?.['#text'] || entry.summary || '';

          const authors: string[] = [];
          const authorEntries = entry.author || [];
          const authorArray = Array.isArray(authorEntries) ? authorEntries : [authorEntries];
          for (const author of authorArray) {
            const name = author.name?.['#text'] || author.name;
            if (name) {
              authors.push(name);
            }
          }

          const categories: string[] = [];
          const categoryEntries = entry.category || [];
          const categoryArray = Array.isArray(categoryEntries) ? categoryEntries : [categoryEntries];
          for (const cat of categoryArray) {
            const term = cat['@_term'] || cat.term;
            if (term && (term.startsWith('cs.') || term.startsWith('stat.'))) {
              categories.push(term);
            }
          }

          if (!categories.some(cat => ['cs.AI', 'cs.LG', 'stat.ML'].includes(cat))) {
            continue;
          }

          allPapers.push({
            id: arxivId,
            title: title.trim(),
            abstract: abstract.trim(),
            authors,
            categories: [...new Set(categories)],
            published_at: publishedDate?.toISOString() || new Date().toISOString(),
            updated_at: updatedDate?.toISOString() || publishedDate?.toISOString() || new Date().toISOString(),
          });
        }

        console.log(`  Batch ${batchCount + 1}: ${papersInRange} papers in range, ${papersOutOfRange} out of range`);

        // If we got fewer results than requested, we've reached the end
        if (entries.length < batchSize) {
          hasMore = false;
        }

        // If all papers in this batch were out of range and too old, stop
        if (papersInRange === 0 && papersOutOfRange > 0) {
          hasMore = false;
        }

        startIndex += batchSize;
        batchCount++;

        // Small delay between requests to be respectful (reduced for speed)
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`Error fetching ${category} batch ${batchCount + 1}:`, error);
        break;
      }
    }
  }

  // Deduplicate by ID
  const uniquePapers = new Map<string, ArxivPaper>();
  for (const paper of allPapers) {
    if (!uniquePapers.has(paper.id)) {
      uniquePapers.set(paper.id, paper);
    }
  }

  console.log(`Fetched ${uniquePapers.size} unique papers from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
  return Array.from(uniquePapers.values());
}
