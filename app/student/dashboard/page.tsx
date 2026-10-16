import { redirect } from 'next/navigation';

/**
 * The student's home is the Roadmap: it is built from the published curriculum
 * and the student's own results. The former overview here showed sample
 * figures (courses, attempts, accuracy) that were not the student's, so old
 * links and bookmarks open the Roadmap instead.
 */
export default function StudentDashboardPage() {
  redirect('/student/roadmap');
}
