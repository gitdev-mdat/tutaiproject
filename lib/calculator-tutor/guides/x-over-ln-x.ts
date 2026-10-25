import { MODEL } from '../fx570vn-plus';
import type { SolutionGuide } from '../types';

/**
 * Toán 12 · Tính đơn điệu · math_book_3, Câu 1 (đề tr. 19, lời giải tr. 29):
 * y = x / ln x. The pilot guide. Every key sequence and screen below is
 * replayed by `guides.test.ts` against the simulation, and every table value is
 * checked against x / ln x computed independently.
 */
export const X_OVER_LN_X: SolutionGuide = {
  id: 'math12-monotonic-x-over-ln-x',
  match: {
    // Production: Q-MAT-TPG9WI.
    questionIds: ['q-b48ea52f-2c80-41f8-9740-852bbad40ed5'],
    textbook: {
      documentTitle: 'math_book_3',
      questionNumber: '1',
      stemIncludes: 'y = \\frac{x}{\\ln x}',
    },
  },
  derivative: {
    title: 'Cách 1: Giải bằng đạo hàm',
    lines: [
      {
        text: 'Tập xác định: cần $x > 0$ để $\\ln x$ có nghĩa và $\\ln x \\ne 0$ (tức $x \\ne 1$) để mẫu khác 0, nên $D = (0; +\\infty) \\setminus \\{1\\}$.',
      },
      {
        text: "Đạo hàm: $y' = \\frac{1 \\cdot \\ln x - x \\cdot \\frac{1}{x}}{(\\ln x)^2} = \\frac{\\ln x - 1}{(\\ln x)^2}$.",
      },
      {
        text: "$y' = 0 \\Leftrightarrow \\ln x = 1 \\Leftrightarrow x = e$. Mẫu $(\\ln x)^2 > 0$ trên $D$, nên dấu của $y'$ là dấu của $\\ln x - 1$.",
      },
      {
        text: "Trên $(0; 1)$ và $(1; e)$: $\\ln x < 1$ nên $y' < 0$. Trên $(e; +\\infty)$: $\\ln x > 1$ nên $y' > 0$.",
      },
      {
        text: 'Hàm số nghịch biến trên $(0; 1)$ và $(1; e)$, đồng biến trên $(e; +\\infty)$. Chọn D.',
        emphasis: true,
      },
      {
        text: 'Lưu ý: không viết "nghịch biến trên $(0; e)$" vì $x = 1$ không thuộc tập xác định; đó là lý do phương án B sai.',
      },
    ],
    signTable: {
      breaks: ['0', '1', 'e', '+\\infty'],
      marks: ['‖', '‖', '0', ''],
      signs: ['−', '−', '+'],
      trend: ['↘', '↘', '↗'],
    },
  },
  calculator: {
    id: 'fx570vnplus-table-x-over-ln-x',
    model: MODEL,
    functionLatex: '$f(x) = \\frac{x}{\\ln x}$',
    domainLatex: '$D = (0; 1) \\cup (1; +\\infty)$',
    objective:
      'Lập bảng giá trị của $f(x) = \\frac{x}{\\ln x}$ trên từng khoảng của tập xác định, rồi đối chiếu với kết quả của Cách 1.',
    steps: [
      {
        id: 'open-table',
        title: 'Mở chế độ TABLE',
        instruction: 'Bấm MODE, rồi bấm 7 để chọn TABLE.',
        keys: ['MODE', '7'],
        explanation:
          'Trên fx-570VN PLUS, TABLE là mục số 7 trong menu MODE. Máy khác (ví dụ fx-580VN X) mở bảng bằng phím và menu khác.',
        hint: 'MODE nằm ở hàng trên cùng, bên phải.',
        expect: { screen: 'F', text: 'f(X)=' },
      },
      {
        id: 'enter-function',
        title: 'Nhập hàm số',
        instruction: 'Nhập X ÷ ln(X): ALPHA ) để có X, phím ÷, phím ln, rồi ALPHA ) và đóng ngoặc.',
        keys: ['ALPHA', 'RPAREN', 'DIVIDE', 'LN', 'ALPHA', 'RPAREN', 'RPAREN'],
        explanation:
          'Biến X nằm ở chữ đỏ trên phím ")", nên cần ALPHA trước. Phím ln tự mở ngoặc "ln(". Viết X÷ln(X) cho cùng giá trị với $\\frac{x}{\\ln x}$.',
        hint: 'X là chữ đỏ trên phím ")": bấm ALPHA rồi ")".',
        expect: { screen: 'F', text: 'f(X)=X÷ln(X)' },
      },
      {
        id: 'skip-g',
        title: 'Bỏ qua g(X)',
        instruction: 'Bấm = để xác nhận f(X), rồi bấm = lần nữa để bỏ trống g(X).',
        keys: ['EQ', 'EQ'],
        explanation:
          'Cài đặt gốc của máy là "f(x),g(x)" nên máy hỏi thêm g(X). Bài này chỉ cần f(X), bấm = để bỏ qua. Đây là lý do sách viết "Ấn 2 lần =".',
        hint: 'Nếu máy em đã đặt chỉ dùng f(x), máy sẽ không hỏi g(X): chỉ cần bấm = một lần.',
        expect: { screen: 'START', text: 'Start? 1' },
      },
      {
        id: 'excluded-points',
        title: 'Thử một khoảng chứa điểm bị loại',
        instruction: 'Nhập Start = 0, End = 2, Step = 0.5, rồi bấm ▼ hai lần để xuống dòng X = 1.',
        keys: ['0', 'EQ', '2', 'EQ', '0', 'DOT', '5', 'EQ', 'DOWN', 'DOWN'],
        explanation:
          'Sách gợi ý bắt đầu từ $x = 0$. Hãy xem máy xử lý thế nào: $x = 0$ làm $\\ln x$ không xác định, $x = 1$ làm mẫu $\\ln x = 0$.',
        checkpoint: {
          tone: 'warning',
          title: 'ERROR không phải là một giá trị',
          body: 'Dòng $X = 0$ và $X = 1$ hiện ERROR vì hai điểm này không thuộc tập xác định. Khi đọc bảng, phải bỏ các dòng này và xét riêng từng khoảng $(0; 1)$ và $(1; +\\infty)$.',
        },
        expect: { screen: 'TABLE', text: 'TABLE 5 dòng; X=1 F(X)=ERROR' },
      },
      {
        id: 'range-0-1',
        title: 'Lập bảng trên khoảng (0; 1)',
        instruction: 'Bấm AC, = , = rồi nhập Start = 0.1, End = 0.9, Step = 0.1.',
        keys: [
          'AC',
          'EQ',
          'EQ',
          '0',
          'DOT',
          '1',
          'EQ',
          '0',
          'DOT',
          '9',
          'EQ',
          '0',
          'DOT',
          '1',
          'EQ',
        ],
        explanation:
          'AC quay về hàm số đã nhập (máy vẫn giữ X÷ln(X)). Chọn các giá trị nằm hẳn trong $(0; 1)$: từ 0.1 đến 0.9, mỗi bước 0.1, được 9 dòng.',
        hint: 'Sau AC, bấm = hai lần để đi qua f(X) và g(X) đến Start?.',
        expect: { screen: 'TABLE', text: 'TABLE 9 dòng; X=0.1 F(X)=-0.04342944819' },
      },
      {
        id: 'read-0-1',
        title: 'Đọc bảng trên (0; 1)',
        instruction: 'Bấm ▼ để xem lần lượt các dòng đến X = 0.9.',
        keys: ['DOWN', 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'DOWN'],
        explanation:
          'Theo dõi cột F(X): khi X tăng từ 0.1 đến 0.9, F(X) đi từ khoảng −0.043 xuống khoảng −8.542.',
        checkpoint: {
          tone: 'observe',
          title: 'Quan sát: F(X) giảm dần',
          body: "Các giá trị lấy mẫu giảm liên tục, khớp với $y' < 0$ trên $(0; 1)$ ở Cách 1. Đây là quan sát trên 9 điểm, chưa phải chứng minh.",
        },
        expect: { screen: 'TABLE', text: 'TABLE 9 dòng; X=0.9 F(X)=-8.542099423' },
      },
      {
        id: 'range-1-4',
        title: 'Lập bảng trên khoảng (1; 4)',
        instruction: 'Bấm AC, = , = rồi nhập Start = 1.2, End = 4, Step = 0.2.',
        keys: ['AC', 'EQ', 'EQ', '1', 'DOT', '2', 'EQ', '4', 'EQ', '0', 'DOT', '2', 'EQ'],
        explanation:
          'Khoảng thứ hai của tập xác định là $(1; +\\infty)$. Bắt đầu từ 1.2 (bỏ qua $x = 1$) và đi quá $e \\approx 2.718$ đến 4 để thấy cả hai phía của $x = e$. Được 15 dòng, dưới giới hạn 30 dòng của máy.',
        expect: { screen: 'TABLE', text: 'TABLE 15 dòng; X=1.2 F(X)=6.581777937' },
      },
      {
        id: 'read-1-4',
        title: 'Đọc bảng trên (1; 4)',
        instruction: 'Bấm ▼ để đi xuống đến X = 3 và theo dõi cột F(X).',
        keys: ['DOWN', 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'DOWN'],
        explanation:
          'F(X) giảm từ 6.58 xuống nhỏ nhất khoảng 2.7194 tại $X = 2.8$, rồi tăng lại: 2.7307 tại $X = 3$. Giá trị nhỏ nhất nằm gần $x = e$, nơi $f(e) = e \\approx 2.718$.',
        checkpoint: {
          tone: 'observe',
          title: 'Quan sát: giảm rồi tăng quanh x = e',
          body: "Khớp với Cách 1: $y' < 0$ trên $(1; e)$, $y' > 0$ trên $(e; +\\infty)$. Bảng chỉ cho thấy đổi chiều ở đâu đó giữa 2.6 và 3; chính đạo hàm mới chỉ ra đúng $x = e$.",
        },
        expect: { screen: 'TABLE', text: 'TABLE 15 dòng; X=3 F(X)=2.73071768' },
      },
    ],
    conclusion: [
      'Bảng giá trị giúp dự đoán và kiểm tra nhanh: loại A (hàm không đồng biến trên $(0; 1)$), loại C (hàm còn giảm ngay sau $x = 1$), và cho thấy chiều biến thiên đổi gần $x = e$.',
      "Bảng chỉ tính tại một số điểm, nên không phải là chứng minh. Kết luận chặt chẽ dựa vào dấu của $y'$ ở Cách 1.",
      'Luôn xét riêng từng khoảng của tập xác định; dòng ERROR không phải giá trị của hàm số.',
    ],
    references: [
      {
        label: 'CASIO fx-570VN PLUS: Hướng dẫn sử dụng (TABLE, cài đặt f(x),g(x))',
        url: 'https://support.casio.com/storage/vi/manual/pdf/VI/004/fx-570VNPLUS_VI.pdf',
      },
      {
        label: 'CASIO fx-570ES PLUS: Calculation modes, Creating a number table',
        url: 'https://support.casio.com/global/en/calc/manual/fx-570ESPLUS_991ESPLUS_en/using_calculation_modes/creating_number.html',
      },
    ],
  },
  source: {
    label: 'Lời giải gốc đã nhập (sách tr. 29, giữ nguyên văn)',
    notes: [
      {
        tone: 'error',
        when: 'rac{\\infty}{\\infty}',
        text: 'Bản nhập tự động ghi sai tập xác định thành "$(0; +\\frac{\\infty}{\\infty})$" (có ký tự điều khiển lẫn vào). Sách in đúng là $D = (0; +\\infty) \\setminus \\{1\\}$.',
      },
      {
        tone: 'error',
        text: 'Sách cho Start = 0, nhưng $x = 0$ không thuộc tập xác định: máy hiện ERROR ở dòng này, không phải một giá trị của hàm số.',
      },
      {
        tone: 'error',
        text: 'Sách ghi "End: SHIFT ×10ˣ (chính là e)". Trên phím ×10ˣ của dòng máy này, chữ vàng (SHIFT) là π ≈ 3.14 và chữ đỏ (ALPHA) là e, như chính hình phím in trong sách. Muốn End = e phải bấm ALPHA ×10ˣ. Hướng dẫn mới dùng End = 4 để thấy cả hai phía của $x = e$.',
      },
      {
        tone: 'caution',
        text: 'Bảng của sách chạy từ 0 đến e qua cả $x = 1$ và dừng trước khi hàm bắt đầu tăng, nên không cho thấy hàm đồng biến trên $(e; +\\infty)$. Kết luận "giảm trên $(0; 1)$" từ vài giá trị mẫu chỉ là dự đoán.',
      },
      {
        tone: 'missing',
        text: 'Bốn ảnh màn hình máy tính trong sách không được nhập, nên các câu "máy hiện như sau:" trong bản gốc không có hình đi kèm.',
      },
      {
        tone: 'caution',
        when: 'Cách 2',
        text: 'Bản gốc chỉ có tiêu đề "Cách 2"; tiêu đề "Cách 1: Cách tư duy" của sách bị mất khi nhập, nên hai cách bị trộn thành một đoạn.',
      },
    ],
  },
  verification: {
    status: 'VERIFIED',
    by: 'Tú Tài (pilot, chờ chủ sản phẩm duyệt trong PR)',
    on: '2026-10-25',
    checks: [
      'Đối chiếu đề và lời giải với ảnh trang 19 và 29 của sách.',
      'Thứ tự phím phát lại trên bản mô phỏng; màn hình sau mỗi bước khớp kết quả kiểm thử.',
      'Mọi giá trị trong bảng so với x / ln x tính độc lập; các ô của bảng khớp những ô in trong sách (−0.124, −0.436, −1.174, −3.585, 6.5817, 4.1608, 2.7902).',
      'MODE 7 = TABLE, cài đặt mặc định f(x),g(x), Start/End/Step mặc định 1/5/1, tối đa 30 dòng: theo hướng dẫn sử dụng chính thức của CASIO.',
    ],
  },
};
