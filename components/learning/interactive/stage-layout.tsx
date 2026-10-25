'use client';

import * as React from 'react';
import { BeatFocusProvider } from './beats';

/**
 * A part of the interactive lesson: the activity on the left, the graph on
 * the right as the stage that stays in view (sticky). On phones the graph
 * sits at the top and stays pinned while the activity scrolls under it, so
 * the instruction and the picture are on screen together.
 */
export function StageLayout({
  graph,
  children,
  graphBelowOnPhones = false,
}: {
  graph: React.ReactNode | null;
  children: React.ReactNode;
  /** A graph with nothing to look at yet (the hidden challenge) goes after the activity on phones. */
  graphBelowOnPhones?: boolean;
}) {
  if (!graph)
    return (
      <BeatFocusProvider>
        <div className="mx-auto max-w-[720px] space-y-3">{children}</div>
      </BeatFocusProvider>
    );
  return (
    <div className="flex flex-col md:grid md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] md:items-start md:gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)] xl:gap-8">
      <div
        className={
          graphBelowOnPhones
            ? 'order-2 mt-3 md:sticky md:top-6 md:mt-0'
            : 'sticky top-0 z-20 -mx-4 bg-[#F8FAFD]/95 px-2 pb-2 pt-2 backdrop-blur md:order-2 md:top-6 md:mx-0 md:bg-transparent md:p-0 md:backdrop-blur-none'
        }
      >
        {graph}
      </div>
      <div className={`space-y-3 md:order-1 md:mt-0 ${graphBelowOnPhones ? 'order-1' : 'mt-3'}`}>
        <BeatFocusProvider>{children}</BeatFocusProvider>
      </div>
    </div>
  );
}

/**
 * The graph's height for the screen: tall on desktop where it is the
 * centrepiece, about a third of the screen on phones so the activity below
 * stays visible.
 */
export function useGraphHeight() {
  const [height, setHeight] = React.useState(300);
  React.useEffect(() => {
    const update = () => {
      const wide = window.matchMedia('(min-width: 768px)').matches;
      const vh = window.innerHeight;
      setHeight(
        wide
          ? Math.round(Math.max(300, Math.min(460, vh - 330)))
          : Math.round(Math.max(180, Math.min(260, vh * 0.27)))
      );
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return height;
}
