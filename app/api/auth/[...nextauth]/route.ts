import { handlers } from "@/auth";
import { logAuthRequest } from "@/lib/auth-logging";
import { publicizeAuthResponse } from "@/lib/auth-routing";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  logAuthRequest(request.url);
  return publicizeAuthResponse(await handlers.GET(request));
}

export async function POST(request: NextRequest) {
  logAuthRequest(request.url);
  return publicizeAuthResponse(await handlers.POST(request));
}
