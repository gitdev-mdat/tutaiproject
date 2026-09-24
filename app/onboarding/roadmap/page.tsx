import { isDemoStudentAuthenticated } from '@/lib/auth/demo-session';
import { RoadmapResultClient } from './roadmap-result-client';

export default async function GeneratedRoadmapPage() {
  const isAuthenticated = await isDemoStudentAuthenticated();

  return <RoadmapResultClient isAuthenticated={isAuthenticated} />;
}
