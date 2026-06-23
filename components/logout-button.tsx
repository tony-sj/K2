"use client";

import { LogOut } from "lucide-react";

export function LogoutButton() {
  return (
    <button
      type="button"
      onClick={() => {
        window.location.href = "/auth/sign-out";
      }}
      title="로그아웃"
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 transition hover:bg-zinc-50 active:scale-95"
    >
      <LogOut aria-hidden="true" className="h-4 w-4" />
      <span className="sr-only">로그아웃</span>
    </button>
  );
}
