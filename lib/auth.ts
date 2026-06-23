import type { User } from "@supabase/supabase-js";

export const SCHOOL_EMAIL_DOMAIN = "@med.kku.ac.kr";

export function isAllowedSchoolEmail(email?: string | null) {
  return email?.trim().toLowerCase().endsWith(SCHOOL_EMAIL_DOMAIN) ?? false;
}

export function getUserDisplayName(user: User) {
  const metadata = user.user_metadata as {
    full_name?: string;
    name?: string;
    preferred_username?: string;
  };

  return (
    metadata.full_name?.trim() ||
    metadata.name?.trim() ||
    metadata.preferred_username?.trim() ||
    user.email?.split("@")[0] ||
    "사용자"
  );
}
