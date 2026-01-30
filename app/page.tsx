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

export default function Home() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('All');
  const [minScore, setMinScore] = useState(0);

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
    } catch (error) {
      console.error('Error fetching papers:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <Link href="/" className="flex items-center px-2 py-2 text-xl font-bold text-gray-900">
                Engaged Papers
              </Link>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <Link href="/" className="border-b-2 border-blue-500 text-gray-900 inline-flex items-center px-1 pt-1 text-sm font-medium">
                  Recent
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
          <h1 className="text-3xl font-bold text-gray-900">Recent Papers (Last 7 Days)</h1>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat === 'All' ? '' : cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="minScore" className="block text-sm font-medium text-gray-700 mb-1">
                Min Score
              </label>
              <input
                id="minScore"
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={minScore}
                onChange={(e) => setMinScore(parseFloat(e.target.value) || 0)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
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
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {papers.map((paper) => (
                <li key={paper.id}>
                  <Link href={`/paper/${paper.id}`} className="block hover:bg-gray-50">
                    <div className="px-4 py-4 sm:px-6">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-blue-600 truncate">
                            {paper.id}
                          </p>
                          <p className="mt-1 text-lg font-semibold text-gray-900">
                            {paper.title}
                          </p>
                          <p className="mt-2 text-sm text-gray-500 line-clamp-2">
                            {paper.abstract}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {paper.categories.map((cat) => (
                              <span
                                key={cat}
                                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                              >
                                {cat}
                              </span>
                            ))}
                          </div>
                          <p className="mt-2 text-sm text-gray-500">
                            {paper.authors.join(', ')}
                          </p>
                        </div>
                        {paper.metrics && (
                          <div className="ml-4 flex-shrink-0 text-right">
                            <p className="text-sm font-medium text-gray-900">
                              Score: {paper.metrics.engagement_score.toFixed(3)}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}
