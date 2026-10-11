-- AcademicVault Phase 2: student profile + private profile photo storage
-- Safe to run after Phase 1. It does not replace existing profile data.

alter table public.student_profiles enable row level security;

-- Keep the user's email synchronized from Auth when a profile is created/updated by the app.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  insert into public.student_profiles(id, full_name, email)
  values(new.id, coalesce(new.raw_user_meta_data->>'full_name',''), new.email)
  on conflict(id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Private profile-photo bucket. Files are stored under <auth-user-id>/...
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-photos', 'profile-photos', false, 3145728, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false, file_size_limit=3145728, allowed_mime_types=array['image/jpeg','image/png','image/webp'];

drop policy if exists "profile_photos_select_own" on storage.objects;
drop policy if exists "profile_photos_insert_own" on storage.objects;
drop policy if exists "profile_photos_update_own" on storage.objects;
drop policy if exists "profile_photos_delete_own" on storage.objects;

create policy "profile_photos_select_own" on storage.objects
for select to authenticated
using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy "profile_photos_insert_own" on storage.objects
for insert to authenticated
with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy "profile_photos_update_own" on storage.objects
for update to authenticated
using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid()::text))
with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy "profile_photos_delete_own" on storage.objects
for delete to authenticated
using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid()::text));
