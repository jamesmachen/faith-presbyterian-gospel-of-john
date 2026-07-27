import Resend from "next-auth/providers/resend";
import { logResendResponse } from "@/lib/auth-logging";
import { publicizeAuthUrl } from "@/lib/auth-routing";

type FetchImplementation = typeof fetch;

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

function safeResendMessage(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const value = record.message ?? record.error;
  return typeof value === "string" ? value.slice(0, 300) : null;
}

export function createResendProvider(fetchImplementation: FetchImplementation = fetch) {
  const provider = Resend({
    apiKey: process.env.RESEND_API_KEY ?? process.env.AUTH_RESEND_KEY,
    from: process.env.EMAIL_FROM,
    maxAge: 15 * 60,
  });

  provider.sendVerificationRequest = async ({ identifier, provider: configuredProvider, url }) => {
    const publicUrl = publicizeAuthUrl(url);
    const host = new URL(publicUrl).host;
    let response: Response;

    try {
      response = await fetchImplementation("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${configuredProvider.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: configuredProvider.from,
          to: identifier,
          subject: `Sign in to ${host}`,
          html: `<p>Sign in to Faith Presbyterian Sunday School:</p><p><a href="${escapeHtml(publicUrl)}">Sign in</a></p><p>This link expires in 15 minutes and can only be used once.</p>`,
          text: `Sign in to Faith Presbyterian Sunday School:\n${publicUrl}\n\nThis link expires in 15 minutes and can only be used once.`,
        }),
      });
    } catch (error) {
      logResendResponse(null, error instanceof Error ? error.message.slice(0, 300) : "Network request failed");
      throw new Error("Resend request failed.");
    }

    const payload = await response.json().catch(() => null);
    const message = safeResendMessage(payload);
    logResendResponse(response.status, message);

    if (!response.ok) {
      throw new Error(`Resend email request failed with HTTP ${response.status}${message ? `: ${message}` : ""}`);
    }
  };

  return provider;
}

