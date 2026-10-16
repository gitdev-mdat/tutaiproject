import { redirect } from 'next/navigation';

/**
 * The former roadmap editor kept its programs in server memory, linked to
 * sample content and was never read by a student page. Students now receive
 * the published curriculum directly; old links open the page that shows it.
 */
export default function Page() {
  redirect('/admin/roadmaps');
}
