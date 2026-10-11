# AcademicVault Local-First Storage
Metadata is persisted in localStorage and document files in IndexedDB. Academic data remains on the device in local mode, but Supabase Auth is still required for account creation, login, session, and password reset.
The active UI uses the Supabase-compatible local adapter in `src/lib/localSupabase.ts`; `src/lib/localStorage.ts` is a standalone legacy helper and is not wired into the current pages.
The `supabase/schema.sql` file provides the starter PostgreSQL + RLS schema for optional cloud backup.
