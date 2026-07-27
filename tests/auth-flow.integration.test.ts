import assert from "node:assert/strict";
import test from "node:test";
import { Auth, skipCSRFCheck } from "@auth/core";
import type { Adapter } from "@auth/core/adapters";
import { createResendProvider } from "../lib/resend-provider";
import {
  AUTH_INTERNAL_BASE_PATH,
  authRequestDetails,
  isSuccessfulEmailSignInResult,
  publicizeAuthUrl,
  publicizeAuthResponse,
} from "../lib/auth-routing";

function memoryAdapter() {
  const verificationTokens: unknown[] = [];
  const adapter = {
    async getUserByEmail() {
      return null;
    },
    async createVerificationToken(token) {
      verificationTokens.push(token);
      return token;
    },
    async useVerificationToken() {
      return null;
    },
  } as Adapter;
  return { adapter, verificationTokens };
}

async function postEmailSignIn(fetchImplementation: typeof fetch) {
  const { adapter, verificationTokens } = memoryAdapter();
  const response = await Auth(
    new Request("https://silasfaithpres.org/api/auth/signin/resend", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        email: "administrator@example.com",
        callbackUrl: "https://silasfaithpres.org/sunday-school/admin",
      }),
    }),
    {
      adapter,
      basePath: AUTH_INTERNAL_BASE_PATH,
      providers: [createResendProvider(fetchImplementation)],
      secret: "integration-test-secret-integration-test-secret",
      skipCSRFCheck,
      trustHost: true,
      pages: {
        signIn: "/admin/signin",
        verifyRequest: "/admin/verify",
        error: "/admin/signin",
      },
    },
  );
  return { response, verificationTokens };
}

test("POST email sign-in invokes Resend and produces the friendly verification redirect", async () => {
  process.env.RESEND_API_KEY = "re_integration_test";
  process.env.EMAIL_FROM = "Sunday School <sunday-school@silasfaithpres.org>";
  const requests: Array<{ url: string; body: Record<string, string> }> = [];

  const { response, verificationTokens } = await postEmailSignIn(
    async (input, init) => {
      requests.push({
        url: String(input),
        body: JSON.parse(String(init?.body)),
      });
      return new Response(JSON.stringify({ id: "email_test_accepted" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  );

  assert.equal(response.status, 302);
  const authRedirect = response.headers.get("location");
  assert.ok(authRedirect);
  assert.equal(new URL(authRedirect).pathname, "/api/auth/verify-request");
  assert.equal(isSuccessfulEmailSignInResult(authRedirect), true);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "https://api.resend.com/emails");
  assert.match(requests[0].body.html, /\/sunday-school\/api\/auth\/callback\/resend/);
  assert.doesNotMatch(requests[0].body.html, /\/sunday-school\/sunday-school\//);
  assert.equal(verificationTokens.length, 1);
});

test("public Auth.js callbacks gain exactly one Next.js base-path prefix", () => {
  const callback = publicizeAuthUrl(
    "https://silasfaithpres.org/api/auth/callback/resend?token=secret",
  );
  assert.equal(
    new URL(callback).pathname,
    "/sunday-school/api/auth/callback/resend",
  );
  assert.equal(
    publicizeAuthUrl(callback),
    callback,
  );
});

test("route interpretation uses the pathname Next.js passes to Auth.js", () => {
  assert.deepEqual(authRequestDetails("/api/auth/verify-request"), {
    action: "verify-request",
    internalBasePath: "/api/auth",
    requestPathname: "/api/auth/verify-request",
    provider: null,
  });
  assert.deepEqual(
    authRequestDetails("/sunday-school/api/auth/callback/resend"),
    {
      action: "callback",
      internalBasePath: "/api/auth",
      requestPathname: "/api/auth/callback/resend",
      provider: "resend",
    },
  );
});

test("Auth.js custom-page responses are exposed under the Next.js base path", () => {
  const response = publicizeAuthResponse(
    new Response(null, {
      status: 302,
      headers: {
        location: "/admin/verify?provider=resend&type=email",
      },
    }),
  );
  assert.equal(
    response.headers.get("location"),
    "/sunday-school/admin/verify?provider=resend&type=email",
  );
});

test("provider failures expose a safe error and do not count as accepted", async () => {
  process.env.RESEND_API_KEY = "re_integration_test";
  process.env.EMAIL_FROM = "Sunday School <sunday-school@silasfaithpres.org>";
  const provider = createResendProvider(async () =>
    new Response(JSON.stringify({ message: "The sending domain is not verified." }), {
      status: 403,
      headers: { "content-type": "application/json" },
    }),
  );

  await assert.rejects(
    provider.sendVerificationRequest!({
      identifier: "administrator@example.com",
      token: "not-logged",
      expires: new Date(Date.now() + 60_000),
      url: "https://silasfaithpres.org/api/auth/callback/resend?token=not-logged",
      provider,
      theme: {},
      request: new Request("https://silasfaithpres.org/api/auth/signin/resend"),
    }),
    /Resend email request failed with HTTP 403: The sending domain is not verified/,
  );
});
