import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as
  | string
  | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const supabaseKey = supabasePublishableKey ?? supabaseAnonKey

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey)

export function createSupabaseClient() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Missing Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY).',
    )
  }

  return createClient(supabaseUrl, supabaseKey)
}

export const supabase = isSupabaseConfigured ? createSupabaseClient() : null
