import { redirect } from 'next/navigation';

/** The app opens on S1 Log in. Role-based redirects for logged-in users arrive in Phase 3. */
export default function HomePage() {
  redirect('/login');
}
