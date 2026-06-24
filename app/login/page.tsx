import { redirect } from "next/navigation";
import { isAllowedSchoolEmail } from "@/lib/auth";
import { hasSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { LoginButton } from "@/components/login-button";
import { SetupNotice } from "@/components/setup-notice";

type LoginPageProps = {
  searchParams?: Promise<{
    detail?: string;
    error?: string;
  }>;
};

const ERROR_MESSAGES: Record<string, string> = {
  auth: "로그인 처리 중 문제가 발생했습니다.",
  domain: "@med.kku.ac.kr 계정만 사용할 수 있습니다.",
  exchange: "로그인 세션을 만드는 중 문제가 발생했습니다.",
  missing_code: "인증 코드가 돌아오지 않았습니다. Supabase Redirect URL 설정을 확인해 주세요.",
  oauth: "Google OAuth 인증이 완료되지 않았습니다.",
  profile: "프로필 동기화에 실패했습니다."
};

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: LoginPageProps) {
  if (!hasSupabaseEnv()) {
    return <SetupNotice />;
  }

  const params = await searchParams;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  const email = claims?.email ?? "";

  if (claims?.sub && isAllowedSchoolEmail(email)) {
    redirect("/");
  }

  if (claims?.sub && !isAllowedSchoolEmail(email)) {
    redirect("/auth/sign-out?reason=domain");
  }

  const errorMessage = params?.error ? ERROR_MESSAGES[params.error] : undefined;
  const errorDetail = params?.detail;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-white px-5">
      <section className="flex flex-1 flex-col justify-center py-10">
        <p className="text-[13px] font-semibold text-teal-700">K2 시설 예약</p>
        <h1 className="mt-2 text-3xl font-bold tracking-normal text-zinc-950">
          의과대학 시설 예약
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          학교 Google 계정으로 로그인해 PBL실과 강의실을 예약하세요.
        </p>

        {errorMessage ? (
          <div className="mt-8 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <p className="font-semibold">{errorMessage}</p>
            {errorDetail ? (
              <p className="mt-2 break-words text-xs leading-5 text-amber-900">
                {errorDetail}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-8">
          <LoginButton />
        </div>
      </section>
    </main>
  );
}
