import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEV_USER_ID = process.env.DEV_USER_ID?.trim() || 'dev';

function getApiBaseUrl() {
  const v = process.env.API_BASE_URL?.trim();
  return v && v.length > 0 ? v.replace(/\/+$/, '') : null;
}

/**
 * ✅ 调试用：检查 Vercel 是否读到 API_BASE_URL
 * 打开：/api/seo/jobs
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    API_BASE_URL: getApiBaseUrl(),
    DEV_USER_ID,
  });
}

/**
 * ✅ 上传 Excel → 创建任务
 * 前端上传字段通常是 file
 * 后端要求字段是 excel + config_json
 */
export async function POST(req: NextRequest) {
  const API_BASE_URL = getApiBaseUrl();

  if (!API_BASE_URL) {
    return NextResponse.json(
      { error: 'Missing API_BASE_URL in env' },
      { status: 500 },
    );
  }

  // 1) 读取前端上传的 formData
  const incoming = await req.formData();

  // 兼容：前端可能叫 file 或 excel
  const file = incoming.get('file') ?? incoming.get('excel');

  if (!(file instanceof File)) {
    return NextResponse.json(
      {
        error:
          'Missing upload file. Please upload via form-data with field "file" (or "excel").',
      },
      { status: 400 },
    );
  }

  // 2) 组装后端要求的字段：excel + config_json
  const upstream = new FormData();

  // ✅ FastAPI 要求字段名是 excel
  upstream.set('excel', file, file.name);

  // ✅ FastAPI 要求 config_json 必填
  // 先给一个“最小配置”，让你先跑通。后面你想加更多参数，再扩展这个 JSON
  const defaultConfig = {
    // 你可以在后端用这个字段决定用哪个模型
    model: process.env.DEFAULT_MODEL || 'openrouter',

    // 允许你后续扩展：是否启用 tavily / rephrasy / hive 等
    use_tavily: true,
    use_rephrasy: false,
    use_hive: true,

    // 并发/批量参数（后端支持的话就用）
    concurrency: 1,
  };

  upstream.set('config_json', JSON.stringify(defaultConfig));

  // 3) 转发给 Railway FastAPI
  const r = await fetch(`${API_BASE_URL}/seo/jobs`, {
    method: 'POST',
    body: upstream,
    headers: {
      // ✅ dev 模式绕过 Clerk
      'X-User-Id': DEV_USER_ID,
    },
  });

  const text = await r.text();

  // 4) 原样透传后端返回，方便你在页面里看到真实错误
  return new NextResponse(text, {
    status: r.status,
    headers: {
      'content-type': r.headers.get('content-type') ?? 'application/json',
    },
  });
}
