import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export const createServiceClient = () => {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // Using service role key for admin privileges
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
};