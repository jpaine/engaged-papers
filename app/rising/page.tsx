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
                <Link href="/" className="border-b-2 border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 text-sm font-medium">
                  Papers
                </Link>
                <Link href="/rising" className="border-b-2 border-gray-900 text-gray-900 inline-flex items-center px-1 pt-1 text-sm font-medium">
                  Rising
                </Link>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Top 25 Rising Papers</h1>
          <p className="text-sm text-gray-500 mt-1">Last 7 days by engagement score</p>
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
                  {papers.map((paper, index) => (
                    <tr key={paper.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                        {index + 1}
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
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
        )}
      </main>
    </div>
  );
}
