# Expansive Mind

Expansive Mind is a full-stack Next.js application for searching NIH PubMed Central papers, opening a paper-specific chat, and saving conversations by user account. The app combines NIH/PMC search data, paper parsing, and an AI assistant that is instructed to answer using the selected paper as its source of truth.

## Features

- Search research papers from NIH PubMed Central using topic keywords.
- Open an individual paper view and chat about its findings.
- Keep responses grounded in the selected paper instead of general web knowledge.
- Create an account, log in, and persist saved papers and chat history.
- Reopen previously saved papers and continue the conversation.

## Tech Stack

- Next.js 15 with the App Router
- React 19
- TypeScript
- SCSS modules
- MongoDB with Mongoose
- JWT-based authentication with cookies
- OpenAI SDK configured against OpenRouter
- NIH E-Utilities / PubMed Central API

## How It Works

1. A user signs up or logs in.
2. The app searches NIH PubMed Central for papers matching a query.
3. Selecting a result loads the paper content and any previously saved messages.
4. User questions are sent to the AI route together with the parsed paper and message history.
5. The response and conversation are stored in MongoDB so the paper can be reopened later.

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
```

Notes:

- `MONGODB_URI` is used for users, saved papers, and stored messages.
- `JWT_SECRET` signs and verifies authentication tokens.
- `API_KEY` is used for NIH E-Utilities requests.
- `AI_API_KEY` is used by the OpenRouter-backed AI chat client.

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
	api/            Server routes for auth, search, paper fetch, and chat
	components/     Reusable UI components
	db/             MongoDB connection logic
	models/         Mongoose models for users, papers, and messages
	paperchatbot/   Paper-specific chat page
	savedpapers/    Saved paper history view
	searchpaper/    Search results and pagination UI
```

## API Overview

- `/api/signup` creates a new user account.
- `/api/login` authenticates a user and sets an auth cookie.
- `/api/search` searches NIH PMC for paper matches.
- `/api/paper` fetches a paper and restores stored messages for that paper.
- `/api/aichat` sends the user question plus paper context to the AI model and stores the response.
- `/api/all-user-papers` returns saved papers for the logged-in user.
- `/api/delete-paper` removes a saved paper.

## Authentication

Protected routes use middleware and server-side auth helpers to verify the JWT stored in the `auth_token` cookie. Search, paper chat, and saved paper flows rely on an authenticated user.

## Data Source

Search results and paper content are sourced from [NIH PubMed Central](https://www.ncbi.nlm.nih.gov/pmc/) through the NIH E-Utilities API.

## Status

This project is an active research assistant prototype. The current implementation already supports NIH PMC search, paper-grounded AI chat, account-based persistence, and saved paper management, with room to expand to additional literature databases in the future.
