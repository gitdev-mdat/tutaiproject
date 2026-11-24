# Trang Học: từ danh sách bài thành lộ trình học

Brief: "TÚ TÀI — Redesign Learning Roadmap & Premium Student Experience", mục tiêu `/student/roadmap`.

Phạm vi: trang Học, thẻ cuối bài học, và trạng thái tải, lỗi, trống của trang Học. Giữ nguyên việc tách Học và Luyện tập đã chọn ở PR #43. Không đổi cách chấm, ngưỡng đạt, quyền Plus/Admin, cách lưu tiến độ hay dữ liệu.

## 1. Audit (trước khi sửa)

Bằng chứng nằm trong `anh/truoc/`, chụp ở 1440, 768 và 390 với dữ liệu kiểm thử: 1 bài (giống Production hiện tại), 5 bài trong 2 chương, 32 bài trong 6 chương, và chương trình trống.

| # | Vấn đề | Bằng chứng | Loại |
| --- | --- | --- | --- |
| 1 | Bài học là các dòng trong accordion, không có gì nối bài này với bài sau. Học sinh không thấy mình đang ở đâu trong cả chương trình | `truoc/1440/nhieu-bai-dang-hoc.png`: 6 thanh chương xám giống hệt nhau, chỉ khác dòng chữ "x/y đã học" | Thiết kế |
| 2 | Không thấy tiến bộ chung. Chỉ có số đếm trong từng chương, không có số của cả chương trình | như trên | Thiết kế |
| 3 | Thẻ "bài tiếp theo" chỉ là chữ trên nền trắng: không hình, không biết bài thuộc chương nào trong hành trình, không biết sau bài này là gì | `truoc/*/it-bai-dang-hoc.png` | Thiết kế |
| 4 | Học xong hết thì trang cụt: một câu và một nút, không còn thấy thành quả | `truoc/1440/mot-bai-xong.png`, `it-bai-xong-het.png` | Thiết kế |
| 5 | Chỉ có 1 bài thì trang gần như trống, trông như sản phẩm dở dang | `truoc/1440/mot-bai-moi.png` | Thiết kế |
| 6 | Nhiều chương: mọi chương trông như nhau. Chương đã xong, đang học và sắp tới không khác nhau về hình | `truoc/390/nhieu-bai-*.png` | Thiết kế |
| 7 | Cuối bài học, nếu bài có câu luyện tập thì thẻ chỉ mời luyện tập. Muốn đọc bài sau phải quay ra trang Học | thẻ `lesson-practice-card` (trạng thái ready, retry, in-progress) | Luồng |
| 8 | Còn chữ "Xem lộ trình của em" ở thẻ cuối bài (PR #43 sót) | `lesson-practice-card.tsx` | Nội dung |
| 9 | Trang Học không có trạng thái tải và trạng thái lỗi riêng | không có `loading.tsx`, `error.tsx` cho `/student/roadmap` | Kỹ thuật |
| 10 | Dữ liệu không có ảnh chương hay ảnh bài. Đây không phải lỗi thiết kế mà là dữ liệu còn thiếu | `LearningLesson`, `LearningChapter` không có trường ảnh | Dữ liệu |
| 11 | Sau khi học xong một bài không có câu hỏi, bước tiếp theo vẫn do luật cũ `pickNextStep` chọn. Luật này có thể mời luyện tập một bài trước đó thay vì đọc bài sau. Đây là luật nghiệp vụ, không đổi trong PR này | `study-plan.ts` | Nghiệp vụ |

Hành trình Học → Bài học → Học xong → Bài tiếp theo → Luyện tập → Về Học:

- Bài học đã có thanh phần, nút "Tiếp tục · Phần n" và dòng "Chương 1 · Bài 1/4" nối về chương trình. Phần này nhất quán và không phải sửa.
- Chỗ đứt là lúc học xong bài (vấn đề 7) và lúc quay về trang Học (vấn đề 1 đến 4).

Không xem được trang Học trên Production, vì cần một tài khoản học sinh. Tạo tài khoản đó là ghi vào dữ liệu Production, nên phần này **BLOCKED**. Vì vậy audit dùng dữ liệu kiểm thử có cùng cấu trúc với Production: 1 bài "Tính đơn điệu của hàm số", cùng id.

## 2. Hướng thiết kế

Các phương án đã cân nhắc:

| Phương án | Ưu | Nhược với Tú Tài |
| --- | --- | --- |
| Đường đi zig-zag kiểu trò chơi | Rất "hành trình" | Hợp với bài ngắn 3 phút, không hợp với bài lý thuyết dài. Tốn chỗ, 50 bài là cuộn rất dài. Dễ thành gamification không mục đích |
| Lưới thẻ bài có ảnh | Đẹp khi có ảnh thật | Hiện chưa có ảnh nào. Lưới không cho thấy thứ tự học |
| Bản đồ chương trình (sơ đồ) | Cho thấy toàn cảnh | Khó đọc trên điện thoại. Kiến thức THPT là tuyến tính theo chương, không phải đồ thị |
| **Lộ trình theo chương trên một đường nối** (đã chọn) | Đúng cấu trúc thật của chương trình. Thấy rõ thứ tự, chỗ đang đứng và tiến bộ. Gập theo chương nên 1 bài hay 300 bài vẫn gọn | Cần ảnh chương để đạt chất lượng cao nhất. Đã làm ô hình thay thế |

Bố cục đã chọn:

1. **Thẻ "Bài tiếp theo của em"** ở trên cùng.
   - Bên trái là ô hình của chương: nền giấy ô li tô màu theo chương, số chương lớn và vài ký hiệu của môn.
   - Bên phải là "Chương 4 · Bài 14/32", tên bài và mô tả ngắn.
   - Nếu đang đọc dở thì có thanh chia phần (phần 2/5).
   - Một nút "Học tiếp" hoặc "Bắt đầu học", kèm dòng "Sau đó: <bài kế>" để biết điều gì đang chờ.
2. **Lộ trình.**
   - Mọi chương nằm trên một đường dọc, mỗi bài là một điểm trên đường. Bài được đánh số liên tục cả chương trình.
   - Đoạn đường đã học có màu xanh lá, nên nhìn là thấy đã đi được bao xa mà không cần thêm con số.
   - Bài đang học có điểm xanh dương và nền nổi.
   - Chương đã xong hiện dấu tích. Chương đang học ghi "Em đang học".
   - Chương trình dài (trên 2 chương và trên 8 bài) tự gập, chỉ mở chương đang học. Học sinh mở thêm chương nào tùy ý, dùng được bàn phím.
3. **Bản đồ chương** cạnh lộ trình trên màn rộng (≥1280px, từ 3 chương trở lên).
   - Có tổng "13/32 bài đã học" và thanh chia theo chương, mỗi đoạn dài theo số bài của chương.
   - Bấm vào một chương thì mở chương đó và cuộn tới.
   - Trên màn hẹp, tổng tiến độ nằm ở đầu khối Lộ trình. Mỗi con số chỉ hiện một lần.
4. **Học xong hết** thì thẻ trên cùng thành "Em đã học hết N bài" với nút "Sang Luyện tập" và "Ôn lại từ bài 1". Lộ trình đã hoàn thành vẫn hiện bên dưới.
5. **Không khoá bài.** Mọi bài vẫn mở được bất cứ lúc nào, như luật hiện tại.

Không thêm: huy hiệu, chuỗi ngày, điểm thưởng, câu trích dẫn, banner mục tiêu điểm. Mọi con số trên trang tính từ chương trình đã xuất bản và tiến độ đọc thật.

## 3. Đã thay đổi

| File | Thay đổi |
| --- | --- |
| `features/roadmap/lib/learning-path.ts` (mới) | Mô hình lộ trình thuần: chương, số thứ tự bài, trạng thái đọc, bài hiện tại, bài kế, chương nào mở sẵn. 8 test |
| `features/roadmap/components/student-roadmap.tsx` | Viết lại trang Học theo bố cục trên. Có khung chờ cùng hình dạng với trang thật |
| `features/roadmap/components/chapter-art.tsx` (mới) | Ô hình của chương, có sẵn chỗ nhận `src` khi có ảnh thật |
| `app/student/roadmap/loading.tsx`, `error.tsx` (mới) | Trạng thái tải và lỗi (có nút "Thử lại") |
| `features/lessons/components/lesson-practice-card.tsx` | Cuối bài: khi đang mời luyện tập, thêm "Học bài tiếp: <tên bài>". Sửa "Xem lộ trình của em" thành "Về lộ trình học" |

## 4. Số đo trước/sau (cùng dữ liệu)

| Trường hợp | 1440: cao (px) | 390: cao (px) | Số chữ |
| --- | --- | --- | --- |
| 1 bài, chưa học | 900 → 900 | 844 → 867 | 62 → 86 |
| 5 bài, đang học | 900 → 1076 | 978 → 1425 | 104 → 146 |
| 32 bài, đang học | 1021 → 1396 | 1222 → 1783 | 142 → 249 (1440) / 198 (390) |
| 32 bài, học xong hết | 951 → 1027 | 1157 → 1350 | 128 → 214 / 166 |

Trang dài hơn và nhiều chữ hơn là có chủ đích:

- Mỗi bài có thêm số thứ tự trong chương trình.
- Thẻ trên cùng có thêm chương, mô tả và "Sau đó".
- Có thêm tổng tiến độ.

Chương trình 32 bài vẫn gói trong khoảng 1,5 màn hình điện thoại, vì các chương không đang học được gập lại. Không có tràn ngang và không có lỗi console ở 27 ảnh "sau".

## 5. Kiểm thử end-to-end Admin → Học sinh

Chạy trên cơ sở dữ liệu kiểm thử riêng `pp_path`, là bản sao của dữ liệu kiểu Production với 1 bài. Không đụng Production.

Mọi bước làm bằng thao tác trên giao diện, trừ hai bước dùng API: đăng nhập Admin và đăng ký học sinh. Kết quả: **41/41 đạt ở 1440 và 41/41 đạt ở 390.** Script: `e2e/e2e-path.mjs`, log: `e2e/e2e-path-*.log`, ảnh: `anh/e2e/`.

| Bước | Kiểm tra |
| --- | --- |
| A1 | Admin tạo chương "Số phức (QA)", thêm 4 bài, chuyển "Môđun" lên trên "Phép cộng", soạn và xuất bản 3 bài, lưu 1 bài nháp |
| S1 | Học sinh thấy 2 chương theo thứ tự: Bài 1 Tính đơn điệu, Bài 2 Khái niệm, Bài 3 Môđun, Bài 4 Phép cộng. Bài nháp không có trên trang, mở thẳng đường dẫn cũng không vào được. Tiến độ 0/4, thẻ trên cùng là "Bắt đầu học" bài 1 kèm "Sau đó" |
| S2 | Bấm "Bắt đầu học", đọc hết bài 1. Thẻ cuối bài có "Học bài tiếp", bấm để mở bài 2 và đọc hết. Về trang Học: 2/4, hai bài có dấu tích, thẻ trên cùng chuyển sang Môđun. Tải lại trang vẫn 2/4 |
| S3 | Đọc dở một bài. Trang Học ghi "Học tiếp" và "Đang học · phần …", bấm để học tiếp đến hết |
| S4 | Mở bài cuối từ dòng trên lộ trình, học xong. Trang Học: 4/4, thẻ "đã học hết", lộ trình xanh vẫn hiện, có "Ôn lại từ bài 1". Bấm "Sang Luyện tập" thì mở trang Luyện tập |
| A2 | Admin thêm và xuất bản bài mới. Học sinh tải lại: bài mới ở cuối, tiến độ 4/5, thẻ trên cùng chuyển sang bài mới, bài nháp vẫn ẩn |
| S5 | Không tràn ngang. Có một h1 "Học". Đầu chương mở và đóng được bằng phím Enter. Không có lỗi console |

## 6. Kiểm tra mã

- `tsc --noEmit`: sạch.
- ESLint trên các file đã sửa: sạch.
- `next build`: thành công.
- Vitest: 825 đạt. Có 5 lỗi đã có sẵn trên master, không liên quan: 4 ở `features/roadmap/lib`, 1 ở `student-experience-service` phụ thuộc ngày.

## 7. Hình ảnh nên bổ sung

Giao diện đã đẹp khi chưa có ảnh nhờ ô hình thay thế. Khi có ảnh thật thì đặt vào đúng chỗ của ô hình, cùng kích thước:

| Ảnh | Dùng ở | Tỷ lệ, kích thước gợi ý | Ghi chú |
| --- | --- | --- | --- |
| Minh hoạ cho mỗi chương | Thẻ "Bài tiếp theo" (khối bên trái) | 4:5 hoặc 3:4, khoảng 720×900 | Nên là hình của kiến thức, ví dụ đồ thị hàm số hay hệ trục Oxyz, không phải ảnh trang trí. Nền sáng, ít chữ |
| Ô nhỏ cho mỗi chương | Đầu chương trên lộ trình và bản đồ chương | 1:1, 112×112 | Cùng bộ với minh hoạ chương, nhìn được ở cỡ 56px |
| Minh hoạ "đã học hết" | Thẻ hoàn thành | 4:5 | Có thể dùng chung một hình cho mọi môn |
| Minh hoạ "chưa có bài" | Trạng thái trống | 16:9 | |

Để hiện ảnh thật cần thêm một trường ảnh cho chương trong cây kiến thức và chỗ tải ảnh lên ở trang Admin. Việc này chưa làm vì là thay đổi dữ liệu. `ChapterArt` đã nhận `src`.

## 8. Còn tồn tại

- Vấn đề 11, luật bước tiếp theo sau bài không có câu hỏi, chưa đổi vì là nghiệp vụ. Thẻ cuối bài giờ luôn có đường sang bài đọc tiếp, nhưng nút chính vẫn theo luật cũ.
- Tiến độ đọc lưu trong trình duyệt (như trước), nên đổi máy thì trang Học bắt đầu lại từ 0.
- Kho sách tham chiếu của Admin trả 503 trên môi trường kiểm thử, vì chưa cấu hình kho lưu trữ. Lỗi này không liên quan đến thay đổi trong PR.
- Chưa xem được trên Production (xem mục 1).
