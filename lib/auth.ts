import type { User } from "@supabase/supabase-js";

export const SCHOOL_EMAIL_DOMAIN = "@med.kku.ac.kr";
export const ADMIN_EMAIL = "dev@med.kku.ac.kr";

export function isAllowedSchoolEmail(email?: string | null) {
  return email?.trim().toLowerCase().endsWith(SCHOOL_EMAIL_DOMAIN) ?? false;
}

export function isAdminEmail(email?: string | null) {
  return email?.trim().toLowerCase() === ADMIN_EMAIL;
}

type DisplayNameSource = {
  email?: string | null;
  user_metadata?: {
    family_name?: string;
    full_name?: string;
    given_name?: string;
    name?: string;
    preferred_username?: string;
  } | null;
};

function getDisplayName(source: DisplayNameSource) {
  const metadata = source.user_metadata ?? {};

  const familyGivenName = [metadata.family_name, metadata.given_name]
    .filter(Boolean)
    .join("")
    .trim();

  return (
    metadata.full_name?.trim() ||
    metadata.name?.trim() ||
    familyGivenName ||
    metadata.preferred_username?.trim() ||
    source.email?.split("@")[0] ||
    "사용자"
  );
}

export function getUserDisplayName(user: User) {
  return getDisplayName(user);
}

export function getClaimsDisplayName(claims: DisplayNameSource) {
  return getDisplayName(claims);
}
