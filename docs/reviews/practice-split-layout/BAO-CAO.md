# Bố cục trang luyện tập: câu hỏi bên trái, lời giải bên phải

Áp dụng cho: Luyện tập sau bài học (`/student/lessons/[id]/practice`) và Ôn chương / Tổng hợp (`/student/practice/[kind]/[chapterId]`). Luyện thi giữ nguyên.

Ảnh và số đo chụp trên server QA cục bộ (Postgres riêng, dữ liệu kiểm thử), không dùng Production.

## Vấn đề (trước)

| Khổ màn hình | Chiều cao trang sau khi chấm (câu sai) | Nút "Câu tiếp theo" | Câu hỏi còn trên màn hình? |
| --- | --- | --- | --- |
| 1440 × 900 | 1247 px | y = 1127, nằm dưới mép màn hình | Không: trang tự cuộn xuống lời giải, đề bài trôi lên trên |
| 1280 × 800 | 1247 px | y = 1127, dưới mép | Không |
| 1024 × 768 | 1247 px | dưới mép | Không |
| 390 × 844 | 1454 px | thanh cố định ở đáy | Không |

1. Nội dung bị bó trong cột 720 px. Ở 1440 px còn trống khoảng 500 px hai bên, ở 1920 px còn trống hơn 900 px.
2. Lời giải nằm dưới bốn phương án. Muốn đọc lời giải phải cuộn xuống, lúc đó đề bài và phương án đã trôi khỏi màn hình, nên học sinh phải cuộn lên cuộn xuống để đối chiếu.
3. Nút "Câu tiếp theo" nằm dưới lời giải, nên câu nào có lời giải dài là phải cuộn hết mới bấm được.
4. Bốn phương án ngắn như `(0; 1)` vẫn chiếm bốn hàng cao 80 px.

## Thay đổi (sau)

- Khi vùng nội dung rộng từ 880 px trở lên (tức là màn hình khoảng 1280 px trở lên, đã trừ thanh bên), trang chia làm 2 cột: **câu hỏi + phương án + nút ở bên trái**, **kết quả + lời giải từng bước + "Vì sao em sai?" ở bên phải**.
- Cột lời giải luôn nằm trong màn hình (sticky). Lời giải dài hơn màn hình thì cuộn trong khung của nó, còn đề bài bên trái đứng yên. Sang câu mới, khung lời giải quay về đầu.
- Trước khi chấm, cột phải hiện ô gợi ý "Kết quả và lời giải sẽ hiện ở đây", để bố cục không bị nhảy khi chấm.
- Phương án ngắn (≤ 22 ký tự) xếp lưới 2 × 2, giống cách Luyện thi đang làm.
- Nút Kiểm tra / Câu tiếp theo luôn trong tầm tay: trên desktop và tablet nó bám đáy màn hình khi câu hỏi dài, còn trên điện thoại vẫn là thanh cố định ở đáy như cũ.
- Màn hình hẹp hơn (tablet, 1024 có thanh bên, điện thoại) vẫn xếp một cột: câu hỏi, kết quả, rồi nút.

| Khổ màn hình | Chiều cao trang sau khi chấm (câu sai) | Nút "Câu tiếp theo" |
| --- | --- | --- |
| 1920 × 1000 | 1000 px (không phải cuộn) | y = 414 |
| 1440 × 900 | 900 px (không phải cuộn) | y = 414 |
| 1280 × 800 | 800 px (không phải cuộn) | y = 446 |
| 1366 × 620 | lời giải cuộn trong khung, đề vẫn trên màn hình | y = 358 |
| 1024 × 768 | 1091 px, một cột | bám đáy màn hình |
| 390 × 844 | 1278 px (trước là 1454 px) | thanh cố định ở đáy |

Không có cuộn ngang ở khổ nào (`scrollWidth - innerWidth = 0`).

## Ảnh

Trước: `truoc/1440-3-sai.png`, `truoc/1280-4-dung-sai.png`, `truoc/390-3-sai.png`

Sau: `sau/1440-1-chon-dap-an.png`, `sau/1440-3-sai.png`, `sau/1280-4-dung-sai.png`, `sau/1366x620-loi-giai-cuon-xuong.png`, `sau/1024-3-sai-vi-sao.png`, `sau/390-3-sai.png`, `sau/1440-on-chuong.png`

## Đã kiểm tra

- Luyện bài: chọn, chấm đúng, chấm sai, câu Đúng/Sai, sang câu tiếp, ở 6 khổ màn hình (1920, 1440, 1280, 1024, 768, 390).
- Ôn chương: chấm một câu ở 1440 và 390.
- Màn hình thấp 1366 × 620: khung lời giải tự cuộn, đề bài đứng yên, câu sau khung về đầu.
- 1024: nút "Vì sao em sai?" vẫn bấm được khi nút "Câu tiếp theo" nổi bên cạnh.
- `tsc`, `eslint`, `prettier` sạch. `vitest`: 794 đạt, 5 lỗi ở roadmap / student-experience, cùng 5 lỗi đó có sẵn trên `main` và không liên quan thay đổi này.

## Chưa làm, có thể làm tiếp

- Phím tắt cho desktop (A–D để chọn, Enter để kiểm tra / sang câu).
- Trên điện thoại, sau khi chấm, đề bài vẫn trôi lên trên. Có thể thêm một dòng tóm tắt đề ở đầu khung lời giải.
