'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

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

export default function PaperDetail() {
  const params = useParams();
  const paperId = params.id as string;
  const [paper, setPaper] = useState<Paper | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (paperId) {
      fetchPaper();
    }
  }, [paperId]);

  async function fetchPaper() {
    setLoading(true);
    try {
      const response = await fetch(`/api/papers?fromDate=2020-01-01`);
      const data = await response.json();
      const found = data.find((p: Paper) => p.id === paperId);
      setPaper(found || null);
    } catch (error) {
      console.error('Error fetching paper:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex">
                <Link href="/" className="flex items-center px-2 py-2 text-xl font-bold text-gray-900">
                  Engaged Papers
                </Link>
              </div>
            </div>
          </div>
        </nav>
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <p className="text-gray-500">Loading paper...</p>
          </div>
        </main>
      </div>
    );
  }

  if (!paper) {
    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex">
                <Link href="/" className="flex items-center px-2 py-2 text-xl font-bold text-gray-900">
                  Engaged Papers
                </Link>
              </div>
            </div>
          </div>
        </nav>
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <p className="text-gray-500">Paper not found.</p>
            <Link href="/" className="mt-4 text-blue-600 hover:text-blue-800">
              ← Back to papers
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const arxivUrl = `https://arxiv.org/abs/${paper.id}`;
  const publishedDate = new Date(paper.published_at).toLocaleDateString();
  const updatedDate = new Date(paper.updated_at).toLocaleDateString();

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <Link href="/" className="flex items-center px-2 py-2 text-xl font-bold text-gray-900">
                Engaged Papers
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/" className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
          ← Back to papers
        </Link>

        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-3xl font-bold text-gray-900">{paper.title}</h1>
              {paper.metrics && (
                <div className="text-right">
                  <p className="text-lg font-semibold text-gray-900">
                    Engagement Score: {paper.metrics.engagement_score.toFixed(3)}
                  </p>
                </div>
              )}
            </div>

            <div className="mb-4">
              <p className="text-sm font-medium text-blue-600 mb-2">
                arXiv: {paper.id}
              </p>
              <div className="flex flex-wrap gap-2 mb-4">
                {paper.categories.map((cat) => (
                  <span
                    key={cat}
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                  >
                    {cat}
                  </span>
                ))}
              </div>
            </div>

            <div className="border-t border-gray-200 pt-4">
              <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Authors</dt>
                  <dd className="mt-1 text-sm text-gray-900">{paper.authors.join(', ')}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Published</dt>
                  <dd className="mt-1 text-sm text-gray-900">{publishedDate}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
                  <dd className="mt-1 text-sm text-gray-900">{updatedDate}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">arXiv Link</dt>
                  <dd className="mt-1 text-sm">
                    <a
                      href={arxivUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800"
                    >
                      {arxivUrl}
                    </a>
                  </dd>
                </div>
              </dl>
            </div>

            {paper.metrics && (
              <div className="border-t border-gray-200 pt-4 mt-4">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">Latest Metrics</h2>
                <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Snapshot Date</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {new Date(paper.metrics.snapshot_date).toLocaleDateString()}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Engagement Score</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {paper.metrics.engagement_score.toFixed(3)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">GitHub Repositories</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {paper.metrics.github_repo_count}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Downloads (7d)</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {paper.metrics.downloads_7d} (stub)
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Downloads (Total)</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {paper.metrics.downloads_total} (stub)
                    </dd>
                  </div>
                </dl>
              </div>
            )}

            <div className="border-t border-gray-200 pt-4 mt-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Abstract</h2>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{paper.abstract}</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
