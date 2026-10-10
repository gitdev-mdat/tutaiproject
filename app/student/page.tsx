import { redirect } from 'next/navigation';

/** `/student/dashboard` is the canonical student home surface. */
export default function StudentIndexPage() {
  redirect('/student/dashboard');
}
