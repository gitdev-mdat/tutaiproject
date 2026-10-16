'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { fetchAuthSession } from '@/lib/auth/client-session';

import { ProvinceCombobox } from '@/components/onboarding/province-combobox';
import { SchoolCombobox, type SchoolSelection } from '@/components/onboarding/school-combobox';
import {
  ACQUISITION_SOURCES,
  PRIMARY_SUBJECTS,
  isPrimarySubjectCode,
  parseOnboardingScore,
  type AcquisitionSource,
  type PrimarySubjectCode,
} from '@/lib/onboarding/onboarding-model';

const DRAFT_KEY = 'tutai_profile_onboarding_draft_v3';

interface OnboardingForm {
  fullName: string;
  grade: string;
  provinceCode: string;
  schoolId: string;
  schoolName: string;
  schoolSource: 'dataset' | 'custom' | '';
  phone: string;
  primarySubject: PrimarySubjectCode | '';
  currentScore: string;
  targetScore: string;
  acquisitionSource: AcquisitionSource | '';
  acquisitionSourceOther: string;
}

const EMPTY_FORM: OnboardingForm = {
  fullName: '',
  grade: '',
  provinceCode: '',
  schoolId: '',
  schoolName: '',
  schoolSource: '',
  phone: '',
  primarySubject: '',
  currentScore: '',
  targetScore: '',
  acquisitionSource: '',
  acquisitionSourceOther: '',
};

const inputClass =
  'mt-1 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[#0052FF] focus:ring-2 focus:ring-blue-100';
const labelClass = 'text-sm font-semibold text-slate-700';

function readDraft(): { step?: number; form?: Partial<OnboardingForm> } | null {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as { step?: number; form?: Partial<OnboardingForm> }) : null;
  } catch {
    return null;
  }
}

export default function ProfileOnboardingPage() {
  const router = useRouter();
  const [step, setStep] = React.useState(1);
  const [form, setForm] = React.useState<OnboardingForm>(EMPTY_FORM);
  const [hydrated, setHydrated] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');
  const [scoreWarning, setScoreWarning] = React.useState('');
  const [scoreWarningAcknowledged, setScoreWarningAcknowledged] = React.useState(false);
  const [blocked, setBlocked] = React.useState(false);

  React.useEffect(() => {
    // Sent back here when the profile is complete but no Roadmap could be opened.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBlocked(new URLSearchParams(window.location.search).get('assignment') === 'blocked');
    const stored = readDraft();
    // Hydrate the client-only draft after mount; the server cannot access sessionStorage.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored?.form) setForm((current) => ({ ...current, ...stored.form }));
    if (stored?.step && stored.step >= 1 && stored.step <= 3) setStep(stored.step);

    let active = true;
    fetchAuthSession()
      .then((session) => {
        if (!active || !session?.authenticated) return;
        setForm((current) => ({
          ...current,
          fullName: current.fullName || session.profile?.fullName || '',
          phone: current.phone || session.profile?.phone || '',
          grade: current.grade || session.profile?.grade || '',
          provinceCode: current.provinceCode || session.profile?.provinceCode || '',
          schoolId: current.schoolId || session.profile?.schoolId || '',
          schoolName: current.schoolName || session.profile?.schoolName || '',
          schoolSource: current.schoolSource || session.profile?.schoolSource || '',
          primarySubject:
            current.primarySubject ||
            (isPrimarySubjectCode(session.learning?.primarySubject)
              ? session.learning.primarySubject
              : ''),
          currentScore:
            current.currentScore ||
            (typeof session.learning?.currentScore === 'number'
              ? String(session.learning.currentScore)
              : ''),
          targetScore:
            current.targetScore ||
            (typeof session.learning?.targetScore === 'number'
              ? String(session.learning.targetScore)
              : ''),
        }));
      })
      .catch(() => undefined)
      .finally(() => active && setHydrated(true));

    return () => {
      active = false;
    };
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    try {
      window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ step, form }));
    } catch {
      // Session storage can be unavailable in restricted browser contexts.
    }
  }, [form, hydrated, step]);

  function set<K extends keyof OnboardingForm>(key: K, value: OnboardingForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setError('');
    if (key === 'currentScore' || key === 'targetScore') {
      setScoreWarning('');
      setScoreWarningAcknowledged(false);
    }
  }

  function setProvince(provinceCode: string) {
    setForm((current) => {
      if (current.provinceCode === provinceCode) return current;
      return {
        ...current,
        provinceCode,
        schoolId: '',
        schoolName: '',
        schoolSource: '',
      };
    });
    setError('');
  }

  function setSchool(selection: SchoolSelection) {
    setForm((current) => ({
      ...current,
      schoolId: selection.schoolId ?? '',
      schoolName: selection.schoolName,
      schoolSource: selection.schoolSource ?? '',
    }));
    setError('');
  }

  function next() {
    setError('');
    if (step === 1) {
      if (!form.fullName.trim() || !form.grade || !form.provinceCode) {
        setError('Vui lòng nhập họ tên, lớp và chọn tỉnh/thành phố.');
        return;
      }
      setStep(2);
      return;
    }

    const currentScore = parseOnboardingScore(form.currentScore);
    const targetScore = parseOnboardingScore(form.targetScore);
    if (!form.primarySubject || currentScore === null || targetScore === null) {
      setError('Chọn một môn và nhập điểm từ 0 đến 10.');
      return;
    }
    if (targetScore < currentScore && !scoreWarningAcknowledged) {
      setScoreWarning('Điểm em muốn đạt đang thấp hơn điểm hiện tại. Em kiểm tra lại nhé.');
      setScoreWarningAcknowledged(true);
      return;
    }
    setStep(3);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting || !form.acquisitionSource) {
      setError('Vui lòng chọn em biết Tú Tài từ đâu.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: form.fullName,
          grade: form.grade,
          provinceCode: form.provinceCode,
          schoolId: form.schoolId || undefined,
          schoolName: form.schoolName,
          schoolSource: form.schoolSource || undefined,
          phone: form.phone,
          primarySubject: form.primarySubject,
          currentScore: Number(form.currentScore.replace(',', '.')),
          targetScore: Number(form.targetScore.replace(',', '.')),
          acquisitionSource: form.acquisitionSource,
          acquisitionSourceOther:
            form.acquisitionSource === 'Khác' ? form.acquisitionSourceOther : undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? 'Không thể lưu hồ sơ.');
        setSubmitting(false);
        return;
      }
      window.sessionStorage.removeItem(DRAFT_KEY);
      router.replace(data.redirectTo ?? '/student/dashboard');
      router.refresh();
    } catch {
      setError('Không thể kết nối tới máy chủ. Vui lòng thử lại.');
      setSubmitting(false);
    }
  }

  const titles = ['Thông tin của em', 'Mục tiêu học tập', 'Em biết Tú Tài từ đâu?'];

  return (
    <section className="mx-auto w-full max-w-3xl">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#0052FF]">
            Thiết lập hồ sơ
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">
            {titles[step - 1]}
          </h1>
        </div>
        <span className="shrink-0 text-sm font-bold text-slate-500">Bước {step}/3</span>
      </div>
      <div className="mb-5 grid grid-cols-3 gap-2" aria-label={`Tiến độ bước ${step} trên 3`}>
        {[1, 2, 3].map((value) => (
          <span
            key={value}
            className={`h-1.5 rounded-full ${value <= step ? 'bg-[#0052FF]' : 'bg-slate-200'}`}
          />
        ))}
      </div>

      <form
        onSubmit={submit}
        className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
      >
        {blocked && !error ? (
          <div
            role="status"
            data-testid="assignment-blocked"
            className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800"
          >
            Tú Tài chưa mở được lộ trình cho hồ sơ này. Em kiểm tra lại thông tin rồi bấm Hoàn tất
            lần nữa nhé.
          </div>
        ) : null}
        {error ? (
          <div
            role="alert"
            className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
          >
            {error}
          </div>
        ) : null}

        {step === 1 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelClass}>
              Họ và tên *
              <input
                className={inputClass}
                value={form.fullName}
                onChange={(event) => set('fullName', event.target.value)}
                autoComplete="name"
              />
            </label>
            <label className={labelClass}>
              Lớp *
              <select
                className={inputClass}
                value={form.grade}
                onChange={(event) => set('grade', event.target.value)}
              >
                <option value="">Chọn lớp</option>
                {['10', '11', '12', 'Khác'].map((grade) => (
                  <option key={grade}>{grade}</option>
                ))}
              </select>
            </label>
            <div className={labelClass}>
              Tỉnh / Thành phố *
              <ProvinceCombobox value={form.provinceCode} onChange={setProvince} />
            </div>
            <div className={labelClass}>
              Trường THPT <span className="font-normal text-slate-400">(không bắt buộc)</span>
              <SchoolCombobox
                provinceCode={form.provinceCode}
                schoolId={form.schoolId}
                schoolName={form.schoolName}
                schoolSource={form.schoolSource}
                onChange={setSchool}
              />
            </div>
            <label className={`${labelClass} sm:col-span-2`}>
              Số điện thoại <span className="font-normal text-slate-400">(không bắt buộc)</span>
              <input
                className={inputClass}
                value={form.phone}
                onChange={(event) => set('phone', event.target.value)}
                autoComplete="tel"
                inputMode="tel"
              />
            </label>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="grid gap-5 sm:grid-cols-2">
            <p className="text-sm text-slate-500 sm:col-span-2">
              Tú Tài dùng thông tin này để chọn điểm bắt đầu và xây lộ trình phù hợp cho em.
            </p>
            <fieldset className="sm:col-span-2">
              <legend className={labelClass}>Môn em muốn cải thiện nhất *</legend>
              <div
                className="mt-2 flex flex-wrap gap-2"
                role="radiogroup"
                aria-label="Môn em muốn cải thiện nhất"
              >
                {PRIMARY_SUBJECTS.map((subject) => {
                  const active = form.primarySubject === subject.code;
                  return (
                    <button
                      key={subject.code}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => set('primarySubject', subject.code)}
                      className={`min-w-24 rounded-full border px-4 py-2.5 text-sm font-semibold transition ${active ? 'border-[#0052FF] bg-blue-50 text-[#0052FF] ring-1 ring-[#0052FF]/20' : 'border-slate-300 text-slate-700 hover:border-slate-400'}`}
                    >
                      {subject.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <label className={labelClass}>
              Điểm hiện tại *
              <input
                className={inputClass}
                type="number"
                min="0"
                max="10"
                step="0.01"
                inputMode="decimal"
                value={form.currentScore}
                onChange={(event) => set('currentScore', event.target.value)}
                placeholder="Ví dụ: 6.5"
              />
            </label>
            <label className={labelClass}>
              Điểm em muốn đạt *
              <input
                className={inputClass}
                type="number"
                min="0"
                max="10"
                step="0.01"
                inputMode="decimal"
                value={form.targetScore}
                onChange={(event) => set('targetScore', event.target.value)}
                placeholder="Ví dụ: 8.5"
              />
            </label>
            {scoreWarning ? (
              <p
                role="alert"
                className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 sm:col-span-2"
              >
                {scoreWarning} Nếu đây là chủ ý, em có thể bấm Tiếp tục lần nữa.
              </p>
            ) : null}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-5">
            <p className="text-sm text-slate-500">
              Thông tin này giúp Tú Tài biết kênh nào đang giúp nhiều học sinh tìm đến nhất.
            </p>
            <fieldset>
              <legend className={labelClass}>Em biết Tú Tài từ đâu? *</legend>
              <div
                className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4"
                role="radiogroup"
                aria-label="Nguồn giới thiệu"
              >
                {ACQUISITION_SOURCES.map((source) => {
                  const active = form.acquisitionSource === source;
                  return (
                    <button
                      key={source}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => set('acquisitionSource', source)}
                      className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-semibold transition ${active ? 'border-[#0052FF] bg-blue-50 text-[#0052FF]' : 'border-slate-300 text-slate-700 hover:border-slate-400'}`}
                    >
                      {source}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            {form.acquisitionSource === 'Khác' ? (
              <label className={labelClass}>
                Em biết Tú Tài qua đâu?{' '}
                <span className="font-normal text-slate-400">(không bắt buộc)</span>
                <input
                  className={inputClass}
                  value={form.acquisitionSourceOther}
                  onChange={(event) => set('acquisitionSourceOther', event.target.value)}
                />
              </label>
            ) : null}
          </div>
        ) : null}

        <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-5">
          <button
            type="button"
            onClick={() => setStep((current) => Math.max(1, current - 1))}
            className={`min-h-11 rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 ${step === 1 ? 'invisible' : ''}`}
          >
            ← Quay lại
          </button>
          {step < 3 ? (
            <button
              type="button"
              onClick={next}
              className="min-h-11 rounded-xl bg-[#0052FF] px-6 py-3 text-sm font-bold text-white"
            >
              Tiếp tục →
            </button>
          ) : (
            <button
              type="submit"
              disabled={submitting}
              className="min-h-11 rounded-xl bg-[#0052FF] px-6 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {submitting ? 'Đang lưu…' : 'Hoàn tất →'}
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
