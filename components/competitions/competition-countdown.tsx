'use client';

import * as React from 'react';

interface CompetitionCountdownProps {
  startAt: string;
}

export function CompetitionCountdown({ startAt }: CompetitionCountdownProps) {
  const [remaining, setRemaining] = React.useState<number | null>(null);

  React.useEffect(() => {
    const target = new Date(startAt).getTime();

    const update = () => {
      setRemaining(Math.max(0, target - Date.now()));
    };

    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [startAt]);

  if (remaining === null) {
    return null;
  }

  if (remaining <= 0) {
    return <span>Cuộc thi đã bắt đầu</span>;
  }

  const totalSeconds = Math.floor(remaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');

  if (days > 0) {
    return (
      <span>
        Còn {pad(days)} ngày {pad(hours)}:{pad(minutes)}:{pad(seconds)}
      </span>
    );
  }

  if (hours > 0) {
    return (
      <span>
        Còn {pad(hours)}:{pad(minutes)}:{pad(seconds)}
      </span>
    );
  }

  return (
    <span>
      Còn {pad(minutes)}:{pad(seconds)}
    </span>
  );
}
