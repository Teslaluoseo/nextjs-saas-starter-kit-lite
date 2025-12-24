import { NextRequest, NextResponse } from 'next/server';

/**
 * 强制 Node.js Runtime
 * 防止 Edge Runtime 读不到 env
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * dev 模式用户（绕过 Clerk）
 */
const DEV_USER_ID = process.env.DEV_USER_ID?.trim() || 'dev';

/**
 * 读取并规范化 API_BASE_URL
 */
function getApiBaseUrl() {
  const v = process.env.API_BASE_URL?.trim();
  return v && v.length > 0 ? v.replace(/\/+$/, '') : null;
}

/**
 * 调试接口
 * 打开 /api/seo/jobs
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    API_BASE_URL: getApiBaseUrl(),
    DEV_USER_ID,
  });
}

/**
 * 上传 Excel → 创建 SEO Job
 */
export async function POST(req: NextRequest) {
  const API_BASE_URL = getApiBaseUrl();

  if (!API_BASE_URL) {
    return NextResponse.json(
      { error: 'Missing API_BASE_URL in env' },
      { status: 500 },
    );
  }

  /**
   * 1️⃣ 读取前端上传的 form-data
   */
  const incoming = await req.formData();

  // 兼容字段名：file / excel
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

  /**
   * 2️⃣ 构造后端需要的 FormData
   */
  const upstream = new FormData();

  // FastAPI 必须字段：excel
  upstream.set('excel', file, file.name);

  /**
   * 3️⃣ 一次性补齐最常见 config_json 字段（防 KeyError）
   * 后端不需要的字段会自动忽略
   */
  const defaultConfig = {
    // ===== 核心控制 =====
    kind: 'seo_generate',

    // ===== 语言 / 地区（你这次报错缺的就是 language）=====
    language: 'en',
    country: 'US',

    // ===== 模型相关 =====
    model_provider: 'openrouter',
    model: process.env.DEFAULT_MODEL || 'openrouter',
    temperature: 0.7,

    // ===== SEO 内容参数 =====
    niche: 'general',
    tone: 'professional',
    audience: 'general',
    max_words: 1200,

    // ===== 工具开关（你提到的 Hive / Tavily / Rephrasy）=====
    use_tavily: true,
    use_rephrasy: false,
    use_hive: true,

    // ===== 执行控制 =====
    concurrency: 1,
    dry_run: false,

    // ===== 输出控制 =====
    output_format: 'markdown',
    include_images: false,
    include_schema: true,

    // ===== 预留字段（后端若用得到）=====
    site_url: '',
    brand_name: '',
  };

  upstream.set('config_json', JSON.stringify(defaultConfig));

  /**
   * 4️⃣ 转发请求到 Railway FastAPI
   */
  const r = await fetch(`${API_BASE_URL}/seo/jobs`, {
    method: 'POST',
    body: upstream,
    headers: {
      // dev 模式绕过 Clerk
      'X-User-Id': DEV_USER_ID,
    },
  });

  const text = await r.text();

  /**
   * 5️⃣ 原样返回后端结果（方便你在前端看到真实错误/进度）
   */
  return new NextResponse(text, {
    status: r.status,
    headers: {
      'content-type': r.headers.get('content-type') ?? 'application/json',
    },
  });
}
