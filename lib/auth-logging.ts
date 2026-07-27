import { authRequestDetails } from "@/lib/auth-routing";

type SafeValue = string | number | boolean | null;

function emit(level: "info" | "warn" | "error", event: string, fields: Record<string, SafeValue>) {
  console[level](`[auth] ${JSON.stringify({ event, ...fields })}`);
}

export function logAuthRequest(requestUrl: string) {
  const url = new URL(requestUrl, "https://auth.invalid");
  const details = authRequestDetails(url.pathname);
  emit("info", "request", {
    ...details,
    provider: details.provider ?? url.searchParams.get("provider"),
    hasAuthSecret: Boolean(process.env.AUTH_SECRET),
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    hasEmailFrom: Boolean(process.env.EMAIL_FROM),
    hasResendApiKey: Boolean(process.env.RESEND_API_KEY || process.env.AUTH_RESEND_KEY),
  });
}

export function logResendResponse(status: number | null, safeMessage: string | null) {
  emit(status !== null && status >= 200 && status < 300 ? "info" : "error", "resend-response", {
    action: "signin",
    internalBasePath: "/api/auth",
    provider: "resend",
    resendStatus: status,
    resendMessage: safeMessage,
    hasEmailFrom: Boolean(process.env.EMAIL_FROM),
    hasResendApiKey: Boolean(process.env.RESEND_API_KEY || process.env.AUTH_RESEND_KEY),
  });
}

export function safeAuthError(error: unknown) {
  const candidate = error as { type?: unknown; name?: unknown; message?: unknown };
  const errorClass =
    typeof candidate?.type === "string"
      ? candidate.type
      : typeof candidate?.name === "string"
        ? candidate.name
        : "AuthError";
  const message =
    typeof candidate?.message === "string"
      ? candidate.message.replace(/https?:\/\/\S+/gi, "[redacted-url]").slice(0, 300)
      : "Authentication request failed";
  return { errorClass, message };
}
