-- AcademicVault Phase 8: selective share profiles
create extension if not exists pgcrypto;

create table if not exists public.share_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  snapshot jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null,
  allow_download boolean not null default false,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists share_links_user_idx on public.share_links(user_id, created_at desc);
create index if not exists share_links_token_idx on public.share_links(token);

alter table public.share_links enable row level security;
drop policy if exists share_links_select_own on public.share_links;
drop policy if exists share_links_insert_own on public.share_links;
drop policy if exists share_links_update_own on public.share_links;
drop policy if exists share_links_delete_own on public.share_links;
create policy share_links_select_own on public.share_links for select using (auth.uid() = user_id);
create policy share_links_insert_own on public.share_links for insert with check (auth.uid() = user_id);
create policy share_links_update_own on public.share_links for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy share_links_delete_own on public.share_links for delete using (auth.uid() = user_id);

-- Public readers never receive direct SELECT access to share_links.
-- This SECURITY DEFINER function exposes only the saved snapshot for an active link.
create or replace function public.get_public_share(share_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare result jsonb;
begin
  select jsonb_build_object(
    'profile', coalesce(snapshot->'profile','{}'::jsonb),
    'items', coalesce(snapshot->'items','[]'::jsonb),
    'settings', coalesce(snapshot->'settings','{}'::jsonb),
    'expires_at', expires_at
  ) into result
  from public.share_links
  where token = share_token
    and revoked_at is null
    and expires_at > now();
  return result;
end;
$$;
revoke all on function public.get_public_share(text) from public;
grant execute on function public.get_public_share(text) to anon, authenticated;
