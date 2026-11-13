# VoiceBloom – Biên tập giọng nói

Ứng dụng React + Vite tạo giọng đọc đơn, hội thoại hai người, nghe thử giọng, lưu lịch sử và tải WAV. Giao diện chạy trên GitHub Pages; API Gemini chạy trên Render để khóa API không nằm trong mã nguồn trình duyệt.

## Thành phần
- Frontend: `https://tranhongkt10-dot.github.io/bientapgiongnoi/`
- Backend: Express + Google GenAI SDK trên Render.
- Gemini TTS: `gemini-3.8-flash-lite-tts` cho tác vụ giọng đơn; `gemini-3.8-flash-tts` cho hội thoại và tác vụ cần biểu cảm cao.
- Khóa API chỉ lưu trong Environment của Render. Không đặt khóa trong biến `VITE_*`.

## A. Triển khai máy chủ API trên Render

1. Đăng nhập Render, chọn **New → Blueprint**.
2. Kết nối repository `tranhongkt10-dot/bientapgiongnoi`.
3. Render đọc file `render.yaml` và tạo dịch vụ `voicebloom-api`.
4. Trong Environment của dịch vụ, thêm `GEMINI_API_KEY` với khóa Gemini API riêng của bạn.
5. Kiểm tra `FRONTEND_ORIGIN` là `https://tranhongkt10-dot.github.io`.
6. Chờ deploy hoàn tất, mở đường dẫn dịch vụ cộng `/health`. Kết quả mong đợi: `{"ok":true,"service":"voicebloom-api"}`.
7. Sao chép địa chỉ gốc của dịch vụ Render, ví dụ `https://voicebloom-api.onrender.com`.

## B. Triển khai giao diện GitHub Pages

1. Mở repository → **Settings → Secrets and variables → Actions → Variables**.
2. Chọn **New repository variable**.
3. Name: `VITE_API_BASE_URL`.
4. Value: địa chỉ gốc Render, không có dấu gạch chéo cuối.
5. Vào **Settings → Pages → Build and deployment → Source**, chọn **GitHub Actions**.
6. Mở tab **Actions**, chọn workflow **Deploy VoiceBloom to GitHub Pages**. Đợi build và deploy thành công.
7. Mở `https://tranhongkt10-dot.github.io/bientapgiongnoi/`.

## C. Kiểm tra các chức năng

- Tạo một câu tiếng Việt ngắn ở chế độ một giọng.
- Nghe thử giọng trong thư viện.
- Tạo hội thoại có đúng hai người nói.
- Kiểm tra tải file WAV và mở lại file đã tải.
- Thử mở trên điện thoại.

Nếu Render dùng gói miễn phí, máy chủ có thể ngủ khi không hoạt động; yêu cầu đầu tiên có thể mất thêm thời gian khởi động. Hạn mức và chi phí Gemini API tùy tài khoản Google của bạn.

## Chạy thử trên máy tính

```bash
npm install
cp .env.example .env
# Điền GEMINI_API_KEY trong .env
npm run dev
```

## Bảo mật

- Không đưa `GEMINI_API_KEY` vào frontend, file HTML, hoặc biến `VITE_*`.
- Không commit khóa API thật lên GitHub.
- Nếu khóa đã bị lộ, thu hồi khóa cũ và tạo khóa mới.
