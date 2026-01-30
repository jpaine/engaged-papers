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

export default function Rising() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRising();
  }, []);

  async function fetchRising() {
    setLoading(true);
    try {
      const response = await fetch('/api/papers?fromDate=' + new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
      const data = await response.json();
      // Sort by engagement score and take top 25
      const sorted = data.sort((a: Paper, b: Paper) => {
        const scoreA = a.metrics?.engagement_score || 0;
        const scoreB = b.metrics?.engagement_score || 0;
        return scoreB - scoreA;
      });
      setPapers(sorted.slice(0, 25));
    } catch (error) {
      console.error('Error fetching rising papers:', error);
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
                <Link href="/" className="border-b-2 border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 text-sm font-medium">
                  Recent
                </Link>
                <Link href="/rising" className="border-b-2 border-blue-500 text-gray-900 inline-flex items-center px-1 pt-1 text-sm font-medium">
                  Rising
                </Link>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Top 25 Rising Papers (Last 7 Days)</h1>

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
              {papers.map((paper, index) => (
                <li key={paper.id}>
                  <Link href={`/paper/${paper.id}`} className="block hover:bg-gray-50">
                    <div className="px-4 py-4 sm:px-6">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-gray-400">#{index + 1}</span>
                            <p className="text-sm font-medium text-blue-600 truncate">
                              {paper.id}
                            </p>
                          </div>
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
                            <p className="text-xs text-gray-500">
                              GitHub: {paper.metrics.github_repo_count}
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
