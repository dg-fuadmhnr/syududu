# syududu

Personal quick-capture note app with chat-like UI, offline-first storage, Supabase auth, and PWA support.

## Stack

- React + Vite + TypeScript
- Tailwind CSS + shadcn/ui
- Dexie.js for IndexedDB
- Supabase JS client
- React Router v7
- `vite-plugin-pwa`
- `react-markdown` + `react-syntax-highlighter`

## Setup

1. Install deps.
   ```bash
   npm install
   ```
2. Copy env example.
   ```bash
   cp .env.example .env
   ```
3. Fill `.env` with:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
4. Create Supabase tables and RLS policies from SQL in this README.
   - If `note_attachments` is missing in an existing Supabase project, note text still works, but image sync stays disabled until that migration is applied.
   - If `note_tags` or `pinned_at` is missing, tags and pin sync stay local until the migration is applied.
5. Run app.
   ```bash
   npm run dev
   ```

## `.env.example`

Keep these keys in `.env.example`:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

## Supabase SQL

Run this in Supabase SQL editor.

```sql
create extension if not exists pgcrypto;

alter table if exists public.notes
  add column if not exists pinned_at timestamptz null;

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  content text not null,
  pinned_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create table if not exists public.note_attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  note_id uuid not null references public.notes(id) on delete cascade,
  name text not null,
  mime_type text not null,
  data_url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create table if not exists public.note_tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  note_id uuid not null references public.notes(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create index if not exists note_tags_user_id_idx on public.note_tags (user_id);
create index if not exists note_tags_note_id_idx on public.note_tags (note_id);
create index if not exists note_tags_name_idx on public.note_tags (name);

alter table public.groups enable row level security;
alter table public.notes enable row level security;
alter table public.note_attachments enable row level security;
alter table public.note_tags enable row level security;

drop policy if exists "groups_select_own" on public.groups;
create policy "groups_select_own"
on public.groups for select
using (auth.uid() = user_id);

drop policy if exists "groups_insert_own" on public.groups;
create policy "groups_insert_own"
on public.groups for insert
with check (auth.uid() = user_id);

drop policy if exists "groups_update_own" on public.groups;
create policy "groups_update_own"
on public.groups for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "groups_delete_own" on public.groups;
create policy "groups_delete_own"
on public.groups for delete
using (auth.uid() = user_id);

drop policy if exists "notes_select_own" on public.notes;
create policy "notes_select_own"
on public.notes for select
using (auth.uid() = user_id);

drop policy if exists "notes_insert_own" on public.notes;
create policy "notes_insert_own"
on public.notes for insert
with check (auth.uid() = user_id);

drop policy if exists "notes_update_own" on public.notes;
create policy "notes_update_own"
on public.notes for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "notes_delete_own" on public.notes;
create policy "notes_delete_own"
on public.notes for delete
using (auth.uid() = user_id);

drop policy if exists "note_tags_select_own" on public.note_tags;
create policy "note_tags_select_own"
on public.note_tags for select
using (auth.uid() = user_id);

drop policy if exists "note_tags_insert_own" on public.note_tags;
create policy "note_tags_insert_own"
on public.note_tags for insert
with check (auth.uid() = user_id);

drop policy if exists "note_tags_update_own" on public.note_tags;
create policy "note_tags_update_own"
on public.note_tags for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "note_tags_delete_own" on public.note_tags;
create policy "note_tags_delete_own"
on public.note_tags for delete
using (auth.uid() = user_id);

drop policy if exists "note_attachments_select_own" on public.note_attachments;
create policy "note_attachments_select_own"
on public.note_attachments for select
using (auth.uid() = user_id);

drop policy if exists "note_attachments_insert_own" on public.note_attachments;
create policy "note_attachments_insert_own"
on public.note_attachments for insert
with check (auth.uid() = user_id);

drop policy if exists "note_attachments_update_own" on public.note_attachments;
create policy "note_attachments_update_own"
on public.note_attachments for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "note_attachments_delete_own" on public.note_attachments;
create policy "note_attachments_delete_own"
on public.note_attachments for delete
using (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists groups_set_updated_at on public.groups;
create trigger groups_set_updated_at
before update on public.groups
for each row execute function public.set_updated_at();

drop trigger if exists notes_set_updated_at on public.notes;
create trigger notes_set_updated_at
before update on public.notes
for each row execute function public.set_updated_at();

drop trigger if exists note_attachments_set_updated_at on public.note_attachments;
create trigger note_attachments_set_updated_at
before update on public.note_attachments
for each row execute function public.set_updated_at();

drop trigger if exists note_tags_set_updated_at on public.note_tags;
create trigger note_tags_set_updated_at
before update on public.note_tags
for each row execute function public.set_updated_at();
```

## Notes

- Auth uses Supabase email/password.
- Notes and groups are offline-first: Dexie first, sync to Supabase when online.
- Tags are comma-separated in quick capture and edit flows.
- App supports PWA install and offline caching.
