-- Create papers table
CREATE TABLE IF NOT EXISTS papers (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  abstract TEXT NOT NULL,
  authors TEXT[] NOT NULL,
  categories TEXT[] NOT NULL,
  published_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create paper_metrics table
CREATE TABLE IF NOT EXISTS paper_metrics (
  id BIGSERIAL PRIMARY KEY,
  paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  downloads_total INTEGER DEFAULT 0 NOT NULL,
  downloads_7d INTEGER DEFAULT 0 NOT NULL,
  github_repo_count INTEGER DEFAULT 0 NOT NULL,
  engagement_score FLOAT NOT NULL,
  UNIQUE(paper_id, snapshot_date)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_metrics_score ON paper_metrics(engagement_score DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_date ON paper_metrics(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_papers_published_at ON papers(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_papers_categories ON papers USING GIN(categories);
