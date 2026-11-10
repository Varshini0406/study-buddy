# Study Buddy

A responsive AI learning workspace for asking questions, studying uploaded files and images, practicing with a topic quiz, and revisiting saved conversations.

## Run locally

1. Install Node.js 20.9 or later.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local` and add a Google Gemini API key as `GEMINI_API_KEY`.
4. Run `npm run dev` and open the local address printed in the terminal.

The API key is read only by the server route and must never be prefixed with `NEXT_PUBLIC_`. Get a key from Google AI Studio. Without a configured key, the app still loads, but AI answers are disabled with a setup message.

## Deploy to Vercel

1. Push this project to a Git provider and import it into Vercel as a Next.js project.
2. In the Vercel project settings, add `GEMINI_API_KEY` as an environment variable for the deployments you use.
3. Deploy. Vercel detects the Next.js build and API route automatically.

Conversations and uploaded files are stored in the visitor's browser using IndexedDB. They are not synced between devices or sent to an application database. Uploaded files are sent to Gemini when a question is submitted. Supported files: PDF, PNG, JPEG, WebP, GIF, plain text, Markdown, CSV, and JSON, up to 3 MB each to stay within serverless request limits.