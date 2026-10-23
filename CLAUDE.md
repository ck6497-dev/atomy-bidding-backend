# CLAUDE.md — Atomy Bidding

Claude Code가 이 저장소에서 작업할 때 매번 읽는 안내서. 사용자(ck6497@atomypark.com, 슈퍼관리자)는 비개발자이므로 **한국어로, 쉬운 말로** 설명할 것.
이 파일에는 비밀값을 절대 적지 않는다. 실제 값은 로컬 `.env`와 Render 대시보드에만 있다.

## 시스템 개요

Atomy 해상 스팟 운임 입찰 관리 웹 시스템. 슈퍼관리자가 입찰을 만들고, 포워더(영업사원)가 운임을 입력·최종제출한다.

| 구분 | 기술 |
|---|---|
| 프론트엔드 | Vite + Vanilla JS (`src/`). 빌드 결과 `dist/`를 Express가 같이 서빙 |
| 백엔드 | Node.js + Express 5, `server.js` 한 파일에 API 전체 |
| DB | **Supabase PostgreSQL** (서울, pooler 6543). 코드 주석의 "Neon"은 옛 흔적 — 8/18에 Supabase로 이전함 |
| 배포 | Render.com — `main` push 시 자동 배포. 서비스 주소 https://atomy-bidding-backend.onrender.com |
| 이메일 | **EmailJS** (`@emailjs/nodejs`). Gmail SMTP/Nodemailer는 사용 안 함 |
| 인증 | JWT 12시간 |

## 명령어

- `npm run dev` — 프론트 :3000 + API :3001 동시 실행 (Vite가 `/api`를 3001로 프록시)
- `npm run build` — `dist/` 빌드 (Render는 배포 시 자동 빌드)
- `npm start` — 운영용 서버 실행
- 로컬 개발도 **운영 DB(Supabase)에 연결됨**. 테스트 중 데이터 생성·삭제는 실제 데이터에 반영되므로 주의하고, 쓰기 작업 테스트 전에는 사용자에게 확인할 것.

## 환경변수 (`server.js`가 읽는 것)

필수: `DATABASE_URL`, `JWT_SECRET`, `EMAILJS_SERVICE_ID`, `EMAILJS_TEMPLATE_ID`, `EMAILJS_PUBLIC_KEY`, `EMAILJS_PRIVATE_KEY`
권장: `SUPER_ADMIN_PASSWORD`, `DEFAULT_INITIAL_PASSWORD` (값에 `#` 포함 → `.env`에서는 따옴표로 감쌀 것)
선택: `ALLOWED_ORIGINS`(추가 CORS 도메인, 쉼표 구분), `PORT`
미사용: `GMAIL_USER`, `GMAIL_PASS` (Render에 남아 있지만 코드에서 안 씀)

환경변수를 새로 추가하면 **로컬 `.env`와 Render 대시보드 양쪽**에 넣어야 한다고 사용자에게 안내할 것.

## 권한 체계 (코드 기준)

| 기능 | 권한 |
|---|---|
| 포워더·노선·입찰 생성/수정/삭제, 최종제출 취소(revoke), 관리자 계정 관리(`/api/admins`, `#/admins`) | **super_admin 전용** (`requireSuperAdmin`) |
| 운임 조회/저장/최종제출, 노선·포워더·입찰 조회, 메일 발송 | 로그인한 누구나 (포워더는 본인 데이터만) |

사용자 방침: **관리 기능은 슈퍼관리자만 가능해야 한다.** 새 관리 API를 만들 때 서버(`requireSuperAdmin`)와 화면 라우트 가드(`src/main.js`의 `withLayout(..., 'super_admin')`) 둘 다 막을 것. 메뉴 숨김만으로는 부족함.

## 파일 구조

```
server.js          API 전체 + DB 테이블 자동 생성/마이그레이션 + dist 서빙
src/main.js        라우트 등록 + 권한 가드(withLayout)
src/router.js      해시 라우터
src/store.js       API 호출 함수 모음, 세션(isAdmin/isSuperAdmin/isForwarder)
src/pages/         Login, Dashboard, Bidding, Forwarders, Routes, RateEntry, Admins
src/components/    DataGrid(운임 입력 그리드), Header, Sidebar(메뉴), Modal, Toast, MomComparisonModal, RouteChartModal
```

DB 테이블(`users`, `forwarders`, `routes`, `biddings`, `rates`)은 서버 시작 시 `CREATE TABLE IF NOT EXISTS`로 생성. 입찰 자동 마감은 `GET /api/biddings` 조회 시점과 서버 시작 시 1회 처리(마감일 다음날 0시 기준).

## 서버 재시작 시 동작 (중요)

- 슈퍼관리자(`ck6497@atomypark.com`, 코드에 하드코딩) 비밀번호를 `SUPER_ADMIN_PASSWORD`로 **매번 덮어씀**. → push(=Render 재배포)하면 슈퍼관리자 비번이 초기화되므로, 배포 전 사용자에게 알릴 것.
- 일반 관리자·비번 바꾼 포워더 계정은 건드리지 않음. 첫 로그인 전 포워더만 초기 비번으로 재설정.

## 작업 방식 (사용자와 합의)

1. 로컬에서 수정 → 가능하면 `npm run dev`로 확인 → 커밋 → `git push origin main` → Render 자동 배포
2. **push = 운영 배포**이므로 push 전에 반드시 사용자 확인을 받을 것
3. 앱 동작과 무관한 변경(문서 등)은 커밋 메시지에 `[skip render]`를 넣어 재배포를 막을 것
4. 배포 후 사용자에게 Render 대시보드 → Events에서 **Live** 확인을 부탁할 것
5. 변경 이력은 아래 표에 한 줄씩 추가할 것

## 알려진 문제 / 개선 후보 (사용자가 요청하면 진행)

1. 슈퍼관리자 비번이 재시작마다 초기화됨 (위 참조). 수정 방향: 계정이 없을 때만 생성
2. 서버 시작 로그에 슈퍼관리자 초기 비번이 평문으로 출력됨
3. Render의 `DEFAULT_INITIAL_PASSWORD`가 따옴표째 들어가 있을 수 있음 — 신규 계정 로그인 확인 필요
4. `/health`는 DB 상태를 확인하지 않음 (항상 ok)
5. Render `NODE_VERSION=18` → 20/22로 올리는 것 권장
6. `server.js` 주석의 "Neon DB" 문구 정리

## 하지 말 것

- 비밀값 재발급(키 교체)은 사용자가 **진행하지 않기로 결정함 (2026-10-15)**. 다시 권하지 말 것.
- `.env`를 커밋하지 말 것 (`.gitignore`에 등록되어 있음). 비밀값을 코드·문서·커밋 메시지에 쓰지 말 것.

## 변경 이력

| 날짜 | 커밋 | 내용 |
|---|---|---|
| 2026-10-15 | `7881a29` | 관리자(팀원) 계정 관리를 슈퍼관리자 전용으로 제한 (`/api/admins` 3개 + `#/admins` 화면 가드) |
| 2026-10-23 | — | CLAUDE.md 추가 (이전 툴에서 Claude Code로 이관) |
