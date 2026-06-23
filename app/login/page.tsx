import { redirect } from "next/navigation";
import { isAllowedSchoolEmail } from "@/lib/auth";
import { hasSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { LoginButton } from "@/components/login-button";
import { SetupNotice } from "@/components/setup-notice";

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

const ERROR_MESSAGES: Record<string, string> = {
  auth: "로그인 처리 중 문제가 발생했습니다.",
  domain: "@med.kku.ac.kr 계정만 사용할 수 있습니다.",
  profile: "프로필 동기화에 실패했습니다."
};

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: LoginPageProps) {
  if (!hasSupabaseEnv()) {
    return <SetupNotice />;
  }

  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (user && isAllowedSchoolEmail(user.email)) {
    redirect("/");
  }

  if (user && !isAllowedSchoolEmail(user.email)) {
    redirect("/auth/sign-out?reason=domain");
  }

  const errorMessage = params?.error ? ERROR_MESSAGES[params.error] : undefined;

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
          <p className="mt-8 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-950">
            {errorMessage}
          </p>
        ) : null}

        <div className="mt-8">
          <LoginButton />
        </div>
      </section>
    </main>
  );
}
