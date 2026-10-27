'use client';

import * as React from 'react';

interface CompetitionCountdownProps {
  startAt: string;
  status?: string;
}

export function CompetitionCountdown({ startAt, status }: CompetitionCountdownProps) {
  const [remaining, setRemaining] = React.useState<number | null>(null);

  React.useEffect(() => {
    const target = Date.parse(startAt);
    if (Number.isNaN(target)) return;

    const update = () => {
      setRemaining(Math.max(0, target - Date.now()));
    };

    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [startAt]);

  // One source of truth for the schedule: a contest marked upcoming whose
  // start time is missing or already past has no countdown to show. Render
  // the "date to be announced" state instead of contradicting the badge
  // with "already started" (or a NaN countdown for an invalid date).
  // When a real future date is set, the live countdown below takes over.
  const startMs = Date.parse(startAt);
  const schedulePending =
    Number.isNaN(startMs) || (status === 'UPCOMING' && startMs <= Date.now());
  if (schedulePending) {
    return <time dateTime={startAt}>Lịch thi sẽ được công bố</time>;
  }

  if (remaining === null) return <time aria-label="Đang tải thời gian còn lại">--:--:--</time>;

  if (remaining <= 0) {
    return <time dateTime={startAt}>Cuộc thi đã bắt đầu</time>;
  }

  const totalSeconds = Math.floor(remaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');

  if (days > 0) {
    return (
      <time dateTime={startAt} aria-label={`Còn ${days} ngày ${hours} giờ ${minutes} phút`}>
        Còn {pad(days)} ngày {pad(hours)}:{pad(minutes)}:{pad(seconds)}
      </time>
    );
  }

  if (hours > 0) {
    return (
      <time dateTime={startAt} aria-label={`Còn ${hours} giờ ${minutes} phút`}>
        Còn {pad(hours)}:{pad(minutes)}:{pad(seconds)}
      </time>
    );
  }

  return (
    <time dateTime={startAt} aria-label={`Còn ${minutes} phút ${seconds} giây`}>
      Còn {pad(minutes)}:{pad(seconds)}
    </time>
  );
}
