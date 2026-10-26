# Trang Lộ trình: gọn lại, ít chữ

Ảnh chụp trên server QA cục bộ (Postgres riêng, dữ liệu kiểm thử), không dùng Production. Có 2 trạng thái: học sinh mới, và học sinh đã xong bài 1, đang luyện bài 2.

## Số đo

| | Trước | Sau |
| --- | --- | --- |
| Số chữ trên trang (học sinh đang luyện) | 309 | 109 |
| Chiều cao trang 1440 × 900 | 1143 px (phải cuộn) | 900 px (vừa một màn hình) |
| Chiều cao trang 390 × 844 | 1816 px | 967 px |
| Vị trí nút "Làm tiếp luyện tập", 1440 | y = 800 | y = 372 |
| Vị trí nút trên 390 | y = 962 (dưới mép) | y = 391 |

Không có cuộn ngang ở khổ nào.

## Đã bỏ

- Hình đồ thị và công thức trang trí trên nền xanh đậm.
- Vòng tròn tiến độ, dòng "Còn 4 bài nữa trên hành trình", và ô "Thế nào là hoàn thành?". Thay bằng "1/5 bài đã xong" và một thanh tiến độ mảnh.
- Dải chương ở đáy phần đầu trang (trùng với danh sách bài bên dưới).
- Đoạn "Chọn theo hồ sơ của em… Tú Tài chưa kiểm tra trình độ đầu vào… Điểm em nhập không dùng để bỏ qua bài nào." Đoạn này chỉ còn hiện, dưới dạng một dòng ngắn, khi lộ trình đang xem khác với hồ sơ (ví dụ lớp 11 chưa có bài).
- Trong thẻ bài tiếp theo:
  - Bỏ nhãn "Bước tiếp theo" dạng huy hiệu và vạch màu bên trái.
  - Bỏ câu giải thích dài.
  - Bỏ ba bước Học bài / Luyện tập / Hoàn thành có icon. Thay bằng một dòng trạng thái, ví dụ "Đang luyện tập 2/5 câu". Bài mới chưa học thì không hiện dòng này.
- Trong danh sách bài:
  - Bỏ dòng phụ "mọi bài đều mở, học trước thứ tự vẫn được tính".
  - Bỏ nhãn "CHƯƠNG 1" in hoa và các vạch đếm bài.
  - Bỏ ảnh đại diện nhỏ và nhãn "Em ở đây".
  - Bỏ mục "Đích đến" kèm đoạn giải thích.
- Tên chương in hoa (lấy từ sách giáo khoa) được hiện dạng câu thường cho dễ đọc, ví dụ "Ứng dụng đạo hàm để khảo sát…".

## Còn lại

1. Môn và lớp (dạng tab nếu có nhiều chương trình), mục tiêu điểm, tiến độ.
2. Bài tiếp theo: tên bài, chương, trạng thái, nút chính, và một link phụ (Xem lại bài học).
3. Các bài học theo chương. Mỗi dòng có tên bài và trạng thái, bấm vào là mở bài.

## Kiểm tra

- `tsc`, `eslint`, `prettier` sạch.
- `vitest` cho features/lessons và features/roadmap có 4 lỗi ở `roadmap-service` / `adaptive-learning-service`. Cả 4 lỗi này đều có sẵn trên `master` từ trước (cùng nhóm đã ghi ở PR #39), không liên quan thay đổi này.
