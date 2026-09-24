import { Check, CircleAlert } from 'lucide-react';

const STEPS = ['Tải ảnh', 'Thông tin đề', 'Xử lý', 'Kiểm tra', 'Hoàn tất'] as const;

export function ImportStepper({
  current,
  failed = false,
  onStepChange,
}: {
  current: number;
  failed?: boolean;
  onStepChange?: (step: number) => void;
}) {
  const activeLabel = STEPS[Math.max(0, Math.min(STEPS.length - 1, current - 1))];

  return (
    <nav aria-label="Tiến trình nhập đề" className="border-b border-slate-200 bg-white">
      <div className="px-4 py-2.5 sm:hidden">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium text-slate-500">
              Bước {current}/{STEPS.length}
            </p>
            <p
              className={`mt-0.5 text-sm font-semibold ${failed ? 'text-red-700' : 'text-blue-700'}`}
            >
              {activeLabel}
            </p>
          </div>
          {current > 1 && onStepChange && (
            <button
              type="button"
              onClick={() => onStepChange(current - 1)}
              className="min-h-8 rounded-lg px-2 text-xs font-medium text-slate-600 outline-none hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              Quay lại {STEPS[current - 2]}
            </button>
          )}
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
          <div
            className={`h-full rounded-full ${failed ? 'bg-red-500' : 'bg-blue-600'}`}
            style={{ width: `${(current / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      <ol className="mx-auto hidden max-w-6xl items-center px-4 sm:flex lg:px-6">
        {STEPS.map((label, index) => {
          const number = index + 1;
          const complete = number < current;
          const active = number === current;
          const content = (
            <>
              <span
                className={`grid size-5 place-items-center rounded-full border text-[10px] ${
                  complete
                    ? 'border-blue-300 bg-blue-50 text-blue-700'
                    : active && failed
                      ? 'border-red-400 bg-red-50 text-red-700'
                      : active
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-slate-300 bg-white text-slate-500'
                }`}
              >
                {complete ? (
                  <Check className="size-3" />
                ) : active && failed ? (
                  <CircleAlert className="size-3" />
                ) : (
                  number
                )}
              </span>
              <span>{label}</span>
            </>
          );

          return (
            <li
              key={label}
              aria-current={active ? 'step' : undefined}
              className={`relative min-w-0 flex-1 border-b-2 ${
                active
                  ? failed
                    ? 'border-red-500 text-red-700'
                    : 'border-blue-600 font-semibold text-blue-700'
                  : complete
                    ? 'border-blue-200 text-slate-700'
                    : 'border-transparent text-slate-400'
              }`}
            >
              {complete && onStepChange ? (
                <button
                  type="button"
                  onClick={() => onStepChange(number)}
                  className="flex w-full items-center gap-2 px-2 py-3 text-left text-xs outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset lg:px-3"
                  aria-label={`Quay lại bước ${number}: ${label}`}
                >
                  {content}
                </button>
              ) : (
                <div className="flex items-center gap-2 px-2 py-3 text-xs lg:px-3">{content}</div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
