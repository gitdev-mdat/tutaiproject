'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  BookOpen,
  Check,
  Crown,
  GraduationCap,
  LockKeyhole,
  Pencil,
  Target,
  User,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { loadStudentState, updateStudentProfile } from '@/lib/student/student-service';
import { PRIMARY_SUBJECTS } from '@/lib/onboarding/onboarding-model';
import type { StudentProfile, StudentState } from '@/lib/student/types';
import styles from './profile.module.css';

/** The learning goals from onboarding, as stored; the Roadmap is chosen from these. */
export interface LearningGoals {
  grade: string;
  primarySubject: string | null;
  currentScore: number | null;
  targetScore: number | null;
}

const subjectName = (code: string | null) =>
  PRIMARY_SUBJECTS.find((subject) => subject.code === code)?.label ?? '—';
const gradeName = (grade: string) => (/^\d+$/.test(grade) ? `Lớp ${grade}` : grade || '—');
const score = (value: number | null) => (value === null ? '—' : String(value));

const PROFILE_PRESENTATION = {
  birthDate: '—',
  school: '—',
  planName: 'Tú Tài Free',
  planDescription: 'Quyền truy cập cơ bản',
} as const;

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] ?? 'H'}${parts.at(-1)?.[0] ?? 'S'}`.toUpperCase();
}

function HeaderArtwork() {
  return (
    <div className={styles.headerArtwork} aria-hidden="true">
      <svg viewBox="0 0 500 150">
        <g fill="none" stroke="#6FA5F2" strokeWidth="2" opacity=".34">
          <path d="M72 105h132M84 92h108M92 77h92M100 62h76" />
          <rect x="238" y="26" width="91" height="104" rx="9" fill="#E4EFFF" fillOpacity=".25" />
          <circle cx="284" cy="62" r="16" />
          <path d="M258 106c3-20 15-29 26-29s23 9 26 29M254 118h60" />
          <path d="m102 33 58-23 58 23-58 23Z" fill="#B5D2FA" fillOpacity=".45" />
          <path d="M202 34v26M160 56v17" />
        </g>
        <g fill="#7AABF1" opacity=".38">
          <path d="m43 42 3 9 9 3-9 3-3 9-3-9-9-3 9-3Z" />
          <path d="m365 21 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z" />
          <path d="m384 98 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z" />
        </g>
      </svg>
    </div>
  );
}

function OutlineAction({ children }: { children: React.ReactNode }) {
  return <span className={styles.outlineAction}>{children}</span>;
}

function ProfileEditDialog({
  state,
  onChange,
  compact = false,
}: {
  state: StudentState;
  onChange: (next: StudentState) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState('');
  const [form, setForm] = React.useState({
    name: state.profile.name,
    email: state.profile.email,
  });
  const changeOpen = (nextOpen: boolean) => {
    if (nextOpen) {
      setForm({
        name: state.profile.name,
        email: state.profile.email,
      });
    }
    setOpen(nextOpen);
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    try {
      onChange(
        updateStudentProfile(state, {
          name: form.name,
          email: form.email,
        })
      );
      setError('');
      setOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể cập nhật hồ sơ');
    }
  };
  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger>
        {compact ? (
          <OutlineAction>
            <Pencil size={15} /> Chỉnh sửa
          </OutlineAction>
        ) : (
          <OutlineAction>
            <Pencil size={16} /> Chỉnh sửa hồ sơ
          </OutlineAction>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Chỉnh sửa hồ sơ</DialogTitle>
          <DialogDescription>Cập nhật thông tin cá nhân cơ bản của em.</DialogDescription>
        </DialogHeader>
        <form className={styles.editForm} onSubmit={submit}>
          <label>
            Họ và tên
            <input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              required
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              required
            />
          </label>
          {error && <p className={styles.formError}>{error}</p>}
          <button type="submit" className={styles.saveButton}>
            <Check size={16} /> Lưu thay đổi
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Edits the learning goals in the database (not this browser): grade, the
 * subject to improve and the two scores. The Roadmap is chosen from the grade
 * and subject, so it changes on the next visit.
 */
function LearningGoalsDialog({ goals }: { goals: LearningGoals }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState(() => toForm(goals));
  const [error, setError] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const changeOpen = (nextOpen: boolean) => {
    if (nextOpen) {
      setForm(toForm(goals));
      setError('');
    }
    setOpen(nextOpen);
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/student/learning-profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grade: form.grade,
          primarySubject: form.primarySubject,
          currentScore: form.currentScore.replace(',', '.'),
          targetScore: form.targetScore.replace(',', '.'),
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) throw new Error(data.message ?? 'Không thể lưu mục tiêu.');
      setOpen(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể lưu mục tiêu.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger data-testid="learning-goals-edit">
        <OutlineAction>
          <Pencil size={15} /> Cập nhật mục tiêu
        </OutlineAction>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Cập nhật mục tiêu học tập</DialogTitle>
          <DialogDescription>
            Lộ trình của em mở theo môn và lớp ở đây. Điểm em nhập chỉ là mục tiêu, không dùng để bỏ
            qua bài nào.
          </DialogDescription>
        </DialogHeader>
        <form className={styles.editForm} onSubmit={submit} data-testid="learning-goals-form">
          <label>
            Môn em muốn cải thiện nhất
            <select
              value={form.primarySubject}
              onChange={(event) => setForm({ ...form, primarySubject: event.target.value })}
              required
              name="primarySubject"
            >
              {PRIMARY_SUBJECTS.map((subject) => (
                <option key={subject.code} value={subject.code}>
                  {subject.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Lớp
            <select
              value={form.grade}
              onChange={(event) => setForm({ ...form, grade: event.target.value })}
              required
              name="grade"
            >
              {['10', '11', '12', 'Khác'].map((grade) => (
                <option key={grade} value={grade}>
                  {grade}
                </option>
              ))}
            </select>
          </label>
          <label>
            Điểm hiện tại
            <input
              type="number"
              min="0"
              max="10"
              step="0.01"
              inputMode="decimal"
              name="currentScore"
              value={form.currentScore}
              onChange={(event) => setForm({ ...form, currentScore: event.target.value })}
              required
            />
          </label>
          <label>
            Điểm em muốn đạt
            <input
              type="number"
              min="0"
              max="10"
              step="0.01"
              inputMode="decimal"
              name="targetScore"
              value={form.targetScore}
              onChange={(event) => setForm({ ...form, targetScore: event.target.value })}
              required
            />
          </label>
          {error && (
            <p className={styles.formError} role="alert">
              {error}
            </p>
          )}
          <button type="submit" className={styles.saveButton} disabled={saving}>
            <Check size={16} /> {saving ? 'Đang lưu…' : 'Lưu mục tiêu'}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function toForm(goals: LearningGoals) {
  return {
    grade: goals.grade || '12',
    primarySubject: goals.primarySubject ?? 'MATH',
    currentScore: goals.currentScore === null ? '' : String(goals.currentScore),
    targetScore: goals.targetScore === null ? '' : String(goals.targetScore),
  };
}

function PasswordDialog({ email }: { email: string }) {
  const [saved, setSaved] = React.useState(false);
  const [password, setPassword] = React.useState('');
  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) {
          setSaved(false);
          setPassword('');
        }
      }}
    >
      <DialogTrigger>
        <OutlineAction>
          <LockKeyhole size={15} /> Đổi mật khẩu
        </OutlineAction>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Đổi mật khẩu</DialogTitle>
          <DialogDescription>Cập nhật mật khẩu đăng nhập cho {email}.</DialogDescription>
        </DialogHeader>
        {saved ? (
          <div className={styles.successMessage}>
            <Check size={18} /> Mật khẩu đã được cập nhật cho phiên tài khoản này.
          </div>
        ) : (
          <form
            className={styles.editForm}
            onSubmit={(event) => {
              event.preventDefault();
              setSaved(true);
            }}
          >
            <label>
              Mật khẩu mới
              <input
                type="password"
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Tối thiểu 8 ký tự"
                required
              />
            </label>
            <button type="submit" className={styles.saveButton}>
              <LockKeyhole size={16} /> Cập nhật mật khẩu
            </button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CardHeader({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={styles.cardHeader}>
      <span className={styles.cardIcon}>{icon}</span>
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      {action && <div className={styles.cardAction}>{action}</div>}
    </div>
  );
}

function DetailRows({ rows }: { rows: Array<{ label: string; value: React.ReactNode }> }) {
  return (
    <dl className={styles.detailRows}>
      {rows.map((row) => (
        <div key={row.label}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export type GoogleLinkState = {
  linked: boolean;
  email: string | null;
  notice: string | null;
  error: string | null;
};

function GoogleLinkRow({ google }: { google: GoogleLinkState }) {
  if (google.linked) {
    return (
      <span className={styles.googleLinked}>
        <Check size={15} aria-hidden="true" /> Đã liên kết{google.email ? ` (${google.email})` : ''}
      </span>
    );
  }
  return (
    <a
      className={styles.googleLink}
      href={`/api/auth/google?intent=link&returnTo=${encodeURIComponent('/student/profile')}`}
    >
      Liên kết Google
    </a>
  );
}

export function ProfileClient({
  initialProfile,
  google,
  learning,
}: {
  initialProfile: StudentProfile;
  google: GoogleLinkState;
  learning: LearningGoals;
}) {
  const [state, setState] = React.useState(() => loadStudentState(initialProfile));
  React.useEffect(() => {
    const hydration = window.setTimeout(() => setState(loadStudentState(initialProfile)), 0);
    return () => window.clearTimeout(hydration);
  }, [initialProfile]);
  const profile = state.profile;
  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p>HỒ SƠ</p>
          <h1>Hồ sơ của em</h1>
          <span>Quản lý thông tin cá nhân và mục tiêu học tập.</span>
        </div>
        <HeaderArtwork />
      </header>
      <section className={styles.profileHero} aria-label="Thông tin nhận diện học sinh">
        <div className={styles.avatar}>{initials(profile.name)}</div>
        <div className={styles.heroIdentity}>
          <h2>{profile.name}</h2>
          <p>{profile.email}</p>
          <div>
            <span>
              <GraduationCap size={18} /> {gradeName(learning.grade)} · Mục tiêu{' '}
              {score(learning.targetScore)} điểm
            </span>
            <span>
              <BookOpen size={18} /> {subjectName(learning.primarySubject)}
            </span>
          </div>
        </div>
        <div className={styles.heroAction}>
          <ProfileEditDialog state={state} onChange={setState} />
        </div>
      </section>
      <div className={styles.cardGrid}>
        <section className={styles.infoCard}>
          <CardHeader
            icon={<User size={21} />}
            title="Thông tin cá nhân"
            subtitle="Thông tin cơ bản về bản thân của em."
            action={<ProfileEditDialog state={state} onChange={setState} compact />}
          />
          <DetailRows
            rows={[
              { label: 'Họ và tên', value: profile.name },
              { label: 'Email', value: profile.email },
              { label: 'Ngày sinh', value: PROFILE_PRESENTATION.birthDate },
              { label: 'Trường', value: PROFILE_PRESENTATION.school },
              { label: 'Lớp', value: gradeName(learning.grade) },
            ]}
          />
        </section>
        <section className={styles.infoCard} id="muc-tieu" data-testid="learning-goals">
          <CardHeader
            icon={<Target size={21} />}
            title="Mục tiêu học tập"
            subtitle="Lộ trình của em mở theo môn và lớp ở đây."
            action={<LearningGoalsDialog goals={learning} />}
          />
          <DetailRows
            rows={[
              { label: 'Môn ưu tiên', value: subjectName(learning.primarySubject) },
              { label: 'Lớp', value: gradeName(learning.grade) },
              { label: 'Điểm hiện tại', value: score(learning.currentScore) },
              { label: 'Điểm muốn đạt', value: score(learning.targetScore) },
            ]}
          />
        </section>
        <section className={styles.infoCard}>
          <CardHeader
            icon={<LockKeyhole size={21} />}
            title="Tài khoản"
            subtitle="Quản lý thông tin đăng nhập và bảo mật."
            action={<PasswordDialog email={profile.email} />}
          />
          <DetailRows
            rows={[
              { label: 'Email đăng nhập', value: profile.email },
              { label: 'Mật khẩu', value: '••••••••••' },
              { label: 'Google', value: <GoogleLinkRow google={google} /> },
            ]}
          />
          {(google.notice || google.error) && (
            <p role="status" className={google.error ? styles.googleError : styles.googleNotice}>
              {google.error ?? google.notice}
            </p>
          )}
        </section>
        <section className={styles.infoCard}>
          <CardHeader
            icon={<Crown size={21} />}
            title="Gói học"
            subtitle="Thông tin gói học hiện tại của em."
          />
          <div className={styles.planPanel}>
            <span className={styles.planIcon}>
              <GraduationCap size={27} />
            </span>
            <div>
              <strong>{PROFILE_PRESENTATION.planName}</strong>
              <p>{PROFILE_PRESENTATION.planDescription}</p>
            </div>
            <Link href="/pricing">
              Xem các gói <ArrowRight size={16} />
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
