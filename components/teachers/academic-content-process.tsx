import { Files, Inbox, SearchCheck, Tags } from 'lucide-react';

const RESOURCE_RESPONSIBILITIES = [
  {
    number: '01',
    title: 'Tiếp nhận nguồn học liệu',
    description:
      'Tổng hợp tài liệu được chia sẻ hợp pháp từ giáo viên, cộng tác viên và các nguồn giáo dục phù hợp.',
    icon: Inbox,
  },
  {
    number: '02',
    title: 'Nghiên cứu tài liệu trường chuyên',
    description:
      'Tham khảo dạng bài, chuyên đề và phương pháp trình bày từ những nguồn được phép sử dụng hoặc được công khai.',
    icon: SearchCheck,
  },
  {
    number: '03',
    title: 'Đối chiếu nhiều nguồn',
    description:
      'So sánh kiến thức, đáp án và cách giải để hạn chế sai lệch hoặc phụ thuộc vào một tài liệu duy nhất.',
    icon: Files,
  },
  {
    number: '04',
    title: 'Phân loại và chuẩn hóa',
    description:
      'Gắn môn học, chương, bài, kỹ năng, độ khó và mục tiêu sử dụng trước khi chuyển vào quy trình biên soạn.',
    icon: Tags,
  },
] as const;

const EDITORIAL_STEPS = [
  {
    number: '01',
    title: 'Thu thập',
    description: 'Tiếp nhận tài liệu từ các nguồn phù hợp và xác định phạm vi sử dụng.',
  },
  {
    number: '02',
    title: 'Phân loại',
    description: 'Gắn nội dung với môn học, chương, bài, kỹ năng và dạng câu hỏi.',
  },
  {
    number: '03',
    title: 'Biên soạn',
    description: 'Giáo viên xây dựng lại câu hỏi, đáp án, lời giải và mục tiêu đánh giá.',
  },
  {
    number: '04',
    title: 'Phản biện',
    description: 'Kiểm tra độ chính xác, cách diễn đạt, mức độ phân loại và sự phù hợp với kỳ thi.',
  },
  {
    number: '05',
    title: 'Xuất bản',
    description: 'Đưa nội dung đạt chuẩn vào lộ trình, bộ đề mở hoặc bộ đề tuyển chọn phù hợp.',
  },
] as const;

export function LearningResourceTeam() {
  return (
    <section
      aria-labelledby="resource-team-title"
      className="bg-white px-4 py-16 sm:px-6 md:py-24 lg:px-8"
    >
      <div className="mx-auto max-w-[1240px]">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:gap-14">
          <div className="max-w-[600px]">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#1351d8]">
              Đội ngũ học liệu
            </p>
            <h2
              id="resource-team-title"
              className="mt-3 text-[29px] font-extrabold leading-[1.15] tracking-[-0.035em] text-[#0a1628] md:text-[42px]"
            >
              Tài liệu được tìm kiếm, đối chiếu và chuẩn hóa trước khi sử dụng
            </h2>
            <p className="mt-5 text-[15px] font-medium leading-[1.75] text-[#61738a] md:text-[17px]">
              Tú Tài không đưa tài liệu vào hệ thống chỉ vì tài liệu đó có sẵn. Mỗi nguồn đều cần
              được phân loại, đối chiếu và đánh giá trước khi chuyển đến đội ngũ biên soạn.
            </p>
            <p className="mt-5 border-l-2 border-[#1768ff] pl-4 text-[13px] font-semibold leading-[1.7] text-[#526881]">
              Phạm vi tham khảo chỉ gồm nguồn công khai, tài liệu được phép sử dụng và nội dung được
              chia sẻ hợp pháp.
            </p>
          </div>

          <ol className="border-y border-[#dfe8f5] md:grid md:grid-cols-2">
            {RESOURCE_RESPONSIBILITIES.map(({ number, title, description, icon: Icon }, index) => (
              <li
                key={number}
                className={`grid grid-cols-[42px_1fr] gap-4 py-6 md:block md:p-7 ${
                  index > 0 ? 'border-t border-[#dfe8f5] md:border-t-0' : ''
                } ${index % 2 === 1 ? 'md:border-l' : ''} ${index > 1 ? 'md:border-t' : ''}`}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eaf2ff] text-[#0b55c8]">
                  <Icon size={19} strokeWidth={1.9} aria-hidden="true" />
                </div>
                <div>
                  <span className="text-[11px] font-extrabold tracking-[0.12em] text-[#7b8da3]">
                    {number}
                  </span>
                  <h3 className="mt-2 text-[19px] font-extrabold tracking-[-0.02em] text-[#0a1628]">
                    {title}
                  </h3>
                  <p className="mt-3 text-[14px] font-medium leading-[1.7] text-[#61738a]">
                    {description}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

export function EditorialProcess() {
  return (
    <section
      id="editorial-process"
      aria-labelledby="editorial-process-title"
      className="scroll-mt-4 bg-[#f5f8ff] px-4 py-16 sm:px-6 md:py-24 lg:px-8"
    >
      <div className="mx-auto max-w-[1240px]">
        <div className="max-w-[820px]">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#1351d8]">
            Quy trình nội dung
          </p>
          <h2
            id="editorial-process-title"
            className="mt-3 text-[29px] font-extrabold leading-[1.15] tracking-[-0.035em] text-[#0a1628] md:text-[42px]"
          >
            Từ tài liệu tham khảo đến một bộ đề có giá trị học tập
          </h2>
          <p className="mt-4 max-w-[740px] text-[15px] font-medium leading-[1.75] text-[#61738a] md:text-[17px]">
            Đằng sau mỗi bài học và bộ đề của Tú Tài là một quy trình biên soạn, phản biện và chuẩn
            hóa học thuật nghiêm túc.
          </p>
        </div>

        <ol className="mt-10 border-y border-[#cfdded] lg:grid lg:grid-cols-5">
          {EDITORIAL_STEPS.map(({ number, title, description }, index) => (
            <li
              key={number}
              className={`grid grid-cols-[48px_1fr] gap-4 py-6 lg:block lg:min-w-0 lg:px-5 lg:py-8 ${
                index > 0 ? 'border-t border-[#cfdded] lg:border-l lg:border-t-0' : ''
              }`}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[#9fc2ff] bg-white text-[12px] font-extrabold text-[#0b55c8]">
                {number}
              </span>
              <div>
                <h3 className="text-[19px] font-extrabold tracking-[-0.02em] text-[#0a1628] lg:mt-5">
                  {title}
                </h3>
                <p className="mt-2.5 text-[14px] font-medium leading-[1.65] text-[#61738a]">
                  {description}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
