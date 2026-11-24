# Tú Tài · Không gian học tập theo khung nhìn (vòng 2 của PR #45)

> Trạng thái: **READY FOR OWNER VISUAL REVIEW**. Chưa merge, không deploy Production, không đụng dữ liệu Production. Kết quả test tự động không thay cho duyệt của chủ dự án.

Bài kiểm chứng: **"Tính đơn điệu của hàm số (P1)"** (bản chụp nội dung bài trên Production, chạy trên CSDL QA cục bộ). Mọi thay đổi nằm trong component dùng chung của bài học tương tác (`components/learning/interactive/`), không gắn riêng cho P1: mọi bài có lời giải 4 bước (Áp dụng, Tự làm) đều nhận bố cục mới.

Hai ảnh chụp nhắc trong yêu cầu không có trong tin nhắn, nên trạng thái "trước" được dựng lại bằng chính bản build của nhánh trước vòng này (commit 49d4fd5) và đo bằng Playwright.

## A. Kết quả rà soát (trước khi sửa)

Đo trên bản 49d4fd5, học sinh mới, làm đúng mọi câu. "Nút Tiếp tục trong màn hình" nghĩa là học sinh thấy đường đi tiếp mà không phải cuộn.

| Khung nhìn | Phần 4 Áp dụng: chiều cao trang qua các trạng thái | Phần 5 Tự làm khi giải xong | Nút Tiếp tục trong màn hình |
| --- | --- | --- | --- |
| 1366×768 | 890 → 1.288 → 1.710 → 1.719 → 1.779 px | 2.124 px | 1/12 trạng thái |
| 1440×900 | 912 → 1.288 → 1.710 → 1.779 px | 2.124 px | 7/12 trạng thái |
| 390×844 | 1.203 → 2.077 px | 2.428 px | luôn (thanh dưới cố định) |

Các vấn đề quan sát được:

1. **Cuộn dọc quá nhiều.** Bốn bước của lời giải xếp chồng lên nhau và đều mở. Bước đã xong vẫn chiếm chỗ (phần Áp dụng lên tới 1.779 px ở màn 768 px, tức hơn 2 màn hình).
2. **Hai cột lệch.** Đồ thị (cột phải, dính khi cuộn) kết thúc khoảng 700 đến 720 px, phía dưới bỏ trống trong khi cột trái dài gấp 2 đến 3 lần.
3. **Bước đã xong chiếm chỗ.** Mỗi bước giữ đầy đủ câu hỏi, đáp án, phản hồi, lời giải mẫu.
4. **Câu hỏi của thầy cô bị nối vào cuối trang.** Ở phần Tự làm, khối trắc nghiệm bắt đầu khoảng 1.240 px, học sinh phải cuộn qua cả lời giải mới thấy.
5. **Điều hướng xa chỗ đang làm.** Nút "Tiếp tục" nằm cuối trang, dưới mọi nội dung; trên desktop nó ra khỏi màn hình ở hầu hết trạng thái.
6. **Phần 1 đến 3 và phần 6** đã gọn (vừa khoảng một màn hình), chỉ có cùng vấn đề nút Tiếp tục ở cuối trang. Phần 6 (tổng kết) đã được làm lại ở vòng 1 và vừa một màn hình.

## B. Hướng thiết kế

Biến hai phần giải bài thành **một không gian làm bài theo bước**, thay cho tài liệu dài:

- **Thanh bước ngang** (4 bước + 1 ô kết quả): Tập xác định · Đạo hàm, y′ = 0 · Xét dấu y′ · Kết luận · Bảng biến thiên (phần 4) hoặc Kiểm tra (phần 5). Ô đang xem rộng và có tên; ô khác chỉ là dấu ✓ hoặc số, có `title` và nhãn cho trình đọc màn hình. Bước chưa tới bị khoá (không thể nhảy cóc).
- **Một bước mỗi lúc.** Bảng chỉ hiện bước đang làm, kèm đầu đề "Bước n/4 · tên bước" và đúng câu mô tả bước của giáo viên trong bài (thay cho hộp "Quy trình xét tính đơn điệu" riêng).
- **Bước đã xong gọn thành một dòng** ("1. D = ℝ", "2. y′ = 3x² − 6x; y′ = 0 ⇔ x = 0 hoặc x = 2"...). Bấm ô bước để mở lại bước đó với đáp án đã chọn; câu trả lời không mất vì các bước đã tới vẫn được giữ trong trang (chỉ ẩn).
- **Làm xong một bước, phản hồi ở lại** cho học sinh đọc, kèm nút "Sang bước n: ..." để đi tiếp khi sẵn sàng (không tự nhảy mất phản hồi).
- **Hai cột cân bằng** (`balance="even"`, 1:1) ở phần 4 và 5: bảng bước và đồ thị cao xấp xỉ nhau.
- **Câu hỏi của thầy cô trong một cửa sổ tập trung** (native `<dialog>` dạng modal): một câu mỗi lúc, đáp án, nút Kiểm tra, phản hồi và lời giải cùng trong khung nhìn. Ngoài trang chỉ còn một thẻ nhỏ "Câu hỏi của thầy cô · Đã làm x/2 · Làm ngay / Làm tiếp / Xem lại".
- **Thanh điều hướng dính đáy trên desktop** (Phần trước · Tiếp tục), như thanh dưới đã có trên điện thoại: luôn biết đang ở đâu và bước tiếp theo là gì, nhưng nút vẫn khoá cho tới khi làm xong hoạt động.

Các phương án đã cân nhắc và không chọn: giữ dạng cuộn nhưng thu gọn bước đã xong (vẫn dài khi phản hồi và lời giải mở, đồ thị vẫn lệch); đưa cả lời giải vào dialog (mất đồ thị bên cạnh, mà đồ thị là chỗ học sinh tự kiểm chứng); dialog lồng nhau cho gợi ý (yêu cầu cấm).

## C. Thay đổi đã triển khai

| Tệp | Thay đổi |
| --- | --- |
| `guided-solver.tsx` | Thanh bước (`solver-steps`, `solver-chip-*`, `aria-current="step"`), một bảng bước mỗi lúc (các bước đã tới giữ trong DOM bằng `hidden`), dòng tóm tắt bước đã xong (`solver-ledger`), nút "Sang bước n" (`solver-next`, tự cuộn lên trên thanh đáy), ô kết quả (`finish`, `finishLabel`), câu mô tả bước của giáo viên, bảng kết luận gọn một hàng trên màn rộng. |
| `teacher-questions.tsx` (mới) | Thẻ mở + cửa sổ câu hỏi: `showModal()`, Esc và nút ✕ đóng, bấm nền đóng, focus vào câu hỏi khi mở và trả về nút khi đóng, toàn màn hình trên điện thoại, `QuickCheck` luôn được giữ nên câu trả lời và phản hồi còn nguyên khi đóng mở lại. Không chặn nút Tiếp tục. |
| `stage-solve.tsx` | Phần 4 và 5 dùng bố cục mới: thẻ đề bài gọn (`problem`), ô kết quả là bảng biến thiên (phần 4) hoặc xác nhận đồ thị + câu hỏi của thầy cô (phần 5). |
| `stage-layout.tsx` | Tuỳ chọn `balance="even"` cho hai cột bằng nhau. |
| `interactive-lesson.tsx` | Thanh "Phần trước / Tiếp tục" dính đáy trên desktop. |
| `beats.tsx`, `stage-slope.tsx` | `Choices`/`Question` nhận `layout` để câu tập xác định xếp một cột trên điện thoại (tránh đáp án bị gãy dòng). |

Không đổi: nội dung bài, đáp án, cách chấm, quy tắc tiến độ và khoá phần, ăn mừng một lần, âm thanh, lộ trình, luyện tập, API, CSDL.

## D. Tối ưu theo khung nhìn (sau khi sửa)

| Khung nhìn | Phần 4: chiều cao trang | Phần 5 giải xong | Nút Tiếp tục trong màn hình |
| --- | --- | --- | --- |
| 1366×768 | 882 → 913 → 1.017 → 950 px (trước: tới 1.779) | 882 px (trước: 2.124) | 14/14 trạng thái (trước: 1/12) |
| 1440×900 | 904 → 913 → 1.017 → 950 px | 904 px | 14/14 |
| 1920×1080 | 1.080 px mọi trạng thái (không cuộn) | 1.080 px | 14/14 |
| 390×844 | 1.156 → 1.363 px (trước: tới 2.077) | 1.223 px (trước: 2.428) | 14/14 (thanh dưới) |
| 360×640 | 1.128 → 1.315 px | 1.196 px | 14/14 (thanh dưới) |

- Đồ thị luôn nằm cạnh bước đang làm trên desktop (E2E kiểm tra đồ thị trong khung nhìn), ghim phía trên trên điện thoại như trước.
- Không thêm vùng cuộn lồng nhau trên trang. Cửa sổ câu hỏi có một vùng cuộn riêng của chính nó (cần khi câu hỏi dài trên màn 640 px).
- Không thu nhỏ chữ: cỡ chữ đề bài, đáp án, bảng giữ nguyên.
- Phần 1 (đo lại): 882 px ở 1366×768, 952 px ở 390×844, nút Tiếp tục trong màn hình. Phần 2 và 3 chỉ được nhìn lại trong video ghi màn hình, không đo số.

## E. Trước / sau

**Phần 4 phản hồi đúng** · 1366 (trái: trước, phải: sau; vạch đỏ là đáy màn hình đầu tiên ở ảnh toàn trang)

![Phần 4 phản hồi đúng](anh/khong-gian-hoc/truoc-sau/1366-05-ap-dung-phan-hoi-dung.png)

**Phần 5 giải xong (cả trang)** · 1366 (trái: trước, phải: sau; vạch đỏ là đáy màn hình đầu tiên ở ảnh toàn trang)

![Phần 5 giải xong (cả trang)](anh/khong-gian-hoc/truoc-sau/1366-12-tu-lam-giai-xong-full.png)

**Phần 4 bảng biến thiên (cả trang)** · 1440 (trái: trước, phải: sau; vạch đỏ là đáy màn hình đầu tiên ở ảnh toàn trang)

![Phần 4 bảng biến thiên (cả trang)](anh/khong-gian-hoc/truoc-sau/1440-06-ap-dung-bang-bien-thien-full.png)

**Phần 5 câu hỏi thầy cô** · 1440 (trái: trước, phải: sau; vạch đỏ là đáy màn hình đầu tiên ở ảnh toàn trang)

![Phần 5 câu hỏi thầy cô](anh/khong-gian-hoc/truoc-sau/1440-11-tu-lam-phan-hoi.png)

**Phần 5 điện thoại (cả trang)** · 390 (trái: trước, phải: sau; vạch đỏ là đáy màn hình đầu tiên ở ảnh toàn trang)

![Phần 5 điện thoại (cả trang)](anh/khong-gian-hoc/truoc-sau/390-12-tu-lam-giai-xong-full.png)


## F. Ảnh chụp cuối (theo khung nhìn, không phải toàn trang)

Ảnh desktop được thu nhỏ còn 60% để nhẹ repo; ảnh điện thoại giữ kích thước thật.

**01. Phần 4 Áp dụng · mở đầu** · 1366×768

![Phần 4 Áp dụng · mở đầu](anh/khong-gian-hoc/01-1366-01-ap-dung-dau.png)

**02. Phần 4 · bước đang làm (bước 2/4)** · 1366×768

![Phần 4 · bước đang làm (bước 2/4)](anh/khong-gian-hoc/02-1366-02-ap-dung-buoc-dang-lam.png)

**03. Phần 4 · xem lại bước 1 đã xong** · 1366×768

![Phần 4 · xem lại bước 1 đã xong](anh/khong-gian-hoc/03-1366-03-ap-dung-xem-lai-buoc.png)

**04. Phần 4 · đang chọn dấu y′** · 1366×768

![Phần 4 · đang chọn dấu y′](anh/khong-gian-hoc/04-1366-04-ap-dung-chon-dap-an.png)

**05. Phần 4 · phản hồi đúng** · 1366×768

![Phần 4 · phản hồi đúng](anh/khong-gian-hoc/05-1366-05-ap-dung-phan-hoi-dung.png)

**06. Phần 4 · bảng biến thiên** · 1366×768

![Phần 4 · bảng biến thiên](anh/khong-gian-hoc/06-1366-06-ap-dung-bang-bien-thien.png)

**07. Phần 5 Tự làm · mở đầu** · 1440×900

![Phần 5 Tự làm · mở đầu](anh/khong-gian-hoc/07-1440-07-tu-lam-dau.png)

**08. Phần 5 · đang chọn nghiệm** · 1440×900

![Phần 5 · đang chọn nghiệm](anh/khong-gian-hoc/08-1440-08-tu-lam-dang-lam.png)

**09. Phần 5 · câu trắc nghiệm, đã chọn đáp án** · 1440×900

![Phần 5 · câu trắc nghiệm, đã chọn đáp án](anh/khong-gian-hoc/09-1440-10-tu-lam-chon-dap-an.png)

**10. Phần 5 · cửa sổ câu hỏi của thầy cô** · 1440×900

![Phần 5 · cửa sổ câu hỏi của thầy cô](anh/khong-gian-hoc/10-1440-09-tu-lam-cau-hoi.png)

**11. Phần 5 · phản hồi câu trắc nghiệm** · 1440×900

![Phần 5 · phản hồi câu trắc nghiệm](anh/khong-gian-hoc/11-1440-11-tu-lam-phan-hoi.png)

**12. Phần 5 · giải xong, đồ thị xác nhận** · 1440×900

![Phần 5 · giải xong, đồ thị xác nhận](anh/khong-gian-hoc/12-1440-12-tu-lam-giai-xong.png)

**13. Phần 6 · tổng kết** · 1920×1080

![Phần 6 · tổng kết](anh/khong-gian-hoc/13-1920-13-hoan-thanh.png)

**14. Phần 4 · bước đang làm (điện thoại)** · 390×844

![Phần 4 · bước đang làm (điện thoại)](anh/khong-gian-hoc/14-390-02-ap-dung-buoc-dang-lam.png)

**15. Phần 4 · đồ thị ghim trên cùng** · 390×844

![Phần 4 · đồ thị ghim trên cùng](anh/khong-gian-hoc/15-390-05-ap-dung-phan-hoi-dung.png)

**16. Phần 5 · tự làm (điện thoại)** · 390×844

![Phần 5 · tự làm (điện thoại)](anh/khong-gian-hoc/16-390-08-tu-lam-dang-lam.png)

**17. Phần 5 · câu trắc nghiệm toàn màn hình** · 390×844

![Phần 5 · câu trắc nghiệm toàn màn hình](anh/khong-gian-hoc/17-390-10-tu-lam-chon-dap-an.png)

**18. Phần 5 · mở lại cửa sổ, câu trả lời còn nguyên** · 360×640

![Phần 5 · mở lại cửa sổ, câu trả lời còn nguyên](anh/khong-gian-hoc/18-360-11c-tu-lam-mo-lai.png)

**Thêm: Phần 4 · phản hồi đúng (1920)** · 1920×1080

![Phần 4 · phản hồi đúng (1920)](anh/khong-gian-hoc/x1-1920-05-ap-dung-phan-hoi-dung.png)

**Thêm: Phần 4 · bảng biến thiên (1440)** · 1440×900

![Phần 4 · bảng biến thiên (1440)](anh/khong-gian-hoc/x2-1440-06-ap-dung-bang-bien-thien.png)

**Thêm: Phần 4 · bước đang làm (360×640)** · 360×640

![Phần 4 · bước đang làm (360×640)](anh/khong-gian-hoc/x3-360-02-ap-dung-buoc-dang-lam.png)

**Thêm: Phần 5 · đóng cửa sổ, thẻ ghi 1/2** · 1366×768

![Phần 5 · đóng cửa sổ, thẻ ghi 1/2](anh/khong-gian-hoc/x4-1366-11b-tu-lam-sau-khi-dong.png)


## G. Minh hoạ tương tác

GIF (1440×900, thu nhỏ): làm 4 bước phần Áp dụng, mở lại bước 1, bảng biến thiên, sang phần Tự làm, mở cửa sổ câu hỏi, trả lời, đóng, mở lại thấy câu trả lời còn, rồi sang phần Hoàn thành.

![Demo thanh bước và cửa sổ câu hỏi](anh/khong-gian-hoc/demo-buoc-va-cua-so-1440.gif)

## H. E2E QA (Admin → Học sinh)

CSDL QA cục bộ `pp_lesson` (bản sao cấu trúc Production + bài P1), không phải Production. Admin xuất bản bài qua Admin UI, học sinh mới học từ lộ trình.

| Khung nhìn | Kết quả |
| --- | --- |
| 1366 | 103/103 PASS |
| 1440 | 106/106 PASS (kèm biến thể âm thanh tắt, giảm chuyển động) |
| 1920 | 103/103 PASS |
| 390 | 104/104 PASS |
| 360 | 104/104 PASS |

1366 và 390 chạy trên bản build cuối. 1440, 1920 và 360 chạy trên bản build ngay trước đó; khác biệt duy nhất là bỏ khung viền thứ hai quanh bảng biến thiên (để phần 4 ở 1366×768 xuống 950 px). Ở bản trước đó, 1366 có 1 mục FAIL: trang 992 px vượt ngưỡng tự đặt 960 px (1,25 × 768); thay đổi này là để sửa mục đó.

Các mục được kiểm tra trong mỗi lần chạy:

| Hạng mục | Kết quả |
| --- | --- |
| Chuyển bước bằng nút "Sang bước", bước trước ẩn, kết quả vào dòng tóm tắt | PASS |
| Không nhảy cóc: ô bước 3, 4, kết quả bị khoá; Tiếp tục khoá giữa chừng | PASS |
| Xem lại bước trước (ô bước 1), đáp án còn nguyên, quay về bước đang làm | PASS |
| Đồ thị nằm trong khung nhìn khi làm bước (desktop và điện thoại) | PASS |
| Bảng biến thiên hiện ở ô kết quả | PASS |
| Chọn sai: đáp án gạch, khoá, "Chưa đúng" | PASS |
| Gợi ý mở trong bước đang làm | PASS |
| Phản hồi đúng trong bước | PASS |
| Cửa sổ câu hỏi: là modal, focus vào trong, toàn màn hình trên điện thoại | PASS |
| Trắc nghiệm trong cửa sổ: phản hồi sai và phản hồi đúng, gợi ý trước khi trả lời | PASS |
| Esc đóng, focus về nút mở, thẻ ghi "1/2", mở lại còn câu trả lời và phản hồi | PASS |
| "Quay lại bài" đóng, không còn dialog nào mở (không lồng) | PASS |
| Câu hỏi của thầy cô không chặn Tiếp tục | PASS |
| Tải lại giữa phần 4: mở lại đúng phần 4, Tiếp tục vẫn khoá | PASS |
| "Phần trước" mở phần 3 ở chế độ xem lại, đi tiếp về phần 4 vẫn khoá; thanh phần không cho nhảy tới phần 5 | PASS |
| Ăn mừng đúng một lần, quay lại / tải lại / mở lại không ăn mừng lại | PASS |
| Xem lại từng phần sau khi học xong | PASS |
| Luyện tập từ bài, quay lại, "Luyện tiếp" đúng lượt | PASS |
| Tiến độ giữ nguyên, server ghi 1 ngày học | PASS |
| Không lỗi console, không tràn ngang | PASS |
| Âm thanh tắt, giảm chuyển động (biến thể: chạy ở 1440; ở 390 chạy ở lần build ngay trước, chỉ khác viền quanh bảng biến thiên) | PASS |
| Trình đọc màn hình thật (VoiceOver, TalkBack) | NOT TESTED |
| Safari / Firefox thật, iPhone thật | NOT TESTED (chỉ Chromium) |

Ghi nhận khi tải lại giữa phần 4: các bước đã làm trong phần đó bắt đầu lại từ bước 1. Đây là cách hệ thống tiến độ vốn hoạt động (chỉ lưu theo phần, không lưu từng bước) và vòng này không đổi quy tắc tiến độ. Nếu muốn giữ từng bước qua tải lại, cần một thay đổi riêng về lưu tiến độ.

## I. Kiểm tra kỹ thuật

| Hạng mục | Kết quả |
| --- | --- |
| `tsc --noEmit` | sạch |
| ESLint (`components/learning`, `lib/learning`) | sạch |
| `next build` | thành công |
| Vitest | 834 đạt, 58 bỏ qua, 5 lỗi **có sẵn trên master** (4 ở `features/roadmap/lib`, 1 phụ thuộc ngày ở `student-experience-service`), không liên quan |
| E2E | xem mục H |
| Lỗi console khi chụp ảnh ở 5 khung nhìn | 0 |

Giới hạn: chỉ chạy Chromium (Playwright), một bài mẫu (P1); bài không có câu hỏi của thầy cô thì phần 5 không hiện thẻ câu hỏi; bài có hàm không giải được bằng 4 bước vẫn đi đường cũ (solver trả về `null`).

## J. Trạng thái PR #45

- Nhánh: `feature/lesson-experience-refine`
- Commit mới nhất: 48ac344 (mã), commit báo cáo ngay sau
- PR: https://github.com/gitdev-mdat/tutaiproject/pull/45 (draft, **chưa merge**)
- Báo cáo: `docs/reviews/lesson-focus/KHONG-GIAN-HOC.md`, ảnh trong `docs/reviews/lesson-focus/anh/khong-gian-hoc/`
- Preview: Vercel tự dựng preview cho nhánh sau khi đẩy (không promote, không Production).
- Báo cáo vòng 1 (ăn mừng một lần, màn tổng kết): `docs/reviews/lesson-focus/BAO-CAO.md`

