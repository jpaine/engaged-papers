'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface PaperMetric {
  snapshot_date: string;
  downloads_total: number;
  downloads_7d: number;
  github_repo_count: number;
  engagement_score: number;
}

interface Paper {
  id: string;
  title: string;
  abstract: string;
  authors: string[];
  categories: string[];
  published_at: string;
  updated_at: string;
  created_at?: string;
  metrics?: PaperMetric;
}

const CATEGORIES = ['All', 'cs.AI', 'cs.LG', 'stat.ML'];
const ITEMS_PER_PAGE = [50, 100, 200, 500];

export default function Home() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('All');
  const [minScore, setMinScore] = useState(0);
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  useEffect(() => {
    fetchPapers();
  }, [category, minScore]);

  async function fetchPapers() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      const fromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      params.set('fromDate', fromDate);
      if (category !== 'All') {
        params.set('category', category);
      }
      if (minScore > 0) {
        params.set('minScore', minScore.toString());
      }

      const response = await fetch(`/api/papers?${params.toString()}`);
      const data = await response.json();
      setPapers(data);
      setPage(1); // Reset to first page when filters change
    } catch (error) {
      console.error('Error fetching papers:', error);
    } finally {
      setLoading(false);
    }
  }

  const totalPages = Math.ceil(papers.length / itemsPerPage);
  const startIndex = (page - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedPapers = papers.slice(startIndex, endIndex);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-white">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <Link href="/" className="flex items-center px-2 py-2 text-xl font-semibold text-gray-900">
                Engaged Papers
              </Link>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <Link href="/" className="border-b-2 border-gray-900 text-gray-900 inline-flex items-center px-1 pt-1 text-sm font-medium">
                  Papers
                </Link>
                <Link href="/rising" className="border-b-2 border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 text-sm font-medium">
                  Rising
                </Link>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Papers</h1>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <div>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-gray-500 focus:ring-gray-500 sm:text-sm py-1.5 px-3"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat === 'All' ? '' : cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <input
                id="minScore"
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={minScore}
                onChange={(e) => setMinScore(parseFloat(e.target.value) || 0)}
                placeholder="Min Score"
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-gray-500 focus:ring-gray-500 sm:text-sm py-1.5 px-3"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Loading papers...</p>
          </div>
        ) : papers.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No papers found.</p>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing {startIndex + 1}-{Math.min(endIndex, papers.length)} of {papers.length} papers
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Show:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setPage(1);
                  }}
                  className="rounded-md border-gray-300 shadow-sm focus:border-gray-500 focus:ring-gray-500 sm:text-sm py-1 px-2"
                >
                  {ITEMS_PER_PAGE.map((num) => (
                    <option key={num} value={num}>{num}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        #
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Paper
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Category
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Score
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Published
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Authors
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedPapers.map((paper, index) => (
                      <tr key={paper.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {startIndex + index + 1}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <Link 
                              href={`/paper/${paper.id}`}
                              className="text-sm font-medium text-blue-600 hover:text-blue-800"
                            >
                              {paper.id}
                            </Link>
                            <p className="text-sm font-semibold text-gray-900 mt-1 line-clamp-2">
                              {paper.title}
                            </p>
                            <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                              {paper.abstract}
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-wrap gap-1">
                            {paper.categories.slice(0, 2).map((cat) => (
                              <span
                                key={cat}
                                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800"
                              >
                                {cat}
                              </span>
                            ))}
                            {paper.categories.length > 2 && (
                              <span className="text-xs text-gray-500">+{paper.categories.length - 2}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {paper.metrics ? paper.metrics.engagement_score.toFixed(3) : '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(paper.published_at)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          <div className="max-w-xs truncate">
                            {paper.authors.slice(0, 2).join(', ')}
                            {paper.authors.length > 2 && ' et al.'}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Page {page} of {totalPages}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    « Prev
                  </button>
                  <button
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next »
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
