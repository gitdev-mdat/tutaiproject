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
