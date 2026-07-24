# 견적문의 백엔드 (Cloudflare Pages Functions + D1 + SOLAPI SMS)

견적 신청이 들어오면 **D1에 저장**하고 **사장님 휴대폰으로 SMS 즉시 알림**을 보냅니다.

```
[estimate.html 폼] → POST /api/estimate
   → functions/api/estimate.js
       ├─ D1(estimates) 저장
       └─ SOLAPI 문자 발송 (사장님 알림)
```

## 구성 파일
| 파일 | 역할 |
|---|---|
| `functions/api/estimate.js` | 폼 수신 API (Pages Function) |
| `functions/api/admin/estimates.js` | 견적 목록 조회 API (Basic 인증) |
| `admin.html` | 관리자 페이지 — 비밀번호 로그인 후 목록 표시 |
| `schema.sql` | D1 테이블 정의 |
| `wrangler.toml` | Pages/D1 설정 |
| `estimate.js` | 프런트 — `/api/estimate`로 POST |

---

## 사전 준비 (본인이 직접 해야 하는 것)
1. **Cloudflare 계정** + 이 GitHub 저장소 연결
2. **SOLAPI(솔라피) 계정** — https://solapi.com
   - API Key / API Secret 발급
   - **발신번호 사전등록**(필수·법적 의무): 사장님/사업자 명의 번호를 솔라피에 등록·인증
3. (선택) **Turnstile** 위젯 — 스팸이 심하면 추가

> ⚠️ 문자 발송은 발신번호 등록이 끝나야 동작합니다. 등록 전에는 저장(D1)만 됩니다.
> Cloudflare·솔라피 가격/정책은 바뀔 수 있으니 배포 전 공식 문서로 최신 한도를 확인하세요.

---

## 배포 절차

```bash
# 0) Wrangler 설치 & 로그인
npm i -g wrangler
wrangler login

# 1) D1 생성 (대시보드 Storage & databases → D1 → Create 로 만들어도 됨)
wrangler d1 create nemoman-db

# 2) 테이블 생성 (원격)
wrangler d1 execute nemoman-db --remote --file=schema.sql

# 3) D1을 Pages에 바인딩 (대시보드)
#    Pages → nemoman → Settings → Functions → D1 database bindings
#      Variable name: DB   /   D1 database: nemoman-db
#    ※ wrangler.toml 에 database_id 를 넣지 않습니다 (대시보드 바인딩 사용)

# 3) Pages 프로젝트에 비밀값 등록
wrangler pages secret put SOLAPI_API_KEY
wrangler pages secret put SOLAPI_API_SECRET
wrangler pages secret put OWNER_PHONE      # 알림 받을 번호 01000000000
wrangler pages secret put SENDER_PHONE     # 솔라피 등록 발신번호 01000000000
wrangler pages secret put ADMIN_PASSWORD   # 관리자 페이지 비밀번호
# (선택) wrangler pages secret put TURNSTILE_SECRET

# 4) 배포
wrangler pages deploy .
```

또는 **대시보드 방식**(더 쉬움): Cloudflare → Pages → *Create* → 이 GitHub 저장소 선택 →
빌드 설정 없음(정적) → 배포. 이후 Settings에서 D1 바인딩(`DB`)과 위 환경변수(Secret)를 등록.
GitHub에 push할 때마다 자동 재배포됩니다.

---

## 저장된 견적 조회

### 방법 1) 관리자 페이지 (권장)
`https://<배포도메인>/admin.html` 접속 → `ADMIN_PASSWORD`로 로그인 → 목록·연락처·예상견적 확인.
- 인증은 Basic 방식(HTTPS 위에서 동작), 세션 동안만 브라우저에 유지됩니다.
- 검색엔진 비노출(`noindex`) 처리됨.
- 더 강한 보안이 필요하면 Cloudflare **Access**(무료, 이메일 OTP)를 `/admin.html` 앞단에 걸어두는 것을 권장합니다.

### 방법 2) CLI 직접 조회
```bash
wrangler d1 execute nemoman-db --remote \
  --command "SELECT id, created_at, name, phone, region, est_min, est_max FROM estimates ORDER BY id DESC LIMIT 20"
```

---

## 로컬 테스트
```bash
# D1 로컬 DB에 스키마 적용 후 로컬 서버
wrangler d1 execute nemoman-db --local --file=schema.sql
wrangler pages dev .
# http://localhost:8788/estimate.html 에서 신청 → 콘솔에서 확인
```
비밀값이 없으면 문자 발송은 건너뛰고 저장/응답만 됩니다(정상).

## 비용 (참고, 변동 가능)
- Cloudflare Pages·Functions·D1: 소상공인 트래픽 규모면 **무료 티어**로 충분
- SMS: 솔라피 건당 실비(단문 약 8~9원, 장문 약 30원 안팎)
