# Storage Integration
The existing project UI uses the Supabase-compatible local-first adapter in `src/lib/localSupabase.ts`.
Metadata is stored per authenticated user in localStorage, and binary files are stored in IndexedDB in local mode.
The standalone `src/lib/localStorage.ts` helper remains available for future migration work but is not used by the current pages.
