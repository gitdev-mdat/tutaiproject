'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, Check } from 'lucide-react';

import styles from './pricing-preview.module.css';

const FREE_BENEFITS = [
  {
    title: 'Đánh giá năng lực',
    description: 'Biết mình đang ở đâu.',
  },
  {
    title: 'Lộ trình cá nhân hóa',
    description: 'Học theo mục tiêu và năng lực riêng.',
  },
  {
    title: 'Bài học hôm nay',
    description: 'Biết chính xác bước cần làm tiếp theo.',
  },
  {
    title: 'Kho đề mở miễn phí',
    description: 'Luyện thoải mái với các bộ đề mở.',
  },
] as const;

const PLUS_BENEFITS = [
  {
    title: 'Biết mình đang mất điểm ở đâu',
    description: 'Phân tích nguyên nhân phía sau lỗi sai.',
  },
  {
    title: 'Luyện đúng dạng tạo khoảng cách điểm',
    description: 'Ưu tiên nội dung phù hợp mục tiêu của em.',
  },
  {
    title: 'Lộ trình tự điều chỉnh',
    description: 'Kết quả mới thay đổi bài học tiếp theo.',
  },
  {
    title: 'Đấu trường Tú Tài',
    description: 'Thi đấu, xếp hạng và tham gia cuộc thi Plus.',
  },
  {
    title: 'Toàn bộ quyền lợi Free + nội dung chuyên sâu',
    description: '',
  },
] as const;

interface PricingPreviewProps {
  variant?: 'home' | 'page';
}

export function PricingPreview({ variant = 'home' }: PricingPreviewProps) {
  const isStandalonePage = variant === 'page';
  const Heading = isStandalonePage ? 'h1' : 'h2';

  const searchParams = useSearchParams();
  const returnUrl = searchParams?.get('returnUrl');

  const [plusDuration, setPlusDuration] = useState<6 | 12>(6);

  const plusCheckoutHref = returnUrl
    ? `/checkout/plus?plan=PLUS_${plusDuration}M&returnUrl=${encodeURIComponent(returnUrl)}`
    : `/checkout/plus?plan=PLUS_${plusDuration}M`;

  return (
    <section
      id="pricing"
      className={`${styles.section} ${isStandalonePage ? styles.standalone : styles.home}`}
      aria-labelledby="pricing-title"
    >
      {!isStandalonePage ? (
        <div className={styles.transition} aria-hidden="true">
          <svg viewBox="0 0 1440 112" preserveAspectRatio="none">
            <path className={styles.transitionSurface} d="M0 91C338 25 1095 13 1440 88V112H0Z" />
            <path className={styles.transitionEdge} d="M0 91C338 25 1095 13 1440 88" />
          </svg>
        </div>
      ) : null}

      <div className={styles.atmosphere} aria-hidden="true">
        <svg viewBox="0 0 1440 980" preserveAspectRatio="none">
          <path d="M-120 626C218 342 520 289 896 378C1171 443 1378 348 1536 173" />
          <path d="M88 978C239 688 527 567 866 624C1127 668 1365 579 1514 410" />
        </svg>
        <i className={styles.nodeOne} />
        <i className={styles.nodeTwo} />
        <i className={styles.nodeThree} />
      </div>

      <div className={styles.container}>
        <header className={styles.intro}>
          <p className={styles.sectionEyebrow}>CHỌN CÁCH EM MUỐN TIẾN XA</p>
          <Heading id="pricing-title" className={styles.sectionHeading}>
            <span>Bắt đầu miễn phí.</span>
            <span>Nâng cấp khi em cần đi xa hơn.</span>
          </Heading>
          <p className={styles.sectionDescription}>
            Hệ thống cốt lõi luôn sẵn sàng với Tú Tài Free. Khi cần luyện sâu hơn, Tú Tài Plus mở
            khóa đề tuyển chọn, phân tích lỗi sai và lộ trình tối ưu theo mục tiêu của em.
          </p>
        </header>

        <div className={styles.plans}>
          {/* FREE PLAN */}
          <article className={`${styles.planCard} ${styles.freeCard}`}>
            <header className={styles.planHeader}>
              <span className={`${styles.planBadge} ${styles.freeBadge}`}>Bắt đầu đúng hướng</span>
              <h3>Tú Tài Free</h3>
              <div className={styles.priceArea}>
                <span className={styles.priceValue}>Miễn phí</span>
              </div>
              <p className={styles.planDescription}>Đủ để em bắt đầu học nghiêm túc mỗi ngày.</p>
            </header>

            <div className={styles.cardDivider} aria-hidden="true" />

            <ul className={styles.benefitList} aria-label="Quyền lợi Tú Tài Free">
              {FREE_BENEFITS.map((benefit) => (
                <li key={benefit.title}>
                  <span className={styles.checkIcon}>
                    <Check size={16} strokeWidth={3} aria-hidden="true" />
                  </span>
                  <div>
                    <strong>{benefit.title}</strong>
                    {benefit.description && <p>{benefit.description}</p>}
                  </div>
                </li>
              ))}
            </ul>

            <footer className={styles.cardFooter}>
              <Link href="/auth/register" className={styles.freeCta}>
                Bắt đầu miễn phí
              </Link>
            </footer>
          </article>

          {/* PLUS PLAN */}
          <article className={`${styles.planCard} ${styles.plusCard}`}>
            <header className={styles.planHeader}>
              <div className={styles.plusBadgeRow}>
                <span className={styles.recommendedBadge}>ĐỀ XUẤT CHO MỤC TIÊU 8+</span>
                <span className={`${styles.planBadge} ${styles.plusSubBadge}`}>
                  Đi sâu để kéo điểm
                </span>
              </div>

              <h3>Tú Tài Plus</h3>

              <div className={styles.priceArea}>
                <span className={styles.priceValue}>
                  {plusDuration === 6 ? '349.000đ' : '599.000đ'}
                </span>
                <div className={styles.priceDetails}>
                  <span className={styles.priceDuration}>
                    {plusDuration === 6 ? '6 tháng truy cập' : '12 tháng truy cập'}
                  </span>
                  <span className={styles.priceMonthly}>
                    {plusDuration === 6 ? '≈ 58.000đ / tháng' : '≈ 50.000đ / tháng'}
                  </span>
                </div>
              </div>

              <div className={styles.durationSelector}>
                <button
                  type="button"
                  className={`${styles.durationTab} ${plusDuration === 6 ? styles.durationTabActive : ''}`}
                  onClick={() => setPlusDuration(6)}
                >
                  6 tháng
                </button>
                <button
                  type="button"
                  className={`${styles.durationTab} ${plusDuration === 12 ? styles.durationTabActive : ''}`}
                  onClick={() => setPlusDuration(12)}
                >
                  12 tháng <span className={styles.saveTag}>Tiết kiệm 99k</span>
                </button>
              </div>

              <p className={styles.planDescription}>
                Học có chiến lược hơn để tiến gần mục tiêu điểm số.
              </p>
            </header>

            <div className={styles.cardDivider} aria-hidden="true" />

            <ul className={styles.benefitList} aria-label="Quyền lợi Tú Tài Plus">
              {PLUS_BENEFITS.map((benefit) => (
                <li key={benefit.title}>
                  <span className={`${styles.checkIcon} ${styles.plusCheckIcon}`}>
                    <Check size={16} strokeWidth={3} aria-hidden="true" />
                  </span>
                  <div>
                    <strong>{benefit.title}</strong>
                    {benefit.description && <p>{benefit.description}</p>}
                  </div>
                </li>
              ))}
            </ul>

            <footer className={styles.cardFooter}>
              <Link href={plusCheckoutHref} className={styles.plusCta}>
                Nâng cấp Plus · {plusDuration === 6 ? '349.000đ' : '599.000đ'}
                <ArrowRight size={18} strokeWidth={2.2} aria-hidden="true" />
              </Link>
            </footer>
          </article>
        </div>
      </div>
    </section>
  );
}
