# K2

의과대학 시설 예약 어플리케이션

<img width="981" height="1283" alt="그림01" src="https://github.com/user-attachments/assets/20a1cbb6-b601-4876-ae9f-f09eebaf2501" />


## Stack

- Next.js App Router
- Tailwind CSS
- Supabase Auth, Database, Realtime
- Lucide React
- Pretendard

## Folder Structure

```txt
app/
  auth/callback/route.ts      # Google OAuth 콜백, 도메인 검사, profiles upsert
  auth/sign-out/route.ts      # 로그아웃
  login/page.tsx              # 로그인 화면
  actions.ts                  # 예약 생성 Server Action
  page.tsx                    # 서버 컴포넌트 메인 화면
components/
  reservation-app.tsx         # 시설/날짜/시간 선택 클라이언트 UI
  login-button.tsx
  logout-button.tsx
lib/
  supabase/                   # SSR/browser/proxy 클라이언트
  auth.ts                     # 학교 이메일 도메인 검사
  date.ts                     # 내장 Date 기반 날짜 유틸
supabase/schema.sql           # 테이블, RLS, 시설 seed, Auth Hook 함수
```

## Local Run

```bash
npm install
cp .env.example .env.local
npm run dev
```

`.env.local`에는 Supabase Project URL과 publishable key를 넣습니다.

## Supabase Setup

1. `supabase/schema.sql`을 Supabase SQL Editor에서 실행합니다.
2. Database > Replication에서 `public.reservations` Realtime 상태를 확인합니다.
3. Authentication > Providers에서 Google Provider를 활성화합니다.
4. Google OAuth redirect URL에 `https://<project-ref>.supabase.co/auth/v1/callback`을 등록합니다.
5. Authentication > URL Configuration에 배포 도메인과 로컬 주소를 등록합니다.
6. Authentication > Hooks에서 `Before User Created`를 켜고 아래 Postgres function URI를 연결합니다.

```txt
pg-functions://postgres/public/enforce_med_kku_email_domain
```

앱 콜백에서도 `@med.kku.ac.kr`를 검사하지만, 위 Auth Hook까지 연결해야 Supabase Auth 사용자 생성 단계에서 비학교 계정을 차단할 수 있습니다.
