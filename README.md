# Expansive Mind

Expansive Mind is a discovery-first research workspace. It synthesizes evidence across open literature, connects every claim to its source papers, supports paper-grounded reading and chat, and turns promising evidence gaps into saved research plans.

## Features

- Discover a research question across Springer Nature, NIH PubMed Central, and Google Scholar.
- Compare findings, contradictions, limitations, and open research opportunities in a topic synthesis.
- Open cited papers in a focused reader and ask questions grounded in the selected paper.
- Use quick Search when you already know the topic or paper you need.
- Keep papers, topic syntheses, and research plans together in one Research Library.
- Turn a discovery gap into a step-by-step research plan.
- Share paper summaries and topic syntheses by public link.
- Use a limited public search, Free account quotas, or Researcher Pro.
- Subscribe through Stripe Checkout and manage billing in Stripe's portal.

## Tech Stack

- Next.js 15 with the App Router
- React 19
- TypeScript
- SCSS modules
- MongoDB with Mongoose
- JWT-based authentication with cookies
- OpenAI SDK configured against OpenRouter
- NIH E-Utilities / PubMed Central, Springer Nature, and SerpApi

## How It Works

1. A user asks a research question in Discover.
2. The discovery agent searches eligible literature, extracts evidence, and creates a topic synthesis.
3. The user evaluates claims and opens any cited paper in the source-grounded reader.
4. Saved papers, syntheses, and plans remain available in the Research Library.
5. A promising evidence gap can become a research plan with trackable next steps.

## Local Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Add environment variables

Create a `.env.local` file in the project root with the following values:

```env
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
API_KEY=your_nih_eutilities_api_key
AI_API_KEY=your_openrouter_api_key
RATE_LIMIT_SECRET=your_random_rate_limit_secret
SPRINGER_API_KEY=your_springer_api_key
SERPAPI_KEY=your_serpapi_key
STRIPE_SECRET_KEY=sk_test_or_live_key
STRIPE_WEBHOOK_SECRET=whsec_webhook_signing_secret
STRIPE_PRICE_MONTHLY=price_monthly_recurring_id
STRIPE_PRICE_ANNUAL=price_annual_recurring_id
ADMIN_EMAILS=owner@example.com
```

Notes:

- `MONGODB_URI` is used for users, saved papers, and stored messages.
- `JWT_SECRET` signs and verifies authentication tokens.
- `API_KEY` is used for NIH E-Utilities requests.
- `AI_API_KEY` is used by the OpenRouter-backed AI chat client.
- Stripe price IDs provide the initial recurring monthly and annual prices.
- `ADMIN_EMAILS` accepts a comma-separated list. Matching signed-in users have
  unlimited product quotas and access to `/admin`.

### Stripe setup

1. Create a Stripe product named `Researcher Pro`.
2. Add recurring USD prices for `$12 monthly` and `$99 yearly`.
3. Put the resulting price IDs in `STRIPE_PRICE_MONTHLY` and
   `STRIPE_PRICE_ANNUAL`.
4. Add a webhook endpoint at `/api/billing/webhook` and subscribe it to
   `customer.subscription.created`, `customer.subscription.updated`, and
   `customer.subscription.deleted`.
5. Put the endpoint signing secret in `STRIPE_WEBHOOK_SECRET`.

Use Stripe test-mode keys and cards until the subscription lifecycle has been
verified end to end. The webhook, not the browser redirect, grants Pro access.

### Admin portal

Sign in with an email listed in `ADMIN_EMAILS`, then open `/admin`. The portal
can change prices and usage limits, grant complimentary Pro access, reset
usage, schedule subscription cancellation, refund the latest eligible charge,
and review usage and the admin audit log. Price changes create new Stripe Price
objects for future checkouts; existing subscribers remain on their original
price.

### 3. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Available Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Project Structure

```text
src/app/
	api/            Auth, discovery, search, paper, chat, project, and billing routes
	discover/       Multi-paper synthesis and opportunity reports
	components/     Reusable UI components
	db/             MongoDB connection logic
	models/         Mongoose models for users and saved research artifacts
	paperchatbot/   Source-grounded paper reader and chat
	projects/       Research-plan detail views
	savedpapers/    Unified Research Library
	searchpaper/    Quick paper search and pagination
```

## API Overview

- `/api/signup` creates a new user account.
- `/api/login` authenticates a user and sets an auth cookie.
- `/api/discover` creates and lists multi-paper topic syntheses.
- `/api/search` searches NIH and Springer by default; Scholar is an explicit
  capped Pro source.
- `/api/paper` fetches a paper and restores stored messages for that paper.
- `/api/aichat` sends the user question plus paper context to the AI model and stores the response.
- `/api/all-user-papers` returns saved papers for the logged-in user.
- `/api/delete-paper` removes a saved paper.
- `/api/projects` creates and lists research plans derived from discovery gaps.
- `/api/billing/checkout` and `/api/billing/portal` create Stripe sessions.
- `/api/admin/usage` reports the last 30 days of metered provider cost to
  addresses configured in `ADMIN_EMAILS`.

## Authentication

Protected routes use middleware and server-side auth helpers to verify the JWT
stored in the `auth_token` cookie. Search and paper reading are public under
guest abuse limits; the unified Research Library, chat, projects, billing, and
account history require authentication.

## Data Source

Search and discovery use [NIH PubMed Central](https://www.ncbi.nlm.nih.gov/pmc/), Springer Nature, and Google Scholar metadata. Full text or excerpts are fetched live only when licensing and source access permit it.

## Status

This project is an active research assistant prototype centered on multi-paper discovery, source-grounded reading, and a persistent research workspace.
