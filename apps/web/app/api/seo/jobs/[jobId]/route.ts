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

export async function GET(
  _req: Request,
  ctx: { params: { jobId: string } }
) {
  const backend = mustGetBackendUrl();

  const { userId, getToken } = auth();
  const token = await getToken();

  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (userId) headers["X-User-Id"] = userId;

  const resp = await fetch(`${backend}/seo/jobs/${ctx.params.jobId}`, {
    method: "GET",
    headers,
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
