# Tách Học và Luyện tập

Phản hồi sau PR #42: học sinh không rõ đâu là phần học, đâu là phần luyện tập, vì có quá nhiều điều hướng và nhiều chi tiết dư (banner "Toán 12 · Mục tiêu 8 điểm · 0/1 bài đã xong", câu trích dẫn). Hướng đã chọn: **tách hẳn**. Trang Học chỉ để đọc bài. Mọi việc làm bài (kết quả, làm tiếp, xem câu sai, làm lại) chỉ nằm ở Luyện tập.

## Đã đổi

| Chỗ | Trước | Sau |
| --- | --- | --- |
| Menu | 3 nhóm có tiêu đề ("Hành trình học", "Luyện thêm", "Thi đấu"), dòng mô tả dưới mỗi mục, đường kẻ trang trí | Một danh sách: Học, Luyện tập, Luyện thi, rồi một vạch ngăn, Thứ hạng, Đấu trường. Không mô tả, không tiêu đề nhóm |
| Tên trang | "Lộ trình" | "Học" (đường dẫn vẫn là `/student/roadmap`, link cũ không hỏng) |
| Đầu trang Học | Banner tối: tên môn, mục tiêu điểm, "x/y bài đã xong", thanh tiến độ, tab môn | Bỏ banner. Chỉ còn nút chọn môn (khi có hơn một môn) |
| Thẻ bài tiếp theo | Có thể là "Làm tiếp luyện tập", "Luyện tập lại", "Làm thử", kèm "Xem lại bài học" và kết quả luyện tập | Luôn là bài cần **đọc** tiếp: bài đang đọc dở (ưu tiên bài mở gần nhất), nếu không có thì bài chưa học đầu tiên. Một nút: "Học tiếp" hoặc "Bắt đầu học". Đọc hết thì hiện "Em đã học hết các bài đang mở" và nút "Sang Luyện tập" |
| Danh sách bài | Trạng thái trộn đọc và luyện ("Đã học · luyện tập 2/10, chưa đạt") | Chỉ trạng thái đọc: Chưa học / Đã mở xem / Đang học · phần x/y / Đã học. Chương ghi "x/y đã học" |
| Câu trích dẫn mỗi ngày | Có | Bỏ |
| Luyện tập | Bài chưa có câu hỏi có nút "Học bài" | Chỉ ghi "Chưa có câu hỏi" (đọc bài ở trang Học) |
| Nút quay lại trong bài học, bài luyện | "Hành trình Toán 12", "Về lộ trình", "Xem lộ trình của em" | "Học Toán 12", "Về trang Học" |

Không đổi: cách chấm điểm, ngưỡng đạt 80%, quyền Plus, quyền Admin, cách lưu tiến độ (đọc bài lưu trong trình duyệt, kết quả luyện tập lưu trong cơ sở dữ liệu). Trang Học không còn gọi kết quả luyện tập từ máy chủ.

## Số đo (cùng dữ liệu QA, trước → sau)

| | 1440 | 768 | 390 |
| --- | --- | --- | --- |
| Chiều cao trang Học (px) | 900 → 900 | 1196–1236 → 1024 | 1308–1416 → 948–978 |
| Số chữ trong trang Học | 121–139 → 97–107 | như 1440 | như 1440 |
| Số chữ trong menu | 30 → 9 | 21 → 5 | 21 → 5 |
| Nút luyện tập trên trang Học | 0–1 → 0 | 0–1 → 0 | 0–1 → 0 |

Ảnh trước/sau: `anh/truoc/<cỡ>/` và `anh/sau/<cỡ>/`, các trạng thái học sinh mới, đang học dở, đã học hai bài.

## Kiểm tra

- E2E Admin → học sinh trên cơ sở dữ liệu QA cục bộ (không đụng Production): **131/131 đạt ở cả 1440, 768 và 390**. Ngoài 123 kiểm tra cũ của Luyện tập, có 8 kiểm tra mới cho trang Học: một tiêu đề "Học"; không có link luyện tập trong trang; không banner mục tiêu, thanh tiến độ hay câu trích dẫn; không có chữ "luyện tập / làm tiếp / câu sai / làm thử"; nút bài tiếp theo là "Bắt đầu học" hoặc "Học tiếp" và mở đúng bài; menu đúng 5 mục, không mô tả.
- Unit test: thêm 5 test cho `nextLessonToRead`, `readingLabel`, `readingProgress`. `tsc` sạch, ESLint sạch trên các file đã sửa, `next build` thành công.
- Vitest toàn bộ: 5 test lỗi có sẵn trên master, không liên quan (4 ở `features/roadmap/lib`, 1 ở `student-experience-service` phụ thuộc ngày).

## Cần biết

- Trang Học không còn gợi ý "Làm thử" cho học sinh có điểm hiện tại từ 6,5 (CHECK_FIRST). Học sinh khá vào thẳng Luyện tập. Hàm `pickNextStep` vẫn còn và vẫn dùng ở cuối bài học và cuối bài luyện.
- Trang Học dựa vào tiến độ đọc lưu trong trình duyệt, nên đổi máy thì trạng thái đọc bắt đầu lại (như trước).
