-- Gamefolio initial Supabase schema
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  igdb_id bigint,
  name text not null,
  cover_url text,
  genres text[] not null default '{}',
  platforms text[] not null default '{}',
  developer text,
  is_manual boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, igdb_id)
);

create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('idea', 'review')),
  title text not null,
  body text not null default '',
  game_id uuid references public.games(id) on delete set null,
  design_theme text,
  status text not null default 'draft' check (status in ('draft', 'complete')),
  favorite boolean not null default false,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.entry_sections (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.entries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  content text not null default '',
  position integer not null default 0
);

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.entry_tags (
  entry_id uuid not null references public.entries(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (entry_id, tag_id)
);

create table if not exists public.entry_images (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.entries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  content_type text not null,
  size bigint not null check (size >= 0 and size <= 15728640),
  caption text not null default '',
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.share_links (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.entries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists entries_user_updated_idx on public.entries (user_id, updated_at desc);
create index if not exists entries_user_type_idx on public.entries (user_id, type);
create index if not exists entries_user_game_idx on public.entries (user_id, game_id);
create index if not exists entry_sections_entry_idx on public.entry_sections (entry_id, position);
create index if not exists entry_images_entry_idx on public.entry_images (entry_id, position);
create index if not exists share_links_entry_idx on public.share_links (entry_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

insert into public.profiles (id, email, display_name)
select id, email, coalesce(raw_user_meta_data ->> 'full_name', split_part(email, '@', 1))
from auth.users
on conflict (id) do nothing;

alter table public.profiles enable row level security;
alter table public.games enable row level security;
alter table public.entries enable row level security;
alter table public.entry_sections enable row level security;
alter table public.tags enable row level security;
alter table public.entry_tags enable row level security;
alter table public.entry_images enable row level security;
alter table public.share_links enable row level security;

revoke all on table public.profiles from anon;
revoke all on table public.games from anon;
revoke all on table public.entries from anon;
revoke all on table public.entry_sections from anon;
revoke all on table public.tags from anon;
revoke all on table public.entry_tags from anon;
revoke all on table public.entry_images from anon;
revoke all on table public.share_links from anon;

grant select, insert, update, delete on table public.profiles to authenticated;
grant select, insert, update, delete on table public.games to authenticated;
grant select, insert, update, delete on table public.entries to authenticated;
grant select, insert, update, delete on table public.entry_sections to authenticated;
grant select, insert, update, delete on table public.tags to authenticated;
grant select, insert, update, delete on table public.entry_tags to authenticated;
grant select, insert, update, delete on table public.entry_images to authenticated;
grant select, insert, update, delete on table public.share_links to authenticated;

drop policy if exists "profiles_owner_all" on public.profiles;
create policy "profiles_owner_all" on public.profiles
  for all to authenticated using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
drop policy if exists "games_owner_all" on public.games;
create policy "games_owner_all" on public.games
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists "entries_owner_all" on public.entries;
create policy "entries_owner_all" on public.entries
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists "entry_sections_owner_all" on public.entry_sections;
create policy "entry_sections_owner_all" on public.entry_sections
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists "tags_owner_all" on public.tags;
create policy "tags_owner_all" on public.tags
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists "entry_tags_owner_all" on public.entry_tags;
create policy "entry_tags_owner_all" on public.entry_tags
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists "entry_images_owner_all" on public.entry_images;
create policy "entry_images_owner_all" on public.entry_images
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists "share_links_owner_all" on public.share_links;
create policy "share_links_owner_all" on public.share_links
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'entry-images',
  'entry-images',
  false,
  15728640,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "entry_images_storage_select" on storage.objects;
create policy "entry_images_storage_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'entry-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
drop policy if exists "entry_images_storage_insert" on storage.objects;
create policy "entry_images_storage_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'entry-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
drop policy if exists "entry_images_storage_update" on storage.objects;
create policy "entry_images_storage_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'entry-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'entry-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
drop policy if exists "entry_images_storage_delete" on storage.objects;
create policy "entry_images_storage_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'entry-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

notify pgrst, 'reload schema';
