import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export const runtime = "nodejs";

function mustGetBackendUrl() {
  const url = process.env.BACKEND_URL;
  if (!url) {
    throw new Error("Missing env BACKEND_URL (must be https://...)");
  }
  return url.replace(/\/+$/, "");
}

export async function POST(req: Request) {
  const backend = mustGetBackendUrl();

  // Clerk auth
  const { userId, getToken } = auth();
  const token = await getToken();

  // Forward multipart 그대로
  const formData = await req.formData();

  // ✅ 如果后端支持 Clerk JWT：走 Authorization
  // ✅ 如果你后端还没接 Clerk：也可以先用 X-User-Id（临时）
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (userId) headers["X-User-Id"] = userId;

  const resp = await fetch(`${backend}/seo/jobs`, {
    method: "POST",
    headers,
    body: formData,
    cache: "no-store",
  });

  const text = await resp.text();
  return new NextResponse(text, {
    status: resp.status,
    headers: {
      "Content-Type": resp.headers.get("Content-Type") || "application/json",
    },
  });
}

export async function GET() {
  return NextResponse.json(
    { ok: false, message: "Use POST /api/seo/jobs or GET /api/seo/jobs/{jobId}" },
    { status: 405 }
  );
}
