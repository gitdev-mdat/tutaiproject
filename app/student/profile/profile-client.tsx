'use client';

import * as React from 'react';
import Link from 'next/link';
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
import type { StudentProfile, StudentState } from '@/lib/student/types';
import styles from './profile.module.css';

const PROFILE_PRESENTATION = {
  examLabel: 'THPT Quốc Gia 2027',
  subjects: ['Toán', 'Vật lý', 'Hóa học'],
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
    grade: String(state.profile.grade),
  });
  const changeOpen = (nextOpen: boolean) => {
    if (nextOpen) {
      setForm({
        name: state.profile.name,
        email: state.profile.email,
        grade: String(state.profile.grade),
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
          grade: Number(form.grade),
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
          <label>
            Lớp
            <input
              type="number"
              min="1"
              max="12"
              value={form.grade}
              onChange={(event) => setForm({ ...form, grade: event.target.value })}
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

function GoalEditDialog({
  state,
  onChange,
}: {
  state: StudentState;
  onChange: (next: StudentState) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [targetScore, setTargetScore] = React.useState(String(state.profile.targetScore));
  const [examBlock, setExamBlock] = React.useState(state.profile.examBlock);
  const [error, setError] = React.useState('');
  const changeOpen = (nextOpen: boolean) => {
    if (nextOpen) {
      setTargetScore(String(state.profile.targetScore));
      setExamBlock(state.profile.examBlock);
    }
    setOpen(nextOpen);
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    try {
      onChange(updateStudentProfile(state, { targetScore: Number(targetScore), examBlock }));
      setError('');
      setOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể cập nhật mục tiêu');
    }
  };
  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger>
        <OutlineAction>
          <Pencil size={15} /> Cập nhật mục tiêu
        </OutlineAction>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Cập nhật mục tiêu học tập</DialogTitle>
          <DialogDescription>
            Điều chỉnh mục tiêu để Tú Tài đồng hành sát hơn với em.
          </DialogDescription>
        </DialogHeader>
        <form className={styles.editForm} onSubmit={submit}>
          <label>
            Điểm mục tiêu
            <input
              type="number"
              min="0"
              max="30"
              step="0.1"
              value={targetScore}
              onChange={(event) => setTargetScore(event.target.value)}
              required
            />
          </label>
          <label>
            Khối thi
            <input
              value={examBlock}
              onChange={(event) => setExamBlock(event.target.value)}
              required
            />
          </label>
          {error && <p className={styles.formError}>{error}</p>}
          <button type="submit" className={styles.saveButton}>
            <Check size={16} /> Lưu mục tiêu
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
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

export function ProfileClient({ initialProfile }: { initialProfile: StudentProfile }) {
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
              <GraduationCap size={18} /> {PROFILE_PRESENTATION.examLabel} · Mục tiêu{' '}
              {profile.targetScore}+
            </span>
            <span>
              <BookOpen size={18} /> {PROFILE_PRESENTATION.subjects.join(' · ')}
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
              { label: 'Lớp', value: profile.grade },
            ]}
          />
        </section>
        <section className={styles.infoCard}>
          <CardHeader
            icon={<Target size={21} />}
            title="Mục tiêu học tập"
            subtitle="Đặt mục tiêu để có động lực học tập mỗi ngày."
            action={<GoalEditDialog state={state} onChange={setState} />}
          />
          <DetailRows
            rows={[
              { label: 'Kỳ thi', value: PROFILE_PRESENTATION.examLabel },
              { label: 'Mục tiêu', value: `${profile.targetScore}+` },
              {
                label: 'Môn đang học',
                value: (
                  <>
                    <span>3 môn</span>
                    <span className={styles.subjects}>
                      {PROFILE_PRESENTATION.subjects.map((subject) => (
                        <i key={subject}>{subject}</i>
                      ))}
                    </span>
                  </>
                ),
              },
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
            ]}
          />
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
