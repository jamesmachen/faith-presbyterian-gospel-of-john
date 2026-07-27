import { BASE_PATH, withBasePath } from "@/lib/base-path";

export const AUTH_INTERNAL_BASE_PATH = "/api/auth";
export const AUTH_PROVIDER = "resend";

export function publicizeAuthUrl(url: string) {
  const parsed = new URL(url);
  if (
    parsed.pathname === AUTH_INTERNAL_BASE_PATH ||
    parsed.pathname.startsWith(`${AUTH_INTERNAL_BASE_PATH}/`)
  ) {
    parsed.pathname = withBasePath(parsed.pathname);
  }
  return parsed.toString();
}

export function publicizeAuthResponse(response: Response) {
  const location = response.headers.get("location");
  if (!location) return response;

  const parsed = new URL(location, "https://auth.invalid");
  const isInternalAuthPath =
    parsed.pathname === AUTH_INTERNAL_BASE_PATH ||
    parsed.pathname.startsWith(`${AUTH_INTERNAL_BASE_PATH}/`);
  const isInternalCustomPage =
    parsed.pathname === "/admin/signin" || parsed.pathname === "/admin/verify";

  if (!isInternalAuthPath && !isInternalCustomPage) return response;

  const headers = new Headers(response.headers);
  const publicPath = withBasePath(parsed.pathname);
  headers.set(
    "location",
    location.startsWith("http")
      ? `${parsed.origin}${publicPath}${parsed.search}${parsed.hash}`
      : `${publicPath}${parsed.search}${parsed.hash}`,
  );
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function authRequestDetails(pathname: string) {
  const internalPathname =
    pathname === BASE_PATH || pathname.startsWith(`${BASE_PATH}/`)
      ? pathname.slice(BASE_PATH.length) || "/"
      : pathname;
  const remainder = internalPathname.startsWith(`${AUTH_INTERNAL_BASE_PATH}/`)
    ? internalPathname.slice(AUTH_INTERNAL_BASE_PATH.length + 1)
    : "";
  const [action, providerFromPath] = remainder.split("/");

  return {
    action: action || "unknown",
    internalBasePath: AUTH_INTERNAL_BASE_PATH,
    requestPathname: internalPathname,
    provider: providerFromPath || null,
  };
}

export function isSuccessfulEmailSignInResult(result: string | undefined) {
  if (!result) return false;
  try {
    return new URL(result, "https://auth.invalid").pathname ===
      `${AUTH_INTERNAL_BASE_PATH}/verify-request`;
  } catch {
    return false;
  }
}
