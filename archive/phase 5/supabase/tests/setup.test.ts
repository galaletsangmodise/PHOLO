import { createClient } from '@supabase/supabase-js';

describe('Database runner', () => {
  it('T-SETUP-3 runs a trivial query against the hosted development project', async () => {
    const url = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceRoleKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in the root .env file.');
    }

    // The service role key is allowed here because this is a test (Section 4.1).
    const client = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
    const { data, error } = await client.auth.admin.listUsers({ page: 1, perPage: 1 });

    expect(error).toBeNull();
    expect(data).not.toBeNull();
  });
});
