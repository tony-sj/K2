"use client";

import { LogIn } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function LoginButton() {
  const handleLogin = async () => {
    const supabase = createClient();
    const origin = window.location.origin;

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback`,
        queryParams: {
          hd: "med.kku.ac.kr"
        }
      }
    });
  };

  return (
    <button
      type="button"
      onClick={handleLogin}
      className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 text-[15px] font-semibold text-white shadow-soft transition active:scale-[0.99]"
    >
      <LogIn aria-hidden="true" className="h-4 w-4" />
      Google 계정으로 로그인
    </button>
  );
}
