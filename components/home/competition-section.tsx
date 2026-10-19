'use client';

import Link from 'next/link';
import Image from 'next/image';
import * as React from 'react';
import { ArrowRight, BarChart3, BookOpen, Clock3, FileText, Gift, Trophy } from 'lucide-react';

import { CompetitionCountdown } from '@/components/competitions/competition-countdown';
import { featuredCompetition } from '@/data/mock-competitions';

import styles from './competition-section.module.css';

const learningLoop = [
  { label: 'Luyện', detail: 'Ôn tập theo chủ đề', icon: BookOpen },
  { label: 'Thi', detail: 'Tham gia đấu trường', icon: FileText },
  { label: 'Lên hạng', detail: 'Xem thứ hạng của mình', icon: BarChart3 },
  { label: 'Nhận thưởng', detail: 'Ghi nhận thành tích', icon: Gift },
] as const;

const medalAssets = [
  { src: '/assets/gold_medal.png', alt: 'Huy chương vàng', className: styles.goldMedal },
  { src: '/assets/silver_medal.png', alt: 'Huy chương bạc', className: styles.silverMedal },
  { src: '/assets/bronze_medal.png', alt: 'Huy chương đồng', className: styles.bronzeMedal },
] as const;

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount);
}

function getPrizeCount(rankFrom: number, rankTo: number) {
  return rankTo - rankFrom + 1;
}

export function CompetitionSection() {
  const sectionRef = React.useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = React.useState(false);
  const competition = featuredCompetition;

  React.useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setIsVisible(true);
        observer.disconnect();
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={sectionRef} className={styles.section} data-visible={isVisible}>
      <div className={styles.arenaLines} aria-hidden="true" />
      <div className={styles.sparkleOne} aria-hidden="true" />
      <div className={styles.sparkleTwo} aria-hidden="true" />

      <div className={styles.container}>
        <div className={styles.showcase}>
          <div className={styles.story}>
            <div className={styles.eyebrow}>
              <Trophy size={17} aria-hidden="true" />
              ĐẤU TRƯỜNG TÚ TÀI
            </div>

            <h2 className={styles.headline}>
              <span className={styles.headlineLine}>Học chắc kiến thức.</span>
              <span className={`${styles.headlineLine} ${styles.headlineAccent}`}>
                Tranh tài thật.
              </span>
              <span className={styles.headlineLine}>Nhận thưởng xứng đáng.</span>
            </h2>

            <p className={styles.description}>
              Tham gia các cuộc thi học thuật định kỳ, tranh tài cùng những học sinh có chung mục
              tiêu, biết mình đang ở đâu và nhận phần thưởng xứng đáng với thành tích.
            </p>

            <div className={styles.loop} aria-label="Vòng học và thi đấu trên Tú Tài">
              {learningLoop.map((step, index) => {
                const Icon = step.icon;

                return (
                  <div className={styles.loopStep} key={step.label}>
                    <div className={styles.loopIcon}>
                      <Icon size={20} strokeWidth={2.1} aria-hidden="true" />
                    </div>
                    <span className={styles.loopNumber}>0{index + 1}</span>
                    <strong>{step.label}</strong>
                    <small>{step.detail}</small>
                    {index < learningLoop.length - 1 && (
                      <ArrowRight className={styles.loopArrow} size={18} aria-hidden="true" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className={styles.eventStage}>
            <div className={styles.stageGlow} aria-hidden="true" />
            <div className={styles.podium} aria-hidden="true" />

            <article className={styles.eventCard}>
              <div className={styles.cardAtmosphere} aria-hidden="true" />

              <div className={styles.eventHeader}>
                <span className={styles.status}>
                  <span aria-hidden="true" />
                  {competition.status === 'UPCOMING' ? 'SẮP DIỄN RA' : 'ĐANG MỞ'}
                </span>
                <span className={styles.subject}>{competition.subject}</span>
              </div>

              <h3 className={styles.eventTitle}>{competition.title}</h3>

              <div className={styles.eventMeta}>
                <span>
                  <Clock3 size={17} aria-hidden="true" />
                  {competition.durationMinutes} phút
                </span>
                <i aria-hidden="true" />
                <span>
                  <FileText size={16} aria-hidden="true" />
                  {competition.questionCount} câu
                </span>
              </div>

              <div className={styles.prizePanel}>
                <div className={styles.prizeHero}>
                  <div>
                    <span>TỔNG GIẢI THƯỞNG</span>
                    <strong className={styles.prizeAmount}>
                      {formatCurrency(competition.prizePool)}
                    </strong>
                    <small>Ghi nhận nỗ lực. Tôn vinh tri thức.</small>
                  </div>
                  <div className={styles.trophyVisual} aria-hidden="true">
                    <span className={styles.trophyGlow} />
                    <Image
                      src="/assets/trophy.png"
                      alt=""
                      width={2500}
                      height={2500}
                      sizes="(max-width: 767px) 76px, 112px"
                      className={styles.trophyImage}
                    />
                  </div>
                </div>

                <div className={styles.prizeGrid}>
                  {competition.prizes.slice(0, 3).map((prize, index) => {
                    const count = getPrizeCount(prize.rankFrom, prize.rankTo);

                    return (
                      <div className={styles.prizeTier} key={`${prize.rankFrom}-${prize.rankTo}`}>
                        <span className={`${styles.medalFrame} ${medalAssets[index].className}`}>
                          <Image
                            src={medalAssets[index].src}
                            alt={medalAssets[index].alt}
                            width={1250}
                            height={1250}
                            sizes="48px"
                            className={styles.medalImage}
                          />
                        </span>
                        <div>
                          <span>Hạng {index + 1}</span>
                          <strong>{formatCurrency(prize.amount)}</strong>
                          {count > 1 && <small>× {count} giải</small>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className={styles.eventSignals}>
                <div className={styles.countdown}>
                  <Clock3 size={22} aria-hidden="true" />
                  <div>
                    <span>THỜI GIAN CÒN LẠI</span>
                    <strong>
                      <CompetitionCountdown startAt={competition.startAt} />
                    </strong>
                    <small>trước giờ thi</small>
                  </div>
                </div>
              </div>

              <Link href={competition.cta?.href ?? '/competitions'} className={styles.cta}>
                {competition.cta?.label ?? 'Xem chi tiết'}
                <ArrowRight size={20} aria-hidden="true" />
              </Link>

              <div className={styles.rankingNote}>
                <BarChart3 size={16} aria-hidden="true" />
                Bảng xếp hạng được công bố sau mỗi cuộc thi.
              </div>
            </article>
          </div>
        </div>
      </div>
    </div>
  );
}
