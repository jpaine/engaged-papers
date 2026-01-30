# Engaged Papers

Track engagement signals for arXiv papers in AI, Machine Learning, and Statistics.

## Features

- **arXiv Ingestion**: Automatically fetches papers from cs.AI, cs.LG, and stat.ML categories
- **Engagement Signals**: Tracks GitHub repository mentions and computes engagement scores
- **Daily Snapshots**: Maintains historical metrics for trend analysis
- **Rising Papers**: Identifies top papers by engagement score
- **Filtering**: Filter by category and minimum engagement score

## Tech Stack

- **Next.js 16** (App Router) with TypeScript
- **Supabase Postgres** (managed via CLI migrations)
- **Vercel** deployment with cron jobs
- **Tailwind CSS** for styling

## Local Setup

### Prerequisites

- Node.js 20+ (required for Next.js 16)
- npm or yarn
- Supabase account (for cloud) or Docker (for local)

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd engaged-papers
```

2. Install dependencies:
```bash
npm install
```

3. Copy environment variables:
```bash
cp env.example .env.local
```

4. Set up your environment variables in `.env.local`:
   - `SUPABASE_URL`: Your Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key (server-side only)
   - `GITHUB_TOKEN`: (Optional) GitHub personal access token for repo counting

### Database Setup

#### Option 1: Supabase Cloud (Recommended)

1. Create a new project at [supabase.com](https://supabase.com)

2. Link your local project to Supabase:
```bash
npx supabase link --project-ref your-project-ref
```

3. Push migrations to cloud:
```bash
npx supabase db push
```

#### Option 2: Local Supabase (Optional)

1. Start local Supabase:
```bash
npx supabase start
```

2. Apply migrations:
```bash
npx supabase migration up
```

### Running Locally

1. Start the development server:
```bash
npm run dev
```

2. Open [http://localhost:3000](http://localhost:3000)

### Running Ingestion Locally

To manually trigger the ingestion process:

```bash
curl http://localhost:3000/api/cron/ingest
```

Or use the Next.js API route directly in your browser while the dev server is running.

## Deployment

### Vercel Deployment

1. Push your code to GitHub:
```bash
git remote add origin <your-github-repo-url>
git push -u origin main
```

2. Import your project in [Vercel](https://vercel.com)

3. Add environment variables in Vercel dashboard:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `GITHUB_TOKEN` (optional)

4. Deploy - Vercel will automatically detect Next.js and deploy

### Cron Job

The ingestion cron job runs every 6 hours automatically via Vercel Cron (configured in `vercel.json`).

To verify cron is working:
1. Check Vercel dashboard → Your Project → Cron Jobs
2. Monitor logs in Vercel dashboard → Functions → `/api/cron/ingest`

## Project Structure

```
engaged-papers/
├── app/
│   ├── api/
│   │   ├── cron/
│   │   │   └── ingest/        # Cron ingestion endpoint
│   │   ├── papers/            # Papers API endpoint
│   │   └── diff/              # Diff API endpoint
│   ├── paper/[id]/            # Paper detail page
│   ├── rising/                # Rising papers page
│   └── page.tsx               # Home page
├── lib/
│   ├── arxiv.ts               # arXiv fetching logic
│   ├── github.ts              # GitHub API integration
│   ├── scoring.ts             # Engagement score computation
│   └── supabase.ts            # Supabase client
├── supabase/
│   └── migrations/            # Database migrations
└── vercel.json                # Vercel cron configuration
```

## API Endpoints

### GET /api/papers

Query parameters:
- `fromDate` (optional): Filter papers published after this date (YYYY-MM-DD)
- `category` (optional): Filter by category (cs.AI, cs.LG, stat.ML)
- `minScore` (optional): Minimum engagement score (0-1)

Example:
```
GET /api/papers?fromDate=2024-01-01&category=cs.AI&minScore=0.1
```

### GET /api/diff

Returns new papers (last 24h) and rising papers (top 10% by score, last 7d).

Example:
```
GET /api/diff
```

Response:
```json
{
  "newPapers": [...],
  "risingPapers": [...]
}
```

### GET /api/cron/ingest

Ingests papers from the last 24 hours. Called automatically by Vercel Cron every 6 hours.

## Database Schema

### papers
- `id` (text, PK): arXiv ID (e.g., "2401.12345")
- `title` (text): Paper title
- `abstract` (text): Paper abstract
- `authors` (text[]): Array of author names
- `categories` (text[]): Array of arXiv categories
- `published_at` (timestamptz): Publication date
- `updated_at` (timestamptz): Last update date
- `created_at` (timestamptz): Record creation date

### paper_metrics
- `id` (bigint, PK): Auto-increment ID
- `paper_id` (text, FK): References papers.id
- `snapshot_date` (date): Date of the snapshot
- `downloads_total` (int): Total downloads (stub for MVP)
- `downloads_7d` (int): Downloads in last 7 days (stub for MVP)
- `github_repo_count` (int): Number of GitHub repos mentioning the paper
- `engagement_score` (float): Computed engagement score (0-1)

Unique constraint: `(paper_id, snapshot_date)`

## Engagement Score Formula

```
engagementScore = 0.6 * normalize(downloads_7d) + 0.4 * normalize(github_repo_count)
```

For MVP, `downloads_7d` is stubbed to 0, so the score is based only on GitHub repo count normalization.

## Manual Steps Checklist

After cloning and setting up:

- [ ] Create Supabase project at [supabase.com](https://supabase.com)
- [ ] Link local project: `npx supabase link --project-ref <your-ref>`
- [ ] Push migrations: `npx supabase db push`
- [ ] Copy `env.example` to `.env.local` and fill in values
- [ ] (Optional) Create GitHub personal access token for repo counting
- [ ] Test locally: `npm run dev`
- [ ] Test ingestion: `curl http://localhost:3000/api/cron/ingest`
- [ ] Push to GitHub: `git push -u origin main`
- [ ] Import project in Vercel
- [ ] Add environment variables in Vercel dashboard
- [ ] Deploy and verify cron job is running

## License

MIT
