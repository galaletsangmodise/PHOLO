import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const clientOptions = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be set in the root .env file.`);
  return value;
}

/** The three ways the API talks to Supabase (plan Section 4.1). Keys are read from the environment only. */
@Injectable()
export class SupabaseService {
  /** The public key, used for log-in and for checking a token. */
  anon(): SupabaseClient {
    return createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), clientOptions);
  }

  /** The user's own token: every read goes through Row-Level Security as that user. */
  forToken(token: string): SupabaseClient {
    return createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
      ...clientOptions,
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
  }

  /** The service role key: only for the Check-in and AuditLog database functions (never for a user's own reads). */
  admin(): SupabaseClient {
    return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), clientOptions);
  }
}
