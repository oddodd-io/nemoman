# 네모맨 철거 · 공간f5

폐업 소상공인을 위한 **정부지원 연계 철거** 원페이지 사이트.

> 비움에도 기술이 있습니다.

- **공간f5** — 모브랜드 (인테리어)
- **네모맨** — 철거 부문 (이 사이트)

## 구조
- `index.html` · `styles.css` — 메인 페이지
- `estimate.html` — 철거 간편견적
- `consult.html` — 상담 신청 (욕실·철거·기타 / 사진 첨부 · `?type=bath|demo` 로 종류 사전선택) → 백엔드는 `BACKEND.md`
- `assets/` — 네모맨 마스코트 이미지
- `docs/` — 기획서 · 사이트맵 · 작업계획 · 디자인브리프

## 로컬 실행
```bash
python3 -m http.server 8145
# → http://localhost:8145
```
