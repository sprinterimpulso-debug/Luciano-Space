import { createClient } from '@supabase/supabase-js';

// Prefer env vars for portability across environments.
// Fallbacks keep the current production project working until migration is complete.
const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'lvxbqwqpehpupsgfpcoe';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || `https://${PROJECT_ID}.supabase.co`;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_5RqhL_FqwAcahRs--YviiQ_I-IOrd3w';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
