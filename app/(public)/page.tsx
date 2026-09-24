import type { Metadata } from 'next';

import { msg } from '@/messages/vi';
import { HomeSections } from '@/components/home/home-sections';

export const metadata: Metadata = {
  title: msg('home.meta.title'),
  description: msg('home.meta.description'),
};

/**
 * Homepage — student emotional journey:
 *   Confusion → Transformation → How It Works → Proof → Personalization → Trust → Action
 *
 * Header: rendered inside HomeSections → inside Hero section.
 * Controlled section navigation: useSectionScrollController (desktop only).
 */
export default function HomePage() {
  return <HomeSections />;
}
