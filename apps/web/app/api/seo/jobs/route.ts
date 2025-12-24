import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export const runtime = "nodejs";

function getBackendUrlSafe() {
  const raw = process.env.BACKEND_URL || "";
  const url = raw.trim().replace(/\/+$/, "");

  if (!url) {
    return { ok: false as const, error: "Missing env BACKEND_URL" };
  }
  if (!/^https:\/\/.+/i.test(url)) {
    return { ok: false as const, error: `BACKEND_URL must start with https://, got: ${raw}` };
  }
  return { ok: true as const, url };
}

export async function POST(req: Request) {
  try {
    const backend = getBackendUrlSafe();
    if (!backend.ok) {
      return NextResponse.json(
        { ok: false, where: "api/seo/jobs", error: backend.error },
        { status: 500 }
      );
    }

    const { userId, getToken } = auth();
    const token = await getToken().catch(() => null);

    const formData = await req.formData();

    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (userId) headers["X-User-Id"] = userId;

    const resp = await fetch(`${backend.url}/seo/jobs`, {
      method: "POST",
      headers,
      body: formData,
      cache: "no-store",
      redirect: "follow",
    });

    const contentType = resp.headers.get("Content-Type") || "application/json";
    const text = await resp.text();

    return new NextResponse(text, {
      status: resp.status,
      headers: { "Content-Type": contentType, "Cache-Control": "no-store" },
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        where: "api/seo/jobs",
        error: String(e?.message ?? e),
        stack: e?.stack ?? null,
      },
      { status: 500 }
    );
  }
}
