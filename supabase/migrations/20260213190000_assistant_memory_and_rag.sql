create extension if not exists vector;
create extension if not exists pgcrypto;

create table if not exists public.assistant_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  farm_id bigint null,
  locale text not null default 'en',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assistant_turns (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.assistant_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  farm_id bigint null,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  input_mode text null check (input_mode in ('text', 'audio')),
  trace_id text null,
  latency_ms integer null,
  provider text null,
  model text null,
  citations jsonb null,
  tool_calls jsonb null,
  safety_flags jsonb null,
  created_at timestamptz not null default now()
);

create table if not exists public.assistant_memories (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid null references public.assistant_conversations(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  farm_id bigint null,
  memory_type text not null check (memory_type in ('preference', 'farm_fact', 'task_pattern', 'summary')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  importance numeric(3,2) not null default 0.5,
  expires_at timestamptz null,
  created_at timestamptz not null default now()
);

create table if not exists public.assistant_memory_embeddings (
  memory_id uuid primary key references public.assistant_memories(id) on delete cascade,
  embedding vector(1536) not null,
  created_at timestamptz not null default now()
);

create table if not exists public.agronomy_docs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  source_url text null,
  locale text not null default 'en',
  crop text null,
  is_public boolean not null default true,
  created_by uuid null references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agronomy_doc_chunks (
  id uuid primary key default gen_random_uuid(),
  doc_id uuid not null references public.agronomy_docs(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  token_count integer not null default 0,
  locale text not null default 'en',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (doc_id, chunk_index)
);

create table if not exists public.agronomy_chunk_embeddings (
  chunk_id uuid primary key references public.agronomy_doc_chunks(id) on delete cascade,
  embedding vector(1536) not null,
  created_at timestamptz not null default now()
);

create index if not exists assistant_conversations_user_idx on public.assistant_conversations (user_id, created_at desc);
create index if not exists assistant_turns_conversation_idx on public.assistant_turns (conversation_id, created_at desc);
create index if not exists assistant_turns_user_idx on public.assistant_turns (user_id, created_at desc);
create index if not exists assistant_memories_user_idx on public.assistant_memories (user_id, created_at desc);
create index if not exists assistant_memories_expires_idx on public.assistant_memories (expires_at);
create index if not exists agronomy_doc_chunks_doc_idx on public.agronomy_doc_chunks (doc_id, chunk_index);
create index if not exists agronomy_docs_locale_idx on public.agronomy_docs (locale, is_public);

alter table public.assistant_conversations enable row level security;
alter table public.assistant_turns enable row level security;
alter table public.assistant_memories enable row level security;
alter table public.assistant_memory_embeddings enable row level security;
alter table public.agronomy_docs enable row level security;
alter table public.agronomy_doc_chunks enable row level security;
alter table public.agronomy_chunk_embeddings enable row level security;

drop policy if exists assistant_conversations_owner_all on public.assistant_conversations;
create policy assistant_conversations_owner_all
on public.assistant_conversations
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists assistant_turns_owner_all on public.assistant_turns;
create policy assistant_turns_owner_all
on public.assistant_turns
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists assistant_memories_owner_all on public.assistant_memories;
create policy assistant_memories_owner_all
on public.assistant_memories
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists assistant_memory_embeddings_owner_select on public.assistant_memory_embeddings;
create policy assistant_memory_embeddings_owner_select
on public.assistant_memory_embeddings
for select
using (
  exists (
    select 1
    from public.assistant_memories m
    where m.id = memory_id and m.user_id = auth.uid()
  )
);

drop policy if exists assistant_memory_embeddings_owner_insert on public.assistant_memory_embeddings;
create policy assistant_memory_embeddings_owner_insert
on public.assistant_memory_embeddings
for insert
with check (
  exists (
    select 1
    from public.assistant_memories m
    where m.id = memory_id and m.user_id = auth.uid()
  )
);

drop policy if exists assistant_memory_embeddings_owner_delete on public.assistant_memory_embeddings;
create policy assistant_memory_embeddings_owner_delete
on public.assistant_memory_embeddings
for delete
using (
  exists (
    select 1
    from public.assistant_memories m
    where m.id = memory_id and m.user_id = auth.uid()
  )
);

drop policy if exists agronomy_docs_read_public on public.agronomy_docs;
create policy agronomy_docs_read_public
on public.agronomy_docs
for select
using (is_public or created_by = auth.uid());

drop policy if exists agronomy_docs_owner_write on public.agronomy_docs;
create policy agronomy_docs_owner_write
on public.agronomy_docs
for all
using (created_by = auth.uid())
with check (created_by = auth.uid());

drop policy if exists agronomy_doc_chunks_read_public on public.agronomy_doc_chunks;
create policy agronomy_doc_chunks_read_public
on public.agronomy_doc_chunks
for select
using (
  exists (
    select 1
    from public.agronomy_docs d
    where d.id = doc_id
      and (d.is_public or d.created_by = auth.uid())
  )
);

drop policy if exists agronomy_doc_chunks_owner_write on public.agronomy_doc_chunks;
create policy agronomy_doc_chunks_owner_write
on public.agronomy_doc_chunks
for all
using (
  exists (
    select 1
    from public.agronomy_docs d
    where d.id = doc_id and d.created_by = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.agronomy_docs d
    where d.id = doc_id and d.created_by = auth.uid()
  )
);

drop policy if exists agronomy_chunk_embeddings_read_public on public.agronomy_chunk_embeddings;
create policy agronomy_chunk_embeddings_read_public
on public.agronomy_chunk_embeddings
for select
using (
  exists (
    select 1
    from public.agronomy_doc_chunks c
    join public.agronomy_docs d on d.id = c.doc_id
    where c.id = chunk_id and (d.is_public or d.created_by = auth.uid())
  )
);

drop policy if exists agronomy_chunk_embeddings_owner_write on public.agronomy_chunk_embeddings;
create policy agronomy_chunk_embeddings_owner_write
on public.agronomy_chunk_embeddings
for all
using (
  exists (
    select 1
    from public.agronomy_doc_chunks c
    join public.agronomy_docs d on d.id = c.doc_id
    where c.id = chunk_id and d.created_by = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.agronomy_doc_chunks c
    join public.agronomy_docs d on d.id = c.doc_id
    where c.id = chunk_id and d.created_by = auth.uid()
  )
);

create or replace function public.match_assistant_memories(
  query_embedding vector(1536),
  match_count int,
  p_user_id uuid,
  p_farm_id bigint default null
)
returns table (
  memory_id uuid,
  content text,
  metadata jsonb,
  similarity float
)
language sql
stable
as $$
  select
    m.id as memory_id,
    m.content,
    m.metadata,
    1 - (e.embedding <=> query_embedding) as similarity
  from public.assistant_memories m
  join public.assistant_memory_embeddings e on e.memory_id = m.id
  where m.user_id = p_user_id
    and (p_farm_id is null or m.farm_id = p_farm_id)
    and (m.expires_at is null or m.expires_at > now())
  order by e.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;

create or replace function public.match_agronomy_chunks(
  query_embedding vector(1536),
  match_count int,
  p_locale text default null
)
returns table (
  chunk_id uuid,
  content text,
  locale text,
  doc_title text,
  doc_source_url text,
  similarity float
)
language sql
stable
as $$
  select
    c.id as chunk_id,
    c.content,
    c.locale,
    d.title as doc_title,
    d.source_url as doc_source_url,
    1 - (e.embedding <=> query_embedding) as similarity
  from public.agronomy_doc_chunks c
  join public.agronomy_chunk_embeddings e on e.chunk_id = c.id
  join public.agronomy_docs d on d.id = c.doc_id
  where d.is_public = true
    and (p_locale is null or c.locale = p_locale)
  order by e.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;

create or replace function public.assistant_export_user_data(
  p_user_id uuid default auth.uid()
)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'conversations', (
      select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb)
      from public.assistant_conversations c
      where c.user_id = p_user_id
    ),
    'turns', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
      from public.assistant_turns t
      where t.user_id = p_user_id
    ),
    'memories', (
      select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb)
      from public.assistant_memories m
      where m.user_id = p_user_id
    )
  );
$$;

create or replace function public.assistant_delete_user_data(
  p_user_id uuid default auth.uid()
)
returns void
language plpgsql
security definer
as $$
begin
  delete from public.assistant_memories where user_id = p_user_id;
  delete from public.assistant_turns where user_id = p_user_id;
  delete from public.assistant_conversations where user_id = p_user_id;
end;
$$;

revoke all on function public.assistant_delete_user_data(uuid) from public;
grant execute on function public.assistant_delete_user_data(uuid) to authenticated;

create or replace function public.assistant_purge_expired_data()
returns void
language plpgsql
security definer
as $$
begin
  delete from public.assistant_memories where expires_at is not null and expires_at < now();

  delete from public.assistant_turns
  where created_at < now() - interval '180 days';

  delete from public.assistant_conversations c
  where not exists (
    select 1 from public.assistant_turns t where t.conversation_id = c.id
  )
  and c.created_at < now() - interval '180 days';
end;
$$;

revoke all on function public.assistant_purge_expired_data() from public;
grant execute on function public.assistant_purge_expired_data() to service_role;
