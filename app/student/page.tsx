import { redirect } from 'next/navigation';

/** The Roadmap is the student's home. */
export default function StudentIndexPage() {
  redirect('/student/roadmap');
}
