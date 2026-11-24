# Trang Luyện tập: bỏ phần lặp, nói rõ kết quả và việc cần làm

Trang: `/student/practice`. Mọi ảnh và số đo chụp trên server QA cục bộ (Postgres riêng `pp_qa`, `pp_empty`, dữ liệu kiểm thử). Không đọc hay ghi gì trên Production.

## A. Audit

### Vấn đề đã kiểm chứng

| # | Vấn đề | Nguyên nhân | Ảnh hưởng tới học sinh |
| --- | --- | --- | --- |
| 1 | Tên trang lặp 3 lần: thanh bên "Luyện tập", dòng "TOÁN 12 · LUYỆN TẬP", tiêu đề lớn "Luyện tập" | Đầu trang được làm như trang đích, không tính tới thanh bên | Mất khoảng 190 px đầu màn hình trước khi tới bài đầu tiên |
| 2 | Một đoạn mô tả luyện tập là gì, một đoạn quảng cáo Plus, một đoạn giải thích chương chưa có bộ ôn | Dùng chữ để bù cho giao diện | Học sinh đọc lại điều đã biết; 255 chữ trên trang của một học sinh mới |
| 3 | "Đã đạt 0/4 bài" (cả môn) và "Đạt 0/3 bài" (từng chương) gần như trùng nhau, nhất là khi chỉ có 1 chương | Hai bộ đếm làm cùng một việc | Nhìn hai số mà không biết khác nhau ở đâu |
| 4 | Ghi chú Admin là một thẻ lớn 3 dòng nằm giữa trang | Thẻ dùng chung với trang Luyện thi | Admin kiểm tra trang học sinh nhưng thấy một bố cục khác với học sinh |
| 5 | "10 câu", "tốt nhất 2/10", "Sửa 6 câu sai" đứng cạnh nhau | Ba số đến từ ba nguồn: 10 là số câu của một lượt mới, 2/10 là lượt cả bài tốt nhất, 6 là số câu còn sai của **lượt gần nhất**, mà lượt đó là lượt sửa 8 câu sai (đúng 2). Số liệu đúng, cách nói không cho biết điều đó | Học sinh tưởng hệ thống tính sai (10 − 2 = 8, sao lại 6?) |
| 6 | **Lỗi:** lượt sửa câu sai đạt từ 80% (ví dụ đúng 7/8) thì trang không còn mời sửa câu sai, mà hiện "Luyện lại" | Điều kiện dùng `passed` của **lượt sửa**, trong khi bài vẫn chưa đạt và vẫn còn 1 câu sai. Trang kết quả lại mời "Luyện lại 1 câu sai", hai nơi nói khác nhau | Học sinh mất đường tới câu còn sai |
| 7 | Hai cách đếm tiến độ cho cùng một lượt đang làm: ô "Em đang làm dở" ghi "3/10 câu", dòng của bài ghi "Đang làm · câu 4/10" | Một bên đếm câu đã làm, một bên đếm câu sắp làm | Hai số khác nhau cho cùng một việc |
| 8 | Không có chỗ nào nói phải đúng bao nhiêu câu mới đạt | Ngưỡng 80% chỉ có trong code | "Chưa đạt" mà không biết còn cách bao xa |
| 9 | "Sửa 6 câu sai" thật ra mở trang kết quả của lượt cũ, chưa bắt đầu sửa ngay | Nhãn mô tả việc sau 2 bước | Bấm xong thấy trang khác với nhãn |
| 10 | Thẻ Tổng hợp (Plus) lớn nằm trong danh sách "Theo bài", lặp lại tên chương | Cùng một thẻ cho hai chế độ xem | Trang theo bài dài thêm 280 px; học sinh miễn phí thấy thẻ khoá ngay giữa các bài |

Số liệu ở mục 5 khớp với dữ liệu thật: ảnh "trước" chụp tài khoản QA làm cả bài đúng 2/10, rồi sửa 8 câu sai đúng 2, và trang hiện đúng "tốt nhất 2/10 · Sửa 6 câu sai" như ảnh chủ sản phẩm gửi. Lịch sử lượt làm được kiểm tra trực tiếp trong DB.

### Quyết định

- **Đầu trang:** bỏ dòng "TOÁN 12 · LUYỆN TẬP", tiêu đề lớn và đoạn mô tả. Trên máy tính, thanh bên đã cho biết đang ở Luyện tập, nên `h1` chỉ còn cho trình đọc màn hình. Trên điện thoại và tablet (thanh bên ẩn), "Luyện tập" hiện nhỏ cạnh nút menu.
- **Môn học:** giữ nút chọn môn vì nó dùng để đổi môn, nhưng chỉ hiện khi có từ 2 môn. Tên chương đã đủ cho biết đang ở môn nào.
- **Theo bài / Theo chương:** giữ hai chế độ, thu gọn thành một công tắc nhỏ cùng hàng với nút môn. Bỏ dòng phụ "Củng cố từng bài", "Ôn và tổng hợp".
- **Tiến độ:** bỏ "Đã đạt x/y bài" của cả môn. Mỗi chương còn một chữ "0/3 bài đạt".
- **Mỗi bài một dòng trạng thái**, dùng chung một bộ từ:
  - chưa làm: `10 câu`
  - đang làm: `Đang làm · 3/10 câu` (giống ô làm tiếp)
  - chưa đạt: `Cao nhất 2/10 · cần 8 để đạt`
  - đã đạt: `Đạt · 9/10`
  - chưa có câu: `Chưa có câu hỏi`
- **Mỗi bài một nút**, nhãn nói đúng điều xảy ra sau khi bấm: `Bắt đầu`, `Làm tiếp`, `Xem 4 câu sai` (sau lượt cả bài), `Xem 6 câu còn sai` (sau lượt sửa câu sai), `Luyện lại`, `Học bài`. Bỏ thang độ khó trên dòng bài.
- **Một việc chính:** chỉ một nút được tô màu trên trang. Nếu có lượt làm dở, đó là `Làm tiếp` trong ô ở đầu trang. Nếu không có, đó là nút của bài đầu tiên (theo thứ tự chương trình) có câu luyện tập mà chưa đạt.
- **Ôn chương và Tổng hợp** chỉ nằm ở "Theo chương". Thẻ bỏ dòng tên chương lặp và câu mô tả, giữ các con số thật (số câu, số bài nối, câu nâng cao, câu chọn lọc, độ khó). Học sinh miễn phí vẫn thấy thẻ Tổng hợp khoá, ghi "Cần Tú Tài Plus", và vẫn xem được bộ gồm gì.
- **Admin:** ghi chú thành một dòng viền đứt ở trên danh sách, gồm: lý do Tổng hợp mở, số chương có Tổng hợp / Ôn chương, và link "Nội dung còn thiếu". Học sinh thường và học sinh Plus không bao giờ thấy dòng này (server quyết định qua `previewAsAdmin`).
- **Sửa lỗi #6:** mời xem câu còn sai khi **bài chưa đạt** và lượt gần nhất còn câu sai, không phụ thuộc lượt sửa đó được bao nhiêu phần trăm.

Không thay đổi cách chấm, ngưỡng đạt, quyền Plus, quyền Admin hay cách tính "cao nhất".

## B. Thay đổi trong code

| File | Thay đổi |
| --- | --- |
| `lib/practice/catalog-status.ts` (mới) | Hàm thuần: dòng trạng thái, hành động của bài, điểm cần để đạt (`passMark`, tính bằng chính `isPassingScore`), bộ đếm chương, bài tiếp theo. Chứa bản sửa lỗi #6. |
| `lib/practice/catalog-status.test.ts` (mới) | 18 test, gồm đúng trường hợp 2/10 → "Xem 6 câu còn sai" và test hồi quy cho lỗi 7/8. |
| `features/practice-exams/components/practice-catalog-view.tsx` | Viết lại bố cục như trên. Giữ các `data-testid` cũ còn ý nghĩa. |
| `features/practice-exams/components/admin-preview-note.tsx` | Thêm `AdminPreviewBar` (một dòng). Thẻ `AdminPreviewNote` cũ giữ nguyên vì trang Luyện thi còn dùng. |

Đã bỏ hoặc dời đi:

- Bỏ: thẻ "Đã đạt x/y bài" của cả môn; ghi chú Plus cho học sinh (thẻ khoá đã nói điều đó); đoạn "Các bài chưa có câu luyện tập" (mỗi dòng đã ghi "Chưa có câu hỏi").
- Dời: thẻ Tổng hợp chỉ còn ở "Theo chương".
- Không chức năng nào bị bỏ.

Không có migration và không thêm thư viện. Không đụng thành phần dùng chung nào khác.

## C. Trước / sau

Cùng dữ liệu, cùng tài khoản, cùng kích thước màn hình. Ảnh: `truoc/<khổ>/` và `sau/<khổ>/`.

| Trạng thái, khổ | Cao trang | Số chữ | Nút chính (toạ độ y) |
| --- | --- | --- | --- |
| Có câu sai, 1440 | 1265 → 900 px | 261 → 89 | "Sửa 6 câu sai" y=444 → "Xem 6 câu còn sai" y=139 |
| Có câu sai, 768 | 1457 → 1024 px | 261 → 89 | y=543 → y=187 |
| Có câu sai, 390 | 1945 → 866 px | 261 → 89 | y=699 → y=313 |
| Đang làm dở, 390 | 2146 → 938 px | 272 → 96 | "Làm tiếp" y=426 → y=198 |
| Theo chương (Plus), 390 | 1606 → 904 px | 210 → 87 | "Bắt đầu" y=778 → y=367 |
| Admin, 390 | 2093 → 1076 px | 268 → 131* | |
| Lượt sửa 7/8 (lỗi #6) | | | "Luyện lại" → "Xem 1 câu còn sai" |

\* Tài khoản Admin có thêm một lượt Tổng hợp làm dở do chạy E2E giữa hai lần chụp, nên trang "sau" có thêm ô làm tiếp.

Không cuộn ngang và không lỗi console ở cả 36 ảnh trước và 36 ảnh sau.

## D. Kiểm thử Admin → Học sinh

Chạy `e2e/e2e.mjs` trên DB vừa seed lại, mỗi khổ một lần (1440, 768, 390). Ở mỗi khổ, Admin soạn nội dung qua giao diện Admin thật. **369/369 kiểm tra đạt** (123 mỗi khổ). Kết quả chi tiết: `e2e-results-<khổ>.json`.

| Kịch bản | Mong đợi | Thực tế | Kết quả |
| --- | --- | --- | --- |
| F1 Admin đăng nhập, mở Admin › Luyện tập, xem 12+ câu có sẵn của "Tính đơn điệu" | Trang mở, thấy câu | Đúng | PASS |
| F1 Soạn 3 câu cho "Tích phân" bằng trình soạn câu | 201; gắn đúng bài, tự nhận Toán 12; trạng thái nháp; có nguồn và quyền | Đúng | PASS |
| F1 Trình soạn với câu thiếu lời giải | Không cho lưu | Không gửi request | PASS |
| F1 Câu thiếu lời giải tạo qua API, rồi gửi duyệt | Nút xuất bản bị khoá, hiện "Chưa xuất bản được" | Đúng | PASS |
| F1 Gọi thẳng API để xuất bản câu thiếu lời giải | Không đến tay học sinh | Ngân hàng câu cho đổi trạng thái (thiếu lời giải chỉ là cảnh báo ở đó), nhưng bộ lọc luyện tập phía server loại câu này | PASS (xem rủi ro 3) |
| F1 Xem trước như học sinh, rồi xuất bản 2 câu, để 1 câu chờ duyệt | DB: 2 câu PUBLISHED, 1 câu IN_REVIEW | Đúng | PASS |
| F2 Học sinh mới: Lộ trình → thanh bên "Luyện tập" | Mở đúng trang, mục thanh bên đang chọn, chỉ một `h1` | Đúng | PASS |
| F2 "Tích phân" sau khi xuất bản | "2 câu", nút Bắt đầu; lượt làm chỉ có 2 câu đã xuất bản; không có câu chờ duyệt, câu thiếu lời giải, câu lưu trữ, câu Plus; không lộ đáp án | Đúng | PASS |
| F2 Học sinh thường | Không thấy ghi chú Admin; chỉ một nút chính | Đúng | PASS |
| F3 Chấm câu đúng / sai qua giao diện, có lời giải | "Chính xác" / "Chưa đúng" | Đúng | PASS |
| F3 Tải lại trang giữa chừng | Vẫn lượt đó, mở câu 4 | Đúng | PASS |
| F3 Rời trang | Ô làm tiếp và dòng bài cùng ghi "Đang làm · 3/10 câu" | Đúng | PASS |
| F3 Đăng xuất, đăng nhập lại | Bị chuyển tới đăng nhập; sau đó "Làm tiếp" mở câu 4 | Đúng | PASS |
| F3 Làm xong 1/10 | "Cao nhất 1/10 · cần 8 để đạt", nút "Xem 9 câu sai" mở kết quả 1/10 có "Luyện lại 9 câu sai" | Đúng | PASS |
| F3 Sửa 9 câu sai, đúng 3 | Điểm cao nhất vẫn 1/10; nút "Xem 6 câu còn sai" | Đúng | PASS |
| F3 Sửa tiếp, đúng 5/6 (≥ 80%) | Vẫn mời "Xem 1 câu còn sai" (lỗi #6) | Đúng | PASS |
| F3 Sửa hết, rồi làm lại cả bài 9/10 | "Luyện lại", sau đó "Đạt · 9/10", chương "1/3 bài đạt", việc chính chuyển sang "Cực trị" | Đúng | PASS |
| F3 Lịch sử trong DB | LESSON 1/10, MISTAKES 3/9, 5/6, 1/1, LESSON 9/10 | Đúng | PASS |
| F3 Trả lời lại một câu đã chấm | Trả về kết quả đã lưu, không chấm lại | Đúng | PASS |
| F4 Học sinh miễn phí | Ôn chương mở (chương 2 cũng mở nhờ 2 câu vừa xuất bản); Tổng hợp khoá; server trả 403 khi bắt đầu Tổng hợp | Đúng | PASS |
| F4 Học sinh Plus | Tổng hợp mở và bắt đầu được (200); không có ghi chú Admin; học sinh khác không đọc được lượt của em (404) | Đúng | PASS |
| F4 Admin xem trước | Một dòng ghi chú có số chương; bắt đầu Tổng hợp được (200); không ghi gì vào file đăng ký Plus | Đúng | PASS |
| F5 Khách | Trang chuyển tới đăng nhập; API 401 | Đúng | PASS |
| F5 Bài không tồn tại / chưa mở | API 404; trang ghi "Bài học này chưa mở" | Đúng | PASS |
| F5 Nội dung đổi sau khi làm (Admin lưu trữ một câu em làm sai) | Kết quả cũ giữ "1/2"; lượt mới còn 1 câu; trang kết quả cũ vẫn mở | Đúng | PASS |
| F5 Sửa câu sai khi câu đó đã bị lưu trữ | | API 409 "Không còn câu sai nào để luyện lại." | PASS (rủi ro 1) |
| F5 Lỗi mạng | Hiện lỗi, nút "Thử lại" hoạt động | Đúng | PASS |
| F5 API chậm 2,5 giây | Có khung chờ, sau đó trang hiện đủ | Đúng | PASS |
| F5 Bấm quay lại từ bài luyện | Về trang Luyện tập | Đúng | PASS |
| F5 Chưa có nội dung nào | "Chưa có bài nào để luyện" và nút Về Lộ trình | Đúng | PASS |
| F6 Bố cục | Nút nằm trong dòng, không đè tên bài, không bị cắt; không cuộn ngang | Đúng ở cả 3 khổ | PASS |
| F6 Bàn phím | Thứ tự Tab: môn → Theo bài/Theo chương → nút của bài; Enter đổi chế độ xem; có viền focus | Đúng | PASS |
| Console | Không có lỗi ngoài các request bị chặn có chủ đích | Đúng | PASS |
| "Luyện tổng hợp" theo nghĩa đề thi (Luyện thi) | | Không nằm trong phạm vi trang này, không thay đổi | Không chạy |
| Production | Chỉ đọc | Không truy cập: phiên này không có thông tin đăng nhập Production | BLOCKED (không cần cho thay đổi này) |

**Kiểm tra khác:**

- `tsc --noEmit`: sạch. `next build`: đạt.
- `vitest`: 813 đạt, 4 lỗi trong `features/roadmap` (`roadmap-service`, `adaptive-learning-service`). Cả 4 lỗi có y hệt trên `master` (đã chạy lại trên `master` để đối chiếu).
- ESLint trên file đã sửa: sạch. Cả repo còn 3 lỗi ở `app/layout.tsx`, `qb-page.tsx`, `student-home-overview.tsx`. Các lỗi này có sẵn, ở file không đụng tới.

### Rủi ro còn lại

1. Nếu Admin lưu trữ đúng câu học sinh đã làm sai, trang vẫn mời "Xem n câu sai". Trang kết quả mở được, nhưng nút "Luyện lại câu sai" trả lỗi 409 kèm câu báo lỗi. Muốn trang đếm đúng thì danh mục phải đọc thêm từng câu trả lời. Đây là việc riêng, chưa làm.
2. "Xem n câu sai" vẫn mở trang kết quả rồi mới luyện lại, tức là hai bước như trước. Nhãn giờ đã nói đúng điều đó. Muốn vào thẳng phần sửa thì phải thêm tham số cho trang luyện tập.
3. Ngân hàng câu cho phép đặt PUBLISHED cho câu thiếu lời giải khi gọi thẳng API, vì ở đó thiếu lời giải chỉ là cảnh báo. Luyện tập vẫn an toàn vì server lọc bỏ câu này, nhưng đề thi dùng quy tắc riêng và nằm ngoài phạm vi kiểm tra này.
4. Chưa kiểm tra trên trình duyệt Safari hay thiết bị thật, chỉ Chromium.

## E. Chạy lại

`e2e/restart.sh build` dựng app và mở 2 server QA (3401 `pp_qa`, 3402 `pp_empty`). Sau đó:

1. `node e2e/seed.mjs pp_qa` (chạy trong thư mục repo);
2. `node e2e/states.mjs`;
3. `node e2e/shots.mjs sau`;
4. `node e2e/e2e.mjs 1440`.

Các script giả định Postgres cục bộ và đường dẫn `/tmp/claude-0/pp`.
