import type { StudentLandingState } from '@/lib/navigation/landing-cta';

import styles from './hero-lifecycle-notice.module.css';

/**
 * Presentation-only view model for the hero continuation panel.
 *
 * It does NOT decide destinations — `resolveLandingCtas` owns paths and lifecycle
 * transitions. This module only decides how the single next step is *presented*
 * (voice, accent, supporting explanation) and which display label reads
 * correctly for a returning student instead of first-time guest copy.
 */
export interface HeroLifecyclePresentation {
  /** Accent colour for the rail, eyebrow and status dot. */
  accent: string;
  eyebrow: string;
  title: string;
  body: string;
  hint?: string;
  /** Presentation label override for the hero primary action (path unchanged). */
  ctaLabel?: string;
  tone?: 'blocked' | 'ready';
}

export function resolveHeroLifecyclePresentation(
  state: StudentLandingState,
  displayName?: string
): HeroLifecyclePresentation | null {
  const name = displayName?.trim().split(/\s+/).slice(-1)[0];
  const greeting = name ? `${name}, ` : '';

  switch (state) {
    case 'GUEST':
      return null;

    case 'AUTHENTICATED_ONBOARDING_INCOMPLETE':
      return {
        accent: '#3d8cff',
        eyebrow: 'Còn một bước nữa',
        title: `${greeting}hồ sơ học tập chưa hoàn tất`,
        body: 'Tú Tài cần mục tiêu và năng lực hiện tại của em để xếp đúng lộ trình. Em tiếp tục đúng chỗ đã dừng, không phải làm lại từ đầu.',
        ctaLabel: 'Tiếp tục thiết lập',
      };

    case 'AUTHENTICATED_READY_FOR_ASSIGNMENT':
      return {
        accent: '#00c896',
        tone: 'ready',
        eyebrow: 'Hồ sơ đã hoàn tất',
        title: `${greeting}em đã sẵn sàng nhận lộ trình`,
        body: 'Tú Tài sẽ xếp em vào chương trình học phù hợp với mục tiêu đã khai báo và khởi tạo lộ trình cá nhân.',
        hint: 'Bấm nhiều lần cũng chỉ tạo một lộ trình duy nhất.',
        ctaLabel: 'Nhận lộ trình của em',
      };

    case 'AUTHENTICATED_PROGRAM_ASSIGNED':
      return {
        accent: '#00c896',
        tone: 'ready',
        eyebrow: 'Chương trình đã được xếp',
        title: `${greeting}lộ trình của em đã sẵn sàng`,
        body: 'Chương trình học đã được gán cho em. Vào lộ trình để bắt đầu chương đầu tiên.',
        ctaLabel: 'Vào lộ trình của em',
      };

    case 'AUTHENTICATED_ACTIVE_STUDENT':
      return {
        accent: '#3d8cff',
        eyebrow: 'Đang học',
        title: `${greeting}tiếp tục lộ trình đang học`,
        body: 'Tú Tài giữ nguyên tiến độ của em. Quay lại đúng chương em đang học, không bắt đầu lại.',
        ctaLabel: 'Tiếp tục học',
      };

    case 'ASSIGNMENT_BLOCKED':
      return {
        accent: '#ffb05a',
        tone: 'blocked',
        eyebrow: 'Cần kiểm tra lại',
        title: `${greeting}chưa xếp được chương trình phù hợp`,
        body: 'Hiện chưa có chương trình nào khớp với hồ sơ của em. Tú Tài không gán tạm một lộ trình sai — em kiểm tra lại mục tiêu trong hồ sơ.',
        hint: 'Nếu vẫn chưa được xếp, đội ngũ Tú Tài sẽ xử lý theo mã hồ sơ của em.',
        ctaLabel: 'Kiểm tra hồ sơ',
      };

    default:
      return null;
  }
}

export function HeroLifecycleNotice({ notice }: { notice: HeroLifecyclePresentation }) {
  const toneClass =
    notice.tone === 'blocked' ? styles.blocked : notice.tone === 'ready' ? styles.ready : '';

  return (
    <div
      className={`${styles.panel} ${toneClass}`}
      style={{ ['--notice-accent' as string]: notice.accent }}
      role="status"
      aria-live="polite"
    >
      <span className={styles.eyebrow}>
        <span className={styles.dot} aria-hidden="true" />
        {notice.eyebrow}
      </span>
      <p className={styles.title}>{notice.title}</p>
      <p className={styles.body}>{notice.body}</p>
      {notice.hint ? <p className={styles.hint}>{notice.hint}</p> : null}
    </div>
  );
}
