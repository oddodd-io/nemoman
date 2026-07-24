# 네모맨 견적 백엔드 — 남은 작업 (집에서 이어서)

> 최종 업데이트: 2026-07-24
> 배포 주소: **https://nemoman.pages.dev**
> 저장소: oddodd-io/nemoman (main에 push하면 Cloudflare Pages 자동 배포)

---

## ✅ 지금까지 완료된 것
- [x] Cloudflare Pages ↔ GitHub 연결 (push마다 자동 배포)
- [x] 정적 사이트 배포 (홈 / 간편견적 / 관리자 페이지)
- [x] D1 데이터베이스 `nemoman-db` 생성 + `estimates` 테이블
- [x] D1 바인딩 연결 (wrangler.toml, 변수명 `DB`)
- [x] 견적 수신 API `/api/estimate` 배포 (→ D1 저장)
- [x] 관리자 API `/api/admin/estimates` 배포 (Basic 인증)
- [x] `ADMIN_PASSWORD` Secret 등록 + 재배포 → 관리자 로그인 활성화

**즉, 견적 저장 + 관리자 조회는 이미 동작 상태.** 문자 알림만 남음.

---

## ☐ 1. 엔드투엔드 테스트 (제일 먼저, 5분)
집에서 제일 먼저 이것부터 확인:

1. https://nemoman.pages.dev/estimate.html 접속
2. 계산기 입력 → 예상비용 계산 → **견적 신청 제출** (본인 정보로 1건)
3. https://nemoman.pages.dev/admin.html 접속
4. **ADMIN_PASSWORD**(Cloudflare에 등록한 비번)로 로그인
5. 방금 넣은 견적이 목록에 보이면 → 저장/조회 완전 성공 ✅

> 테스트로 넣은 견적은 나중에 관리자 화면이나 D1 콘솔(`DELETE FROM estimates WHERE id=?`)에서 삭제 가능.

---

## ☐ 2. 문자(SMS) 알림 붙이기 — 견적 들어오면 사장님 폰으로 즉시 알림

### 2-1. 솔라피(SOLAPI) 준비 — https://solapi.com
- [ ] 회원가입
- [ ] **발신번호 사전등록** (사업자/대표 명의 번호, 통신사 인증 — **법적 필수, 승인에 시간 걸림**)
- [ ] API Key / API Secret 발급 (콘솔 → 개발/연동)
- [ ] 잔액 충전(문자 발송은 건당 실비)

### 2-2. Cloudflare에 Secret 4개 등록
Pages → nemoman → **Settings → Variables and secrets → Add** (Type: **Secret**)

| Name | 값 |
|---|---|
| `SOLAPI_API_KEY` | 솔라피 API Key |
| `SOLAPI_API_SECRET` | 솔라피 API Secret |
| `OWNER_PHONE` | 알림 받을 번호 (예: 01020106784) |
| `SENDER_PHONE` | 솔라피에 등록한 발신번호 |

### 2-3. 재배포
Deployments → 맨 위 배포 → **⋯ → Retry deployment**
(환경변수/시크릿 변경은 재배포해야 적용됨)

### 2-4. 테스트
견적 신청 한 건 넣고 → **OWNER_PHONE으로 문자 오는지** 확인.
- 문자 형식: `[네모맨 견적문의] 이름/연락처 지역·건물·평수·범위 예상 OO~OO만원`
- 코드 위치: `functions/api/estimate.js` 의 `sendSolapiSms()`

> 발신번호 등록 전에도 견적 저장은 정상 동작함. 문자만 안 갈 뿐.

---

## ☐ 3. (선택) 스팸 차단 — Turnstile
견적 폼에 스팸/장난 제출이 많아지면:
- [ ] Cloudflare → Turnstile → 위젯 생성 (Site Key / Secret Key)
- [ ] `estimate.html` 폼에 위젯 추가 + 제출 시 토큰 전송
- [ ] Secret `TURNSTILE_SECRET` 등록 (등록만 하면 서버는 자동 검증하도록 이미 코드에 훅 있음)
- [ ] 재배포

> 지금은 없어도 됨. 스팸 생기면 그때.

---

## ☐ 4. (선택) 도메인 연결
`nemoman.pages.dev` 대신 실제 도메인(예: nemoman.co.kr)을 쓰려면:
- [ ] 도메인 구매
- [ ] Pages → nemoman → **Custom domains → Set up a custom domain**
- [ ] DNS 안내대로 설정

---

## ☐ 5. (나중에) 개선 아이디어
- [ ] 관리자 목록에 **상태 표시**(연락완료/견적발송/계약) 체크·메모 기능
- [ ] 신청자에게도 **접수 확인 문자** 자동발송
- [ ] 정부지원 자가진단 페이지 (page/support.html 초안 있음)
- [ ] 시공사례 페이지 (실제 시공 사진 쌓인 뒤)

---

## 참고: 로컬에서 백엔드 테스트하는 법
```bash
npm i -g wrangler
wrangler login
wrangler pages dev .        # http://localhost:8788 에서 Functions 포함 실행
```
- 로컬 D1: `wrangler d1 execute nemoman-db --local --file=schema.sql`
- 자세한 내용은 **BACKEND.md** 참고

## 주요 파일
| 파일 | 역할 |
|---|---|
| `functions/api/estimate.js` | 견적 수신 → D1 저장 → SMS |
| `functions/api/admin/estimates.js` | 견적 목록 조회 (Basic 인증) |
| `admin.html` | 관리자 페이지 |
| `estimate.html` / `estimate.css` / `estimate.js` | 간편견적 폼·계산기 |
| `wrangler.toml` | Pages·D1 바인딩 설정 |
| `schema.sql` | D1 테이블 정의 |
| `BACKEND.md` | 배포·연동 상세 가이드 |

## 계정/식별자 메모
- Cloudflare 계정: eehd80yul@gmail.com
- D1 database_id: `0f4bb34b-4e82-4b11-8b88-3caa3fc95ec2` (비밀 아님)
- GitHub 저장소는 hanui-o 계정 권한으로 push (이 PC는 저장소 로컬설정으로 고정됨)
- ⚠️ SOLAPI 키·ADMIN_PASSWORD 등 **비밀값은 절대 코드/이 문서에 적지 말 것** → Cloudflare Secret으로만
