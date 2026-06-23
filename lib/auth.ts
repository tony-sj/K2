import type { User } from "@supabase/supabase-js";

export const SCHOOL_EMAIL_DOMAIN = "@med.kku.ac.kr";
export const ADMIN_EMAIL = "dev@med.kku.ac.kr";

export function isAllowedSchoolEmail(email?: string | null) {
  return email?.trim().toLowerCase().endsWith(SCHOOL_EMAIL_DOMAIN) ?? false;
}

export function isAdminEmail(email?: string | null) {
  return email?.trim().toLowerCase() === ADMIN_EMAIL;
}

export function getUserDisplayName(user: User) {
  const metadata = user.user_metadata as {
    family_name?: string;
    full_name?: string;
    given_name?: string;
    name?: string;
    preferred_username?: string;
  };

  const familyGivenName = [metadata.family_name, metadata.given_name]
    .filter(Boolean)
    .join("")
    .trim();

  return (
    metadata.full_name?.trim() ||
    metadata.name?.trim() ||
    familyGivenName ||
    metadata.preferred_username?.trim() ||
    user.email?.split("@")[0] ||
    "사용자"
  );
}
