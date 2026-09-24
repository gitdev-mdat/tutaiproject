export const BLOG_AUTHOR = {
  name: 'Đội ngũ nội dung Tú Tài',
} as const;

export const BLOG_CATEGORIES = [
  {
    slug: 'chien-luoc-hoc-tap',
    name: 'Chiến lược học tập',
    description: 'Xây kế hoạch, nhịp học và cách tự đánh giá để tiến bộ bền vững.',
  },
  {
    slug: 'phuong-phap-lam-bai',
    name: 'Phương pháp làm bài',
    description: 'Biến kiến thức thành điểm số bằng quy trình đọc đề, giải và kiểm tra.',
  },
  {
    slug: 'kien-thuc-mon-hoc',
    name: 'Kiến thức môn học',
    description: 'Giải thích các mối liên hệ cốt lõi trong Toán, Lý, Hóa và Sinh.',
  },
  {
    slug: 'luyen-thi-thpt-quoc-gia',
    name: 'Luyện thi THPT Quốc gia',
    description: 'Chiến lược theo giai đoạn để luyện đề đúng lúc và giữ nhịp phòng thi.',
  },
  {
    slug: 'dinh-huong-muc-tieu',
    name: 'Định hướng & mục tiêu',
    description: 'Đặt mục tiêu phù hợp và chọn việc học có tác động lớn nhất.',
  },
] as const;

export type BlogCategorySlug = (typeof BLOG_CATEGORIES)[number]['slug'];
export type BlogSubject = 'Toán' | 'Vật lý' | 'Hóa học' | 'Sinh học' | 'Liên môn';

export type BlogContentBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered?: boolean; items: string[] }
  | { type: 'callout'; title: string; text: string; tone?: 'info' | 'warning' | 'example' }
  | { type: 'quote'; text: string }
  | { type: 'table'; caption: string; headers: string[]; rows: string[][] };

export interface BlogSection {
  id: string;
  title: string;
  blocks: BlogContentBlock[];
}

export interface BlogLearningLink {
  title: string;
  description: string;
  href: string;
  label: string;
}

export interface BlogArticle {
  slug: string;
  title: string;
  excerpt: string;
  categorySlug: BlogCategorySlug;
  subject: BlogSubject;
  tags: string[];
  collectionSlugs: string[];
  coverImage: string;
  coverAlt: string;
  publishedAt: string;
  updatedAt?: string;
  readingTimeMinutes: number;
  author: typeof BLOG_AUTHOR;
  featured?: boolean;
  status: 'published' | 'draft';
  seoTitle: string;
  seoDescription: string;
  keyTakeaways: string[];
  sections: BlogSection[];
  learningLinks: BlogLearningLink[];
  relatedArticleSlugs: string[];
}

export const BLOG_COLLECTIONS = [
  {
    slug: 'xay-nen-tang',
    eyebrow: 'BẮT ĐẦU LẠI CHO ĐÚNG',
    title: 'Xây lại nền tảng',
    description: 'Dành cho em đang hổng kiến thức và chưa biết nên bắt đầu từ đâu.',
  },
  {
    slug: 'quan-ly-thoi-gian',
    eyebrow: 'HỌC VÀ THI CÓ NHỊP',
    title: 'Quản lý thời gian',
    description: 'Lập kế hoạch tuần và phân bổ từng phút trong phòng thi.',
  },
  {
    slug: 'tranh-mat-diem',
    eyebrow: 'GIẢM LỖI KHÔNG ĐÁNG CÓ',
    title: 'Tránh mất điểm oan',
    description: 'Những quy trình nhỏ giúp bảo vệ số điểm em đã đủ khả năng đạt được.',
  },
  {
    slug: 'muc-tieu-8-cong',
    eyebrow: 'TĂNG TỐC CÓ CHỌN LỌC',
    title: 'Mục tiêu 8+',
    description: 'Chọn đúng phần cần củng cố trước khi chạm vào câu phân loại.',
  },
] as const;

export const BLOG_ARTICLES: BlogArticle[] = [
  {
    slug: 'cach-phan-bo-thoi-gian-khi-lam-de-thi-thpt-quoc-gia',
    title: 'Cách phân bổ thời gian khi làm đề thi THPT Quốc gia',
    excerpt:
      'Một khung ba lượt giúp em thu điểm chắc trước, giữ thời gian cho câu khó và vẫn còn phút để kiểm tra phiếu trả lời.',
    categorySlug: 'luyen-thi-thpt-quoc-gia',
    subject: 'Liên môn',
    tags: ['Quản lý thời gian', 'Luyện đề', 'Phòng thi'],
    collectionSlugs: ['quan-ly-thoi-gian', 'tranh-mat-diem'],
    coverImage: '/assets/blog/luyen-thi-thpt.svg',
    coverAlt: 'Đồng hồ và phiếu trả lời tượng trưng cho chiến lược phân bổ thời gian khi thi',
    publishedAt: '2026-07-18T08:00:00+07:00',
    updatedAt: '2026-07-24T08:00:00+07:00',
    readingTimeMinutes: 8,
    author: BLOG_AUTHOR,
    featured: true,
    status: 'published',
    seoTitle: 'Cách phân bổ thời gian khi làm đề thi THPT Quốc gia',
    seoDescription:
      'Khung phân bổ thời gian ba lượt khi làm đề THPT Quốc gia, kèm cách luyện, mốc chuyển câu và bước kiểm tra cuối giờ.',
    keyTakeaways: [
      'Chia bài thi thành ba lượt: thu điểm chắc, xử lý câu cần suy luận, quay lại câu khó.',
      'Đặt mốc thời gian chuyển lượt trước khi luyện đề, không quyết định theo cảm giác.',
      'Luôn giữ một khoảng cuối giờ riêng cho phiếu trả lời và các câu đã đánh dấu.',
    ],
    sections: [
      {
        id: 'vi-sao-thieu-thoi-gian',
        title: 'Vì sao biết bài nhưng vẫn thiếu thời gian?',
        blocks: [
          {
            type: 'paragraph',
            text: 'Thiếu thời gian thường không bắt đầu ở phút cuối. Nó tích lũy từ việc dừng quá lâu ở một câu, kiểm tra đi kiểm tra lại phần đã chắc hoặc chuyển câu mà không có nguyên tắc rõ ràng.',
          },
          {
            type: 'callout',
            title: 'Dấu hiệu cần đổi chiến lược',
            text: 'Nếu em thường bỏ trống câu dễ ở cuối đề nhưng đã dành nhiều phút cho một câu khó ở giữa, vấn đề nằm ở thứ tự thu điểm chứ không chỉ ở tốc độ tính.',
            tone: 'warning',
          },
        ],
      },
      {
        id: 'khung-ba-luot',
        title: 'Khung ba lượt để thu điểm có chủ đích',
        blocks: [
          {
            type: 'table',
            caption: 'Mục tiêu của từng lượt làm bài',
            headers: ['Lượt', 'Việc cần làm', 'Nguyên tắc chuyển câu'],
            rows: [
              [
                '1. Thu điểm chắc',
                'Làm câu nhận biết và câu em nhìn ra hướng giải ngay',
                'Đánh dấu khi chưa có hướng sau lần đọc đầu',
              ],
              [
                '2. Suy luận',
                'Quay lại câu cần vài bước biến đổi hoặc so sánh phương án',
                'Dừng khi vượt mốc thời gian đã tập',
              ],
              [
                '3. Quyết định',
                'Xử lý câu khó còn lại và rà phiếu',
                'Ưu tiên câu có xác suất hoàn thành cao hơn',
              ],
            ],
          },
          {
            type: 'paragraph',
            text: 'Tỷ lệ phút cụ thể phụ thuộc môn và năng lực hiện tại. Điều quan trọng là em đo bằng ba đề gần nhất, rồi ấn định mốc chuyển lượt phù hợp thay vì sao chép một con số cố định của người khác.',
          },
        ],
      },
      {
        id: 'luyen-nhip-truoc-ngay-thi',
        title: 'Luyện nhịp trước ngày thi',
        blocks: [
          {
            type: 'list',
            ordered: true,
            items: [
              'Làm một đề đúng thời lượng và ghi lại thời điểm kết thúc mỗi lượt.',
              'Phân loại câu bỏ lại: chưa nhớ kiến thức, chưa nhận dạng được hay tính quá lâu.',
              'Điều chỉnh mốc chuyển lượt tối đa vài phút và thử lại ở đề kế tiếp.',
              'Giữ cùng một quy ước đánh dấu trên đề để không mất công tìm lại câu.',
            ],
          },
          {
            type: 'quote',
            text: 'Một chiến lược thời gian tốt không giúp em làm mọi câu; nó giúp em không bỏ lỡ những câu mình có thể làm đúng.',
          },
        ],
      },
    ],
    learningLinks: [
      {
        title: 'Luyện với bộ đề THPT',
        description: 'Thực hành khung ba lượt trong các bộ đề có cấu trúc rõ ràng.',
        href: '/exam-sets',
        label: 'Mở bộ đề',
      },
      {
        title: 'Ôn theo môn lớp 12',
        description: 'Củng cố phần kiến thức khiến em phải dừng quá lâu khi làm đề.',
        href: '/subjects',
        label: 'Chọn môn học',
      },
    ],
    relatedArticleSlugs: [
      'on-thi-theo-chuyen-de-hay-luyen-de-tong-hop-truoc',
      'nam-buoc-kiem-tra-loi-giai-de-tranh-mat-diem-oan',
      'dat-muc-tieu-8-cong-theo-nang-luc-hien-tai',
    ],
  },
  {
    slug: 'lap-ke-hoach-hoc-12-tuan-khong-bi-qua-tai',
    title: 'Lập kế hoạch học 12 tuần mà không bị quá tải',
    excerpt:
      'Biến mục tiêu lớn thành chu kỳ học ngắn, có tuần dự phòng và tín hiệu điều chỉnh trước khi lịch học vỡ trận.',
    categorySlug: 'chien-luoc-hoc-tap',
    subject: 'Liên môn',
    tags: ['Kế hoạch học tập', '12 tuần', 'Tự đánh giá'],
    collectionSlugs: ['quan-ly-thoi-gian', 'muc-tieu-8-cong'],
    coverImage: '/assets/blog/chien-luoc-hoc-tap.svg',
    coverAlt: 'Lịch học 12 tuần được chia thành các chặng tiến bộ',
    publishedAt: '2026-07-11T08:00:00+07:00',
    readingTimeMinutes: 7,
    author: BLOG_AUTHOR,
    status: 'published',
    seoTitle: 'Cách lập kế hoạch học 12 tuần không bị quá tải',
    seoDescription:
      'Hướng dẫn lập kế hoạch ôn tập 12 tuần theo chu kỳ, có ưu tiên, tuần dự phòng và cách điều chỉnh theo kết quả thực tế.',
    keyTakeaways: [
      'Chỉ chọn tối đa hai ưu tiên lớn cho mỗi chu kỳ hai tuần.',
      'Dành sẵn thời gian dự phòng thay vì xếp kín toàn bộ lịch.',
      'Đánh giá bằng đầu ra đã làm được, không chỉ bằng số giờ ngồi học.',
    ],
    sections: [
      {
        id: 'bat-dau-tu-dau-ra',
        title: 'Bắt đầu từ đầu ra, không bắt đầu từ thời khóa biểu',
        blocks: [
          {
            type: 'paragraph',
            text: 'Trước khi chia giờ, hãy viết rõ sau 12 tuần em muốn làm được điều gì: hoàn thành nhóm chuyên đề nào, đạt mức ổn định nào trong đề và giảm loại lỗi nào. Một đầu ra đo được sẽ giúp em biết buổi học nào thật sự cần thiết.',
          },
          {
            type: 'callout',
            title: 'Ví dụ đầu ra',
            text: '“Làm đúng ổn định các câu nhận biết và thông hiểu về đạo hàm trong ba đề liên tiếp” cụ thể hơn “học tốt đạo hàm”.',
            tone: 'example',
          },
        ],
      },
      {
        id: 'chia-sau-chu-ky',
        title: 'Chia 12 tuần thành sáu chu kỳ ngắn',
        blocks: [
          {
            type: 'list',
            ordered: true,
            items: [
              'Chu kỳ 1: đo điểm xuất phát và lấp lỗ hổng cản trở lớn nhất.',
              'Chu kỳ 2–4: học theo chuyên đề, mỗi chu kỳ có một bài kiểm tra đầu ra.',
              'Chu kỳ 5: kết nối chuyên đề bằng đề tổng hợp có chọn lọc.',
              'Chu kỳ 6: mô phỏng, rà lỗi lặp lại và ổn định nhịp làm bài.',
            ],
          },
          {
            type: 'paragraph',
            text: 'Trong mỗi chu kỳ, giữ khoảng 20% thời lượng chưa phân công. Phần này dùng cho bài khó hơn dự kiến, một ngày sức khỏe không tốt hoặc một chủ đề cần học lại.',
          },
        ],
      },
      {
        id: 'tin-hieu-dieu-chinh',
        title: 'Ba tín hiệu cho thấy cần điều chỉnh lịch',
        blocks: [
          {
            type: 'list',
            items: [
              'Hai tuần liên tiếp không hoàn thành đầu ra chính.',
              'Số câu làm đúng không tăng dù thời gian học tăng.',
              'Em liên tục dời phần chữa bài sang cuối tuần.',
            ],
          },
          {
            type: 'paragraph',
            text: 'Khi gặp một tín hiệu, hãy giảm khối lượng mới và bảo vệ thời gian chữa lỗi. Kế hoạch tốt là kế hoạch có thể thay đổi dựa trên dữ liệu học thật.',
          },
        ],
      },
    ],
    learningLinks: [
      {
        title: 'Khám phá lộ trình môn học',
        description: 'Xem các chặng học lớp 12 đã được sắp theo mối liên hệ kiến thức.',
        href: '/subjects',
        label: 'Xem lộ trình',
      },
      {
        title: 'Bắt đầu với một bộ đề',
        description: 'Dùng kết quả làm đề làm điểm xuất phát cho kế hoạch.',
        href: '/exam-sets',
        label: 'Chọn bộ đề',
      },
    ],
    relatedArticleSlugs: [
      'cach-hoc-lai-kien-thuc-nen-khi-dang-mat-goc',
      'dat-muc-tieu-8-cong-theo-nang-luc-hien-tai',
      'on-thi-theo-chuyen-de-hay-luyen-de-tong-hop-truoc',
    ],
  },
  {
    slug: 'cach-hoc-lai-kien-thuc-nen-khi-dang-mat-goc',
    title: 'Cách học lại kiến thức nền khi em đang mất gốc',
    excerpt:
      'Một lộ trình khởi động nhỏ: xác định lỗ hổng gốc, học lại đúng mắt xích và kiểm tra bằng bài tập vừa sức.',
    categorySlug: 'chien-luoc-hoc-tap',
    subject: 'Liên môn',
    tags: ['Mất gốc', 'Kiến thức nền', 'Tự học'],
    collectionSlugs: ['xay-nen-tang'],
    coverImage: '/assets/blog/chien-luoc-hoc-tap.svg',
    coverAlt: 'Các khối kiến thức nền được xếp lại thành một bậc thang vững chắc',
    publishedAt: '2026-06-27T08:00:00+07:00',
    readingTimeMinutes: 6,
    author: BLOG_AUTHOR,
    status: 'published',
    seoTitle: 'Mất gốc nên học lại từ đâu? Lộ trình kiến thức nền',
    seoDescription:
      'Cách xác định lỗ hổng kiến thức, chọn mắt xích cần học lại và kiểm tra tiến bộ khi em đang mất gốc.',
    keyTakeaways: [
      'Không cần học lại toàn bộ chương trình từ đầu.',
      'Tìm khái niệm gốc đang chặn nhiều dạng bài nhất.',
      'Dùng bài tập vừa sức để xác nhận mỗi mắt xích đã chắc.',
    ],
    sections: [
      {
        id: 'mat-goc-khong-phai-nhan',
        title: '“Mất gốc” không phải là một nhãn cố định',
        blocks: [
          {
            type: 'paragraph',
            text: 'Cảm giác không biết gì thường xuất hiện khi một vài mắt xích cơ bản bị thiếu. Hãy thay câu hỏi “em mất gốc môn này không?” bằng “bước nào trong lời giải em không giải thích được?”.',
          },
        ],
      },
      {
        id: 'ban-do-lo-hong',
        title: 'Lập bản đồ lỗ hổng trong 30 phút',
        blocks: [
          {
            type: 'list',
            ordered: true,
            items: [
              'Chọn một bài kiểm tra ngắn ở mức cơ bản.',
              'Đánh dấu câu sai theo ba nhóm: không nhớ khái niệm, không nhận ra dạng, sai thao tác.',
              'Tìm lỗi xuất hiện ở nhiều câu và ưu tiên nó trước.',
              'Chọn một bài học ngắn cùng 5–8 câu kiểm tra ngay sau đó.',
            ],
          },
          {
            type: 'callout',
            title: 'Tránh học lan man',
            text: 'Nếu lỗi nằm ở phép biến đổi đại số, việc xem thêm nhiều bài giải đạo hàm khó sẽ chưa giải quyết được nút thắt.',
            tone: 'warning',
          },
        ],
      },
      {
        id: 'vong-lap-nho',
        title: 'Duy trì vòng lặp nhỏ mỗi ngày',
        blocks: [
          {
            type: 'paragraph',
            text: 'Một vòng lặp gồm nhắc lại khái niệm, xem một ví dụ, tự làm vài câu và ghi lỗi. Khi đạt độ chính xác ổn định trong hai lần học cách nhau, em mới nối sang mắt xích tiếp theo.',
          },
          {
            type: 'quote',
            text: 'Tiến bộ khi học lại nền tảng đến từ số mắt xích đã nối chắc, không đến từ số trang đã đọc.',
          },
        ],
      },
    ],
    learningLinks: [
      {
        title: 'Chọn môn cần xây lại nền',
        description: 'Đi vào hub Toán, Vật lý, Hóa học hoặc Sinh học lớp 12.',
        href: '/subjects',
        label: 'Chọn môn học',
      },
    ],
    relatedArticleSlugs: [
      'lap-ke-hoach-hoc-12-tuan-khong-bi-qua-tai',
      'dao-ham-va-bang-bien-thien-hoc-theo-moi-lien-he',
      'dat-muc-tieu-8-cong-theo-nang-luc-hien-tai',
    ],
  },
  {
    slug: 'nam-buoc-kiem-tra-loi-giai-de-tranh-mat-diem-oan',
    title: '5 bước kiểm tra lời giải để tránh mất điểm oan',
    excerpt:
      'Một checklist ngắn để phát hiện sai điều kiện, sai dấu, thiếu đơn vị và tô nhầm đáp án trước khi nộp bài.',
    categorySlug: 'phuong-phap-lam-bai',
    subject: 'Liên môn',
    tags: ['Kiểm tra lời giải', 'Sai sót', 'Checklist'],
    collectionSlugs: ['tranh-mat-diem'],
    coverImage: '/assets/blog/phuong-phap-lam-bai.svg',
    coverAlt: 'Bút đánh dấu năm bước trên một phiếu kiểm tra lời giải',
    publishedAt: '2026-07-04T08:00:00+07:00',
    readingTimeMinutes: 5,
    author: BLOG_AUTHOR,
    status: 'published',
    seoTitle: '5 bước kiểm tra lời giải để tránh mất điểm oan',
    seoDescription:
      'Checklist năm bước giúp học sinh kiểm tra điều kiện, phép tính, đơn vị và đáp án trước khi nộp bài.',
    keyTakeaways: [
      'Kiểm tra theo loại lỗi thay vì đọc lại toàn bộ lời giải.',
      'Ưu tiên câu đã đánh dấu nghi ngờ.',
      'Luyện checklist trong lúc làm đề, không đợi đến ngày thi.',
    ],
    sections: [
      {
        id: 'tai-sao-doc-lai-chua-du',
        title: 'Vì sao chỉ đọc lại thường chưa đủ?',
        blocks: [
          {
            type: 'paragraph',
            text: 'Khi đọc lại ngay sau khi giải, não có xu hướng thấy điều mình định viết thay vì điều thật sự nằm trên giấy. Một checklist cố định buộc em đổi góc nhìn theo từng loại lỗi.',
          },
        ],
      },
      {
        id: 'checklist-nam-buoc',
        title: 'Checklist năm bước',
        blocks: [
          {
            type: 'list',
            ordered: true,
            items: [
              'Đọc lại đúng yêu cầu: đề hỏi giá trị, số nghiệm hay mệnh đề đúng?',
              'Rà điều kiện và miền giá trị trước khi nhận kết quả.',
              'Ước lượng dấu, độ lớn hoặc xu hướng để phát hiện kết quả vô lý.',
              'Kiểm tra đơn vị và việc đổi đơn vị ở các môn khoa học.',
              'Đối chiếu số câu, phương án và vị trí tô trên phiếu trả lời.',
            ],
          },
          {
            type: 'callout',
            title: 'Cách ghi nhớ',
            text: 'Viết năm từ khóa ở đầu giấy nháp trong vài buổi luyện đầu: hỏi – điều kiện – ước lượng – đơn vị – phiếu.',
            tone: 'info',
          },
        ],
      },
      {
        id: 'luyen-thanh-phan-xa',
        title: 'Luyện checklist thành phản xạ',
        blocks: [
          {
            type: 'paragraph',
            text: 'Trong ba đề đầu, dành riêng vài phút cuối cho checklist và ghi lại lỗi bắt được. Sau đó, rút gọn bước nào đã thành thói quen và giữ kỹ bước vẫn thường cứu điểm.',
          },
        ],
      },
    ],
    learningLinks: [
      {
        title: 'Thử checklist trong đề thật',
        description: 'Chọn một bộ đề và ghi lại lỗi checklist đã phát hiện.',
        href: '/exam-sets',
        label: 'Luyện bộ đề',
      },
    ],
    relatedArticleSlugs: [
      'cach-phan-bo-thoi-gian-khi-lam-de-thi-thpt-quoc-gia',
      'doc-de-vat-ly-tach-du-kien-va-chon-mo-hinh',
      'muc-tieu-9-cong-va-cach-xu-ly-cau-phan-loai',
    ],
  },
  {
    slug: 'doc-de-vat-ly-tach-du-kien-va-chon-mo-hinh',
    title: 'Đọc đề Vật lý: tách dữ kiện và chọn mô hình',
    excerpt:
      'Quy trình bốn câu hỏi giúp em chuyển một đề dài thành dữ kiện, đại lượng cần tìm và mô hình vật lý phù hợp.',
    categorySlug: 'phuong-phap-lam-bai',
    subject: 'Vật lý',
    tags: ['Đọc đề', 'Mô hình Vật lý', 'Dữ kiện'],
    collectionSlugs: ['xay-nen-tang', 'tranh-mat-diem'],
    coverImage: '/assets/blog/phuong-phap-lam-bai.svg',
    coverAlt: 'Các dữ kiện Vật lý được nối thành một mô hình giải bài',
    publishedAt: '2026-06-19T08:00:00+07:00',
    readingTimeMinutes: 6,
    author: BLOG_AUTHOR,
    status: 'published',
    seoTitle: 'Cách đọc đề Vật lý và chọn đúng mô hình giải',
    seoDescription:
      'Quy trình tách dữ kiện, nhận diện đại lượng cần tìm và chọn mô hình khi giải bài tập Vật lý.',
    keyTakeaways: [
      'Tách dữ kiện đã cho khỏi phần mô tả bối cảnh.',
      'Viết đại lượng cần tìm trước khi chọn công thức.',
      'Kiểm tra giả thiết để tránh dùng đúng công thức cho sai mô hình.',
    ],
    sections: [
      {
        id: 'bon-cau-hoi',
        title: 'Bốn câu hỏi trước khi viết công thức',
        blocks: [
          {
            type: 'list',
            ordered: true,
            items: [
              'Hệ vật lý gồm những đối tượng nào?',
              'Đề cho đại lượng nào và chúng đang ở cùng hệ đơn vị chưa?',
              'Cần tìm đại lượng nào?',
              'Điều kiện nào cho phép dùng mô hình hoặc định luật em đang nghĩ tới?',
            ],
          },
        ],
      },
      {
        id: 'tu-du-kien-den-mo-hinh',
        title: 'Từ dữ kiện đến mô hình',
        blocks: [
          {
            type: 'paragraph',
            text: 'Hãy vẽ sơ đồ tối giản hoặc trục thời gian nếu trạng thái thay đổi. Sau đó nối dữ kiện với đại lượng cần tìm bằng một quan hệ vật lý, thay vì liệt kê mọi công thức có chứa ký hiệu giống đề.',
          },
          {
            type: 'callout',
            title: 'Ví dụ',
            text: 'Hai bài cùng cho vận tốc và thời gian chưa chắc dùng cùng công thức: một bài chuyển động đều, bài kia có gia tốc hoặc đổi chiều.',
            tone: 'example',
          },
        ],
      },
      {
        id: 'kiem-tra-mo-hinh',
        title: 'Kiểm tra mô hình bằng đơn vị và giới hạn',
        blocks: [
          {
            type: 'paragraph',
            text: 'Sau khi tính, kiểm tra đơn vị, dấu và trường hợp giới hạn. Nếu một đại lượng tăng mà kết quả theo mô hình lại giảm, hãy quay lại giả thiết trước khi bấm máy lại.',
          },
        ],
      },
    ],
    learningLinks: [
      {
        title: 'Hub Vật lý lớp 12',
        description: 'Học theo các chủ đề và mối liên hệ của chương trình Vật lý.',
        href: '/subjects/vat-ly/grade-12',
        label: 'Học Vật lý',
      },
    ],
    relatedArticleSlugs: [
      'nam-buoc-kiem-tra-loi-giai-de-tranh-mat-diem-oan',
      'cach-hoc-lai-kien-thuc-nen-khi-dang-mat-goc',
      'bao-toan-electron-khi-nao-nen-su-dung',
    ],
  },
  {
    slug: 'dao-ham-va-bang-bien-thien-hoc-theo-moi-lien-he',
    title: 'Đạo hàm và bảng biến thiên: học theo mối liên hệ',
    excerpt:
      'Nối dấu của đạo hàm với chiều biến thiên, cực trị và hình dáng đồ thị để giảm học thuộc rời rạc.',
    categorySlug: 'kien-thuc-mon-hoc',
    subject: 'Toán',
    tags: ['Đạo hàm', 'Bảng biến thiên', 'Hàm số'],
    collectionSlugs: ['xay-nen-tang', 'muc-tieu-8-cong'],
    coverImage: '/assets/blog/kien-thuc-mon-hoc.svg',
    coverAlt: 'Đồ thị hàm số và bảng dấu đạo hàm được đặt trong cùng một hệ liên kết',
    publishedAt: '2026-06-12T08:00:00+07:00',
    updatedAt: '2026-06-16T08:00:00+07:00',
    readingTimeMinutes: 7,
    author: BLOG_AUTHOR,
    status: 'published',
    seoTitle: 'Hiểu đạo hàm và bảng biến thiên theo mối liên hệ',
    seoDescription:
      'Cách học đạo hàm, dấu đạo hàm, chiều biến thiên và cực trị như một chuỗi suy luận thống nhất.',
    keyTakeaways: [
      'Dấu đạo hàm là cầu nối giữa phép tính và hình dáng hàm số.',
      'Bảng biến thiên là bản tóm tắt suy luận, không phải mẫu để chép thuộc.',
      'Luôn đọc cả hai chiều: từ đạo hàm sang đồ thị và ngược lại.',
    ],
    sections: [
      {
        id: 'chuoi-lien-he',
        title: 'Chuỗi liên hệ cần nắm',
        blocks: [
          {
            type: 'paragraph',
            text: 'Tại một khoảng, dấu của đạo hàm cho biết hàm số tăng hay giảm. Khi dấu đổi qua một điểm phù hợp, ta có thông tin về cực trị. Bảng biến thiên gom các kết luận đó thành một hình ảnh có trật tự.',
          },
          {
            type: 'quote',
            text: 'Hãy đọc bảng biến thiên như một câu chuyện về chuyển động của giá trị hàm số trên trục x.',
          },
        ],
      },
      {
        id: 'hoc-hai-chieu',
        title: 'Luyện suy luận theo hai chiều',
        blocks: [
          {
            type: 'list',
            items: [
              'Từ biểu thức đạo hàm: lập bảng dấu rồi dự đoán hình dáng đồ thị.',
              'Từ đồ thị: chỉ ra khoảng tăng giảm rồi suy dấu đạo hàm.',
              'Từ bảng biến thiên: xác định số cực trị, giá trị cực trị và nghiệm của các phương trình liên quan.',
            ],
          },
        ],
      },
      {
        id: 'loi-thuong-gap',
        title: 'Lỗi thường gặp khi lập bảng',
        blocks: [
          {
            type: 'table',
            caption: 'Lỗi và câu hỏi tự kiểm tra',
            headers: ['Lỗi', 'Câu hỏi kiểm tra'],
            rows: [
              [
                'Bỏ điểm đạo hàm không xác định',
                'Miền xác định và các mốc chia khoảng đã đủ chưa?',
              ],
              [
                'Kết luận cực trị chỉ vì đạo hàm bằng 0',
                'Dấu đạo hàm có thực sự đổi qua điểm đó không?',
              ],
              ['Vẽ mũi tên sai chiều', 'Dấu trên từng khoảng khớp với tăng/giảm chưa?'],
            ],
          },
        ],
      },
    ],
    learningLinks: [
      {
        title: 'Chuyên đề Toán lớp 12',
        description: 'Đi tiếp từ mối liên hệ sang bài học và bài luyện về hàm số.',
        href: '/subjects/toan/grade-12',
        label: 'Học Toán',
      },
      {
        title: 'Bộ đề chương đạo hàm',
        description: 'Luyện từ mức nền tảng đến vận dụng trong bộ đề theo chương.',
        href: '/exam-sets/toan-chuong-dao-ham-nen-tang',
        label: 'Mở bộ đề',
      },
    ],
    relatedArticleSlugs: [
      'cach-hoc-lai-kien-thuc-nen-khi-dang-mat-goc',
      'bao-toan-electron-khi-nao-nen-su-dung',
      'muc-tieu-9-cong-va-cach-xu-ly-cau-phan-loai',
    ],
  },
  {
    slug: 'bao-toan-electron-khi-nao-nen-su-dung',
    title: 'Bảo toàn electron: khi nào nên sử dụng?',
    excerpt:
      'Nhận diện phản ứng oxi hóa – khử, chọn quá trình nhường nhận electron và biết lúc nào phương pháp không đủ.',
    categorySlug: 'kien-thuc-mon-hoc',
    subject: 'Hóa học',
    tags: ['Bảo toàn electron', 'Oxi hóa – khử', 'Hóa học'],
    collectionSlugs: ['xay-nen-tang', 'muc-tieu-8-cong'],
    coverImage: '/assets/blog/kien-thuc-mon-hoc.svg',
    coverAlt: 'Các electron dịch chuyển giữa hai vế của phản ứng hóa học',
    publishedAt: '2026-05-29T08:00:00+07:00',
    readingTimeMinutes: 7,
    author: BLOG_AUTHOR,
    status: 'published',
    seoTitle: 'Bảo toàn electron: dấu hiệu nhận biết và cách dùng',
    seoDescription:
      'Hiểu bản chất bảo toàn electron, dấu hiệu nên áp dụng và các bước tránh sai trong bài toán oxi hóa – khử.',
    keyTakeaways: [
      'Chỉ áp dụng khi xác định được quá trình nhường và nhận electron.',
      'Tổng electron nhường bằng tổng electron nhận cho toàn quá trình.',
      'Kết hợp thêm bảo toàn nguyên tố hoặc điện tích khi đề cần nhiều ẩn.',
    ],
    sections: [
      {
        id: 'ban-chat',
        title: 'Bản chất của phương pháp',
        blocks: [
          {
            type: 'paragraph',
            text: 'Trong phản ứng oxi hóa – khử, electron không tự sinh ra hay mất đi. Tổng số mol electron mà các chất khử nhường bằng tổng số mol electron mà các chất oxi hóa nhận.',
          },
        ],
      },
      {
        id: 'dau-hieu-su-dung',
        title: 'Ba dấu hiệu nên nghĩ đến bảo toàn electron',
        blocks: [
          {
            type: 'list',
            items: [
              'Đề có sự thay đổi số oxi hóa rõ ràng.',
              'Hỗn hợp nhiều chất nhưng cần quan hệ tổng quát giữa chất oxi hóa và chất khử.',
              'Viết đầy đủ mọi phương trình riêng lẻ sẽ dài trong khi các quá trình electron đơn giản.',
            ],
          },
          {
            type: 'callout',
            title: 'Giới hạn',
            text: 'Bảo toàn electron có thể cho một phương trình quan hệ nhưng không phải lúc nào cũng đủ để tìm mọi ẩn. Hãy kiểm tra dữ kiện về khối lượng, nguyên tố hoặc điện tích.',
            tone: 'warning',
          },
        ],
      },
      {
        id: 'quy-trinh',
        title: 'Quy trình bốn bước',
        blocks: [
          {
            type: 'list',
            ordered: true,
            items: [
              'Xác định nguyên tố thay đổi số oxi hóa.',
              'Viết quá trình nhường và nhận electron.',
              'Nhân hệ số theo lượng chất thực tế, không chỉ cân bằng ký hiệu.',
              'Lập đẳng thức tổng electron và kiểm tra với dữ kiện còn lại.',
            ],
          },
        ],
      },
    ],
    learningLinks: [
      {
        title: 'Hub Hóa học lớp 12',
        description: 'Kết nối phương pháp với các chuyên đề vô cơ, hữu cơ và điện hóa.',
        href: '/subjects/hoa-hoc/grade-12',
        label: 'Học Hóa học',
      },
    ],
    relatedArticleSlugs: [
      'dao-ham-va-bang-bien-thien-hoc-theo-moi-lien-he',
      'doc-de-vat-ly-tach-du-kien-va-chon-mo-hinh',
      'cach-hoc-lai-kien-thuc-nen-khi-dang-mat-goc',
    ],
  },
  {
    slug: 'on-thi-theo-chuyen-de-hay-luyen-de-tong-hop-truoc',
    title: 'Ôn thi theo chuyên đề hay luyện đề tổng hợp trước?',
    excerpt:
      'Cách chọn đúng chế độ ôn dựa trên mức nền, độ ổn định và số tuần còn lại thay vì chạy theo lịch của người khác.',
    categorySlug: 'luyen-thi-thpt-quoc-gia',
    subject: 'Liên môn',
    tags: ['Ôn chuyên đề', 'Luyện đề', 'THPT Quốc gia'],
    collectionSlugs: ['quan-ly-thoi-gian', 'xay-nen-tang'],
    coverImage: '/assets/blog/luyen-thi-thpt.svg',
    coverAlt: 'Hai lộ trình chuyên đề và đề tổng hợp hội tụ về mục tiêu kỳ thi',
    publishedAt: '2026-05-16T08:00:00+07:00',
    readingTimeMinutes: 6,
    author: BLOG_AUTHOR,
    status: 'published',
    seoTitle: 'Nên ôn theo chuyên đề hay luyện đề tổng hợp trước?',
    seoDescription:
      'Khung quyết định khi nào nên học theo chuyên đề, khi nào chuyển sang đề tổng hợp trong quá trình ôn thi THPT.',
    keyTakeaways: [
      'Nền chưa chắc thì đề tổng hợp chỉ giúp phát hiện lỗi, chưa đủ để sửa lỗi.',
      'Chuyển dần sang đề khi các chuyên đề cơ bản đã ổn định.',
      'Duy trì một phần thời gian chữa lỗ hổng ngay cả giai đoạn luyện đề.',
    ],
    sections: [
      {
        id: 'hai-che-do',
        title: 'Hai chế độ giải quyết hai vấn đề khác nhau',
        blocks: [
          {
            type: 'paragraph',
            text: 'Ôn chuyên đề giúp em xây và sửa một nhóm kỹ năng có liên quan. Đề tổng hợp giúp em luyện chuyển ngữ cảnh, phân bổ thời gian và đo độ ổn định trên toàn bài.',
          },
        ],
      },
      {
        id: 'khung-quyet-dinh',
        title: 'Khung quyết định nhanh',
        blocks: [
          {
            type: 'table',
            caption: 'Chọn trọng tâm theo tình trạng hiện tại',
            headers: ['Tình trạng', 'Trọng tâm phù hợp'],
            rows: [
              ['Sai nhiều câu cơ bản cùng một chủ đề', 'Ưu tiên học và luyện theo chuyên đề'],
              [
                'Đúng khi luyện riêng nhưng sai khi trộn đề',
                'Tăng bài tập hỗn hợp và đề từng phần',
              ],
              ['Kiến thức khá ổn, thường thiếu thời gian', 'Ưu tiên đề tổng hợp có bấm giờ'],
              [
                'Điểm dao động mạnh giữa các đề',
                'Phân tích lỗi rồi quay lại chuyên đề gây dao động',
              ],
            ],
          },
        ],
      },
      {
        id: 'ty-le-linh-hoat',
        title: 'Dùng tỷ lệ linh hoạt theo tuần',
        blocks: [
          {
            type: 'paragraph',
            text: 'Không cần chọn một bên tuyệt đối. Mỗi tuần, em có thể dành phần lớn thời lượng cho ưu tiên chính và giữ một phần nhỏ cho chế độ còn lại. Tỷ lệ thay đổi khi dữ liệu từ bài kiểm tra cho thấy nền đã ổn hơn.',
          },
        ],
      },
    ],
    learningLinks: [
      {
        title: 'Bộ đề theo chương và theo kỳ',
        description: 'Chọn đề chuyên đề hoặc đề tổng hợp theo đúng giai đoạn.',
        href: '/exam-sets',
        label: 'Khám phá bộ đề',
      },
    ],
    relatedArticleSlugs: [
      'cach-phan-bo-thoi-gian-khi-lam-de-thi-thpt-quoc-gia',
      'lap-ke-hoach-hoc-12-tuan-khong-bi-qua-tai',
      'dat-muc-tieu-8-cong-theo-nang-luc-hien-tai',
    ],
  },
  {
    slug: 'dat-muc-tieu-8-cong-theo-nang-luc-hien-tai',
    title: 'Đặt mục tiêu 8+ theo năng lực hiện tại',
    excerpt:
      'Chuyển mục tiêu điểm số thành các nhóm câu cần giữ chắc, phần cần bù và mốc kiểm tra có thể theo dõi.',
    categorySlug: 'dinh-huong-muc-tieu',
    subject: 'Liên môn',
    tags: ['Mục tiêu 8+', 'Tự đánh giá', 'Ưu tiên'],
    collectionSlugs: ['muc-tieu-8-cong'],
    coverImage: '/assets/blog/dinh-huong-muc-tieu.svg',
    coverAlt: 'Các cột mốc học tập dẫn đến mục tiêu 8 điểm trở lên',
    publishedAt: '2026-05-02T08:00:00+07:00',
    readingTimeMinutes: 6,
    author: BLOG_AUTHOR,
    status: 'published',
    seoTitle: 'Cách đặt mục tiêu 8+ theo năng lực hiện tại',
    seoDescription:
      'Cách phân tích điểm xuất phát và biến mục tiêu 8+ thành nhóm kiến thức, loại lỗi và mốc kiểm tra cụ thể.',
    keyTakeaways: [
      'Mục tiêu tốt bắt đầu từ dữ liệu ba bài gần nhất.',
      'Bảo vệ nhóm điểm cơ bản trước khi đầu tư nhiều vào câu khó.',
      'Theo dõi độ ổn định, không chỉ điểm cao nhất từng đạt.',
    ],
    sections: [
      {
        id: 'do-diem-xuat-phat',
        title: 'Đo điểm xuất phát bằng ba bài gần nhất',
        blocks: [
          {
            type: 'paragraph',
            text: 'Một bài duy nhất có thể quá dễ, quá khó hoặc rơi đúng phần em vừa học. Ba bài có cấu trúc tương đương cho bức tranh tốt hơn về điểm trung vị, độ dao động và nhóm lỗi lặp lại.',
          },
        ],
      },
      {
        id: 'chia-muc-tieu',
        title: 'Chia mục tiêu thành ba nhóm điểm',
        blocks: [
          {
            type: 'list',
            items: [
              'Điểm cần giữ: câu em đã làm đúng ổn định và không được để rơi vì cẩu thả.',
              'Điểm cần bù: câu vừa sức nhưng đang sai do một lỗ hổng rõ ràng.',
              'Điểm mở rộng: câu cần nhiều bước hoặc kiến thức phân loại, chỉ đầu tư sau hai nhóm trên.',
            ],
          },
          {
            type: 'callout',
            title: 'Nguyên tắc ưu tiên',
            text: 'Một câu cơ bản thường sai có giá trị ưu tiên cao hơn một câu khó thỉnh thoảng làm đúng.',
            tone: 'info',
          },
        ],
      },
      {
        id: 'moc-kiem-tra',
        title: 'Đặt mốc kiểm tra có ý nghĩa',
        blocks: [
          {
            type: 'paragraph',
            text: 'Mỗi hai tuần, kiểm tra cùng loại đầu ra: độ chính xác theo nhóm câu, thời gian hoàn thành và số lỗi cẩu thả. Khi nhóm điểm cần giữ ổn định, em mới chuyển thêm thời lượng sang điểm mở rộng.',
          },
        ],
      },
    ],
    learningLinks: [
      {
        title: 'Khảo sát bằng bộ đề',
        description: 'Chọn bộ đề phù hợp để xác định điểm xuất phát và nhóm lỗi.',
        href: '/exam-sets',
        label: 'Chọn bộ đề',
      },
      {
        title: 'Xây lộ trình học',
        description: 'Bắt đầu thiết lập trải nghiệm học cá nhân hóa của Tú Tài.',
        href: '/auth/register',
        label: 'Bắt đầu miễn phí',
      },
    ],
    relatedArticleSlugs: [
      'muc-tieu-9-cong-va-cach-xu-ly-cau-phan-loai',
      'lap-ke-hoach-hoc-12-tuan-khong-bi-qua-tai',
      'on-thi-theo-chuyen-de-hay-luyen-de-tong-hop-truoc',
    ],
  },
  {
    slug: 'muc-tieu-9-cong-va-cach-xu-ly-cau-phan-loai',
    title: 'Mục tiêu 9+: khác biệt nằm ở cách xử lý câu phân loại',
    excerpt:
      'Không phải làm thật nhiều câu khó: em cần nhận dạng nhánh kiến thức, chọn câu đáng đầu tư và chữa sâu từng bước tắc.',
    categorySlug: 'dinh-huong-muc-tieu',
    subject: 'Toán',
    tags: ['Mục tiêu 9+', 'Câu phân loại', 'Toán'],
    collectionSlugs: ['muc-tieu-8-cong', 'tranh-mat-diem'],
    coverImage: '/assets/blog/dinh-huong-muc-tieu.svg',
    coverAlt: 'Mục tiêu 9 điểm với các nhánh lựa chọn câu phân loại',
    publishedAt: '2026-04-18T08:00:00+07:00',
    readingTimeMinutes: 7,
    author: BLOG_AUTHOR,
    status: 'published',
    seoTitle: 'Mục tiêu 9+: cách học và xử lý câu phân loại',
    seoDescription:
      'Chiến lược dành cho mục tiêu 9+: giữ chắc phần nền, chọn câu phân loại phù hợp và chữa bài theo bước tắc.',
    keyTakeaways: [
      'Điểm 9+ vẫn bắt đầu từ việc gần như không rơi điểm ở phần cơ bản.',
      'Phân loại câu khó theo nhánh kiến thức và mức gần với năng lực.',
      'Chữa bài bằng cách xác định bước tắc đầu tiên, không chỉ chép lời giải.',
    ],
    sections: [
      {
        id: 'nen-truoc-phan-loai',
        title: 'Bảo vệ nền trước khi mở rộng',
        blocks: [
          {
            type: 'paragraph',
            text: 'Nếu phần cơ bản còn dao động, thêm nhiều câu phân loại có thể làm lịch học nặng hơn nhưng điểm không ổn định hơn. Hãy đặt ngưỡng độ chính xác cho nhóm câu cần giữ trước.',
          },
        ],
      },
      {
        id: 'chon-cau-kho',
        title: 'Chọn câu khó đáng đầu tư',
        blocks: [
          {
            type: 'list',
            ordered: true,
            items: [
              'Nhóm câu theo chuyên đề và thao tác cốt lõi.',
              'Đánh dấu bước đầu tiên em không tự nghĩ ra.',
              'Ưu tiên nhóm có khoảng cách nhỏ nhất với kiến thức hiện tại.',
              'Luyện biến thể sau khi có thể giải thích lại lời giải mà không nhìn mẫu.',
            ],
          },
        ],
      },
      {
        id: 'nhat-ky-buoc-tac',
        title: 'Lập nhật ký “bước tắc”',
        blocks: [
          {
            type: 'paragraph',
            text: 'Mỗi câu khó chỉ ghi một dòng: dấu hiệu nhận dạng, bước tắc đầu tiên và ý tưởng mở khóa. Sau vài tuần, nhật ký cho thấy em thiếu một kỹ thuật lặp lại hay chỉ thiếu trải nghiệm với một dạng cụ thể.',
          },
          {
            type: 'quote',
            text: 'Câu phân loại trở nên hữu ích khi em biết chính xác nó đang rèn quyết định nào.',
          },
        ],
      },
    ],
    learningLinks: [
      {
        title: 'Bộ đề Toán tuyển chọn',
        description: 'Luyện có chọn lọc sau khi phần nền đã ổn định.',
        href: '/exam-sets/toan-chuong-dao-ham-tuyen-chon',
        label: 'Xem bộ đề',
      },
      {
        title: 'Hub Toán lớp 12',
        description: 'Quay lại mối liên hệ kiến thức khi nhật ký cho thấy lỗ hổng nền.',
        href: '/subjects/toan/grade-12',
        label: 'Học theo chủ đề',
      },
    ],
    relatedArticleSlugs: [
      'dat-muc-tieu-8-cong-theo-nang-luc-hien-tai',
      'dao-ham-va-bang-bien-thien-hoc-theo-moi-lien-he',
      'nam-buoc-kiem-tra-loi-giai-de-tranh-mat-diem-oan',
    ],
  },
];

export const PUBLISHED_BLOG_ARTICLES = BLOG_ARTICLES.filter(
  (article) => article.status === 'published'
).sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));

export function getBlogCategory(slug: string) {
  return BLOG_CATEGORIES.find((category) => category.slug === slug);
}

export function getBlogArticle(slug: string) {
  return PUBLISHED_BLOG_ARTICLES.find((article) => article.slug === slug);
}

export function getArticlesByCategory(slug: BlogCategorySlug) {
  return PUBLISHED_BLOG_ARTICLES.filter((article) => article.categorySlug === slug);
}

export function getRelatedArticles(article: BlogArticle, limit = 3) {
  const explicitlyRelated = article.relatedArticleSlugs
    .map((slug) => getBlogArticle(slug))
    .filter((candidate): candidate is BlogArticle => Boolean(candidate));

  const fallback = PUBLISHED_BLOG_ARTICLES.filter(
    (candidate) =>
      candidate.slug !== article.slug &&
      !explicitlyRelated.some((related) => related.slug === candidate.slug) &&
      candidate.categorySlug === article.categorySlug
  );

  return [...explicitlyRelated, ...fallback].slice(0, limit);
}

export function formatBlogDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(value));
}

export function getArticleModifiedAt(article: BlogArticle) {
  return article.updatedAt ?? article.publishedAt;
}
