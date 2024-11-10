// Supabase has been removed — auth is now handled locally in auth-context.tsx.
// This stub exists so any stale imports don't break the build during migration.

export type User = import('./auth-context').User;
export type Session = import('./auth-context').Session;
