
import { redirect } from 'next/navigation';

// This is the new root page.
// It immediately redirects to the login page,
// providing a stable and robust entry point for the application.
export default function RootPage() {
  redirect('/login');
}
