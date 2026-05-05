# syududu Project Brief

This file is the source of truth for work in this repo.

## Product

Build a PWA web app called `syududu`: a personal quick-capture note app with a chat-like UI.

## Stack

- React + Vite + TypeScript
- Tailwind CSS
- shadcn/ui
- `vite-plugin-pwa`
- Dexie.js for IndexedDB offline storage
- Supabase JS client
- React Router v7
- `react-markdown` + `react-syntax-highlighter`

Do not reinstall core stack packages that are already present.

## Core Features

1. Auth with email/password via Supabase.
2. Groups/channels sidebar with create, rename, delete.
3. Chat-like message feed per group, newest at bottom.
4. Quick input bar at bottom; Enter saves note.
5. Markdown rendering with code block support.
6. Full-text search across all notes.
7. Timestamps on each note.
8. PWA installability on Android and iOS, offline support via service worker.
9. Offline-first flow: write to IndexedDB first, sync to Supabase when online.

## Project Structure

Target structure:

```text
src/
├── features/
│   ├── auth/
│   ├── groups/
│   └── notes/
├── components/      # shared shadcn + custom UI
├── lib/
│   ├── supabase.ts
│   └── db.ts        # Dexie config
└── hooks/
```

## Database Schema

Supabase tables:

- `users`: handled by Supabase Auth
- `groups`: `id`, `user_id`, `name`, `created_at`
- `notes`: `id`, `user_id`, `group_id`, `content`, `created_at`

## Implementation Rules

- Use shadcn/ui components throughout where they fit: `Button`, `Input`, `Dialog`, `ScrollArea`, and similar.
- Keep design mobile-first and responsive.
- Support dark mode via Tailwind and shadcn theming.
- Use `.env` for `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (fallback `VITE_SUPABASE_ANON_KEY` still supported).
- Add a `README` with setup instructions and Supabase SQL migration.
- Keep architecture clean and aligned with the structure above.
- Prefer offline-first behavior and sync-safe data flow over direct-to-network writes.

## Workflow

- Use `rtk` for shell commands in this repo.
- Prefer small, targeted changes that fit existing structure.
- If a task affects auth, storage, sync, or PWA behavior, check assumptions before coding.
