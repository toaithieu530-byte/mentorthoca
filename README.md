<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Poetry Mentor app

Ứng dụng hiện hỗ trợ:
- **Gemini miễn phí qua Puter.js** (ưu tiên khi SDK khả dụng, dùng model nhanh: `gemini-3.1-flash-lite-preview` -> `gemini-3-flash-preview`).
- **Text AI fallback qua Pollinations** (`openai-large` -> `openai`) khi Puter không khả dụng.
- **Gemini miễn phí qua Puter.js** (ưu tiên khi SDK khả dụng).
- **Text AI fallback qua Pollinations** (`openai-large` -> `openai`) khi Puter không khả dụng.
Ứng dụng đã được đổi sang:
- **Text AI miễn phí** qua Pollinations (fallback model: `openai-large` -> `openai`) — không cần Gemini API key.
- **Text AI miễn phí** qua Pollinations (`openai-large`) — không cần Gemini API key.
- **Voice AI** qua ElevenLabs (voice ID mặc định: `jdlxsPOZOHdGEfcItXVu`), fallback client-side sang Puter ElevenLabs miễn phí (không dùng Web Speech).
- **Voice AI** qua ElevenLabs (voice ID mặc định: `jdlxsPOZOHdGEfcItXVu`), fallback server-side sang Google Translate TTS (không dùng Web Speech).

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Run the app:
   `npm run dev`

## Deploy on Vercel

1. Import repo vào Vercel.
2. Build command: `npm run build`
3. Output directory: `dist`
4. Deploy.

## Deploy notes

- Đã nhúng Puter SDK ở `index.html` qua `https://js.puter.com/v2/`.
- Chat Puter bật streaming realtime để phản hồi hiện ra sớm hơn (không đợi full text).
- Có thể tắt Puter và dùng Pollinations bằng cách set `VITE_USE_PUTER_GEMINI=false`.
- Có thể set `VITE_TEXT_API_BASE` (ví dụ: `https://text.pollinations.ai`) để đổi text endpoint.
- Nếu deploy static host, app mặc định gọi trực tiếp Pollinations để tránh `/api/chat` 404.
- Nếu deploy trên Vercel và muốn ưu tiên serverless route, set `VITE_USE_LOCAL_API=true`.
- Cần set `ELEVENLABS_API_KEY` (Project Settings -> Environment Variables) để bật giọng ElevenLabs.
- Có thể tùy chọn `ELEVENLABS_VOICE_ID` (server) hoặc `VITE_ELEVENLABS_VOICE_ID` (client) để đổi voice ID.
## Deploy notes

- Đã nhúng Puter SDK ở `index.html` qua `https://js.puter.com/v2/`.
- Có thể tắt Puter và dùng Pollinations bằng cách set `VITE_USE_PUTER_GEMINI=false`.
- Có thể set `VITE_TEXT_API_BASE` (ví dụ: `https://text.pollinations.ai`) để đổi text endpoint.
- Nếu deploy static host, app mặc định gọi trực tiếp Pollinations để tránh `/api/chat` 404.
- Nếu deploy trên Vercel và muốn ưu tiên serverless route, set `VITE_USE_LOCAL_API=true`.
- Cần set `ELEVENLABS_API_KEY` (Project Settings -> Environment Variables) để bật giọng ElevenLabs.
- Có thể tùy chọn `ELEVENLABS_VOICE_ID` (server) hoặc `VITE_ELEVENLABS_VOICE_ID` (client) để đổi voice ID.
App mặc định gọi trực tiếp Pollinations để tránh lỗi `/api/chat` 404 trên static host.

Nếu deploy trên Vercel và muốn ưu tiên serverless route, set `VITE_USE_LOCAL_API=true`.

## Deploy notes

- Không cần cấu hình `GEMINI_API_KEY` nữa.
- Có thể set `VITE_TEXT_API_BASE` (ví dụ: `https://text.pollinations.ai`) để đổi text endpoint.
- Cần set `ELEVENLABS_API_KEY` (Project Settings -> Environment Variables trên Vercel) để bật giọng ElevenLabs.
- Nếu ElevenLabs server lỗi/quá hạn mức, app sẽ fallback client-side qua Puter ElevenLabs với voice ID `jdlxsPOZOHdGEfcItXVu` (không dùng Web Speech).
- Nếu ElevenLabs lỗi/quá hạn mức, app sẽ fallback server-side sang Google Translate TTS (giọng tiếng Việt miễn phí).


## Troubleshooting: npm install bị chặn (403)

Nếu gặp lỗi kiểu `npm install ...` trả về `403 Forbidden` như môi trường này, nguyên nhân thường là proxy/chính sách registry của hệ thống đang chặn tải package mới.

Các bước kiểm tra nhanh:

```bash
npm config list
npm config get registry
npm view @elevenlabs/elevenlabs-js version
```

Cách xử lý:

1. Nếu bạn có quyền sửa proxy nội bộ, bỏ proxy rồi thử lại:

```bash
npm config delete proxy
npm config delete https-proxy
unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy
npm install
```

2. Nếu công ty dùng policy chặn từ registry, cần nhờ admin **allowlist** package (`@elevenlabs/elevenlabs-js`) hoặc mirror vào private registry.

3. Trong lúc chờ mở policy, app này đã hỗ trợ gọi ElevenLabs qua REST API server-side (`api/tts.ts`) và fallback Puter ElevenLabs client-side nên **không bắt buộc** phải cài SDK để chạy được TTS.
3. Trong lúc chờ mở policy, app này đã hỗ trợ gọi ElevenLabs qua REST API server-side (`api/tts.ts`) nên **không bắt buộc** phải cài SDK để chạy được TTS.
