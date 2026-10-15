import { redirect } from 'next/navigation';

/**
 * The old demo learning sessions (fixed questions kept in the browser) are
 * retired: lessons and practice live under /student/lessons, and the Roadmap
 * says which one comes next. Old links land on the Roadmap.
 */
export default function RetiredLearningSessionPage() {
  redirect('/student/roadmap');
}
