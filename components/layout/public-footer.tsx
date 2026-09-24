import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';

export function PublicFooter() {
  return (
    <footer className="border-t border-slate-900/[0.06] bg-[#FAFBFC]">
      <div className="mx-auto max-w-[1320px] px-6 pb-[36px] pt-[72px] lg:px-8">
        <div className="grid grid-cols-1 gap-[72px] md:grid-cols-12">
          {/* Column 1: Brand (Largest) */}
          <div className="md:col-span-12 lg:col-span-5">
            <Link
              href="/"
              className="inline-block text-2xl font-extrabold tracking-tight text-[#091224]"
            >
              Tú Tài
            </Link>
            <p className="mt-4 max-w-[280px] text-[15px] font-medium leading-relaxed text-slate-500">
              Nền tảng luyện thi THPT Quốc Gia theo lộ trình cá nhân hóa.
            </p>
            <ul className="mt-6 flex flex-col gap-3">
              <li className="flex items-center gap-2.5">
                <CheckCircle2 size={18} className="text-emerald-500" />
                <span className="text-[14px] font-medium text-slate-600">
                  Miễn phí giai đoạn Beta
                </span>
              </li>
              <li className="flex items-center gap-2.5">
                <CheckCircle2 size={18} className="text-emerald-500" />
                <span className="text-[14px] font-medium text-slate-600">
                  Đề chất lượng được kiểm duyệt
                </span>
              </li>
              <li className="flex items-center gap-2.5">
                <CheckCircle2 size={18} className="text-emerald-500" />
                <span className="text-[14px] font-medium text-slate-600">Roadmap cá nhân hóa</span>
              </li>
            </ul>
          </div>

          {/* Column 2: Sản phẩm */}
          <div className="md:col-span-4 lg:col-span-2">
            <h3 className="mb-5 text-[14px] font-bold tracking-wide text-[#091224]">Sản phẩm</h3>
            <ul className="flex flex-col gap-3.5">
              <li>
                <Link
                  href="/roadmap"
                  className="text-[15px] font-medium text-slate-500 transition-colors duration-200 hover:text-[#0052FF]"
                >
                  Roadmap
                </Link>
              </li>
              <li>
                <Link
                  href="/exams"
                  className="text-[15px] font-medium text-slate-500 transition-colors duration-200 hover:text-[#0052FF]"
                >
                  Kho đề
                </Link>
              </li>
              <li>
                <Link
                  href="/exam-sets"
                  className="text-[15px] font-medium text-slate-500 transition-colors duration-200 hover:text-[#0052FF]"
                >
                  Bộ đề
                </Link>
              </li>
              <li>
                <Link
                  href="/progress"
                  className="text-[15px] font-medium text-slate-500 transition-colors duration-200 hover:text-[#0052FF]"
                >
                  Theo dõi tiến độ
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Tài nguyên */}
          <div className="md:col-span-4 lg:col-span-2">
            <h3 className="mb-5 text-[14px] font-bold tracking-wide text-[#091224]">Tài nguyên</h3>
            <ul className="flex flex-col gap-3.5">
              <li>
                <Link
                  href="/subjects"
                  className="text-[15px] font-medium text-slate-500 transition-colors duration-200 hover:text-[#0052FF]"
                >
                  Môn học
                </Link>
              </li>
              <li>
                <Link
                  href="/teachers"
                  className="text-[15px] font-medium text-slate-500 transition-colors duration-200 hover:text-[#0052FF]"
                >
                  Đội ngũ
                </Link>
              </li>
              <li>
                <Link
                  href="/blog"
                  className="text-[15px] font-medium text-slate-500 transition-colors duration-200 hover:text-[#0052FF]"
                >
                  Blog
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Công ty */}
          <div className="md:col-span-4 lg:col-span-3">
            <h3 className="mb-5 text-[14px] font-bold tracking-wide text-[#091224]">Công ty</h3>
            <ul className="flex flex-col gap-3.5">
              <li>
                <Link
                  href="/about"
                  className="text-[15px] font-medium text-slate-500 transition-colors duration-200 hover:text-[#0052FF]"
                >
                  Giới thiệu
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="text-[15px] font-medium text-slate-500 transition-colors duration-200 hover:text-[#0052FF]"
                >
                  Liên hệ
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="text-[15px] font-medium text-slate-500 transition-colors duration-200 hover:text-[#0052FF]"
                >
                  Điều khoản sử dụng
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="text-[15px] font-medium text-slate-500 transition-colors duration-200 hover:text-[#0052FF]"
                >
                  Chính sách bảo mật
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-16 flex flex-col items-center justify-between gap-6 border-t border-slate-900/[0.06] pt-8 md:flex-row">
          <p className="text-[14px] font-medium text-slate-500">
            &copy; 2026 Tú Tài. Made with ❤️ in Vietnam.
          </p>
          <div className="flex items-center gap-6">
            <Link
              href="#"
              className="text-slate-400 transition-colors duration-200 hover:text-[#0052FF]"
              aria-label="Facebook"
            >
              <svg className="h-[18px] w-[18px] fill-current" viewBox="0 0 24 24">
                <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c5.05-.5 9-4.76 9-9.95z" />
              </svg>
            </Link>
            <Link
              href="#"
              className="text-slate-400 transition-colors duration-200 hover:text-[#0052FF]"
              aria-label="YouTube"
            >
              <svg className="h-[20px] w-[20px] fill-current" viewBox="0 0 24 24">
                <path d="M21.58 7.19c-.23-.86-.91-1.54-1.77-1.77C18.25 5 12 5 12 5s-6.25 0-7.81.42c-.86.23-1.54.91-1.77 1.77C2 8.75 2 12 2 12s0 3.25.42 4.81c.23.86.91 1.54 1.77 1.77C5.75 19 12 19 12 19s6.25 0 7.81-.42c.86-.23 1.54-.91 1.77-1.77C22 15.25 22 12 22 12s0-3.25-.42-4.81zM10 15V9l5.2 3-5.2 3z" />
              </svg>
            </Link>
            <Link
              href="#"
              className="text-slate-400 transition-colors duration-200 hover:text-[#0052FF]"
              aria-label="TikTok"
            >
              <svg className="h-[18px] w-[18px] fill-current" viewBox="0 0 24 24">
                <path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 2.23-.9 4.46-2.37 6.11-1.48 1.64-3.54 2.72-5.74 3.01-2.21.3-4.52.02-6.52-1.07-2.02-1.09-3.66-2.92-4.47-5.06-.8-2.12-.76-4.5.1-6.57.87-2.12 2.62-3.88 4.77-4.73 2.14-.84 4.54-1.01 6.77-.42v4.26c-1.2-.38-2.54-.42-3.77-.07-1.25.35-2.34 1.13-3.05 2.19-.71 1.07-1.03 2.41-.89 3.69.14 1.28.81 2.45 1.81 3.25 1 1 2.37 1.51 3.8 1.48 1.41-.03 2.77-.61 3.73-1.61.97-1.01 1.48-2.4 1.46-3.82.02-4.22-.01-8.44.02-12.66z" />
              </svg>
            </Link>
            <Link
              href="#"
              className="text-slate-400 transition-colors duration-200 hover:text-[#0052FF]"
              aria-label="GitHub"
            >
              <svg className="h-[18px] w-[18px] fill-current" viewBox="0 0 24 24">
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48A10.001 10.001 0 0022 12c0-5.523-4.477-10-10-10z"
                />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
