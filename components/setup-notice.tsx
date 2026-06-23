export function SetupNotice() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-white px-5 py-10">
      <div className="mt-14 rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-950">
        <p className="font-semibold">Supabase 환경 변수가 필요합니다.</p>
        <p className="mt-2">
          `.env.local`에 `NEXT_PUBLIC_SUPABASE_URL`과
          `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`를 설정한 뒤 다시 실행해 주세요.
        </p>
      </div>
    </main>
  );
}
