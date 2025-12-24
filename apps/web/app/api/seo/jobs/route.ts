import { NextRequest, NextResponse } from 'next/server';

/**
 * ✅ 强制 Node.js Runtime，避免 Edge Runtime 读不到 env
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * ✅ dev 模式用户（绕过 Clerk）
 */
const DEV_USER_ID = process.env.DEV_USER_ID?.trim() || 'dev';

/**
 * ✅ 规范化 API_BASE_URL
 */
function getApiBaseUrl() {
  const v = process.env.API_BASE_URL?.trim();
  return v && v.length > 0 ? v.replace(/\/+$/, '') : null;
}

/**
 * ✅ 安全解析 JSON（避免前端传 config_json 时炸）
 */
function safeJsonParse(input: string | null): any | null {
  if (!input) return null;
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

/**
 * ✅ 合并默认配置 + 覆盖配置（覆盖优先）
 */
function mergeConfig(defaults: Record<string, any>, overrides?: Record<string, any> | null) {
  if (!overrides) return defaults;
  return { ...defaults, ...overrides };
}

/**
 * ✅ fetch 超时包装（避免网络卡死导致“无响应”）
 */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = 60_000,
) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(id);
  }
}

/**
 * ✅ 调试接口：检查 env / dev user
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
 * ✅ 上传 Excel → 创建 SEO Job
 *
 * 前端上传：multipart/form-data
 * - file 或 excel：Excel 文件
 * - config_json（可选）：JSON 字符串，用来覆盖默认配置
 */
export async function POST(req: NextRequest) {
  const API_BASE_URL = getApiBaseUrl();

  if (!API_BASE_URL) {
    return NextResponse.json(
      { error: 'Missing API_BASE_URL in env' },
      { status: 500 },
    );
  }

  // 1) 读取前端 formData
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

  // 可选：前端传来的 config_json（如果你以后页面加按钮，就可以传这个来覆盖默认值）
  const incomingConfigRaw = incoming.get('config_json');
  const incomingConfig =
    typeof incomingConfigRaw === 'string' ? safeJsonParse(incomingConfigRaw) : null;

  // 2) 构造后端需要的 FormData（FastAPI：excel + config_json）
  const upstream = new FormData();
  upstream.set('excel', file, file.name);

  /**
   * 3) ✅ 一次性补齐高频必填字段（防 KeyError）
   *
   * 你后端已经明确报过：
   * - 缺 language
   * - 缺 mode
   *
   * 所以这里把“最常见会被直接 config['xxx'] 访问”的字段都补齐。
   * 后端不认识的字段会忽略；认识的字段能直接用。
   */
  const defaultConfig = {
    // ===== 任务类型/模式 =====
    kind: 'seo_generate',
    mode: 'batch', // ✅ 关键：你后端已经 KeyError 缺这个

    // ===== 语言/地区 =====
    language: 'en', // ✅ 关键：你后端已经 KeyError 缺这个
    country: 'US',
    locale: 'en-US',

    // ===== 模型/提供方 =====
    model_provider: 'openrouter',
    model: process.env.DEFAULT_MODEL || 'openrouter',
    temperature: 0.7,
    top_p: 1,

    // ===== 批处理/并发 =====
    concurrency: 1,
    batch_size: 1,

    // ===== SEO 内容参数（常见字段，后端需要就用，不需要就忽略）=====
    niche: 'general',
    tone: 'professional',
    audience: 'general',
    max_words: 1200,
    min_words: 800,
    include_faq: true,
    include_conclusion: true,

    // ===== 工具开关（你提到的 Hive/Tavily/Rephrasy）=====
    use_tavily: true,
    use_rephrasy: false,
    use_hive: true,

    // ===== 输出控制 =====
    output_format: 'markdown',
    include_images: false,
    include_schema: true,

    // ===== 运行控制 =====
    dry_run: false,
    debug: false,

    // ===== 预留字段（有些后端会用到，不给就 KeyError）=====
    site_url: '',
    brand_name: '',
    project_name: 'seo-jobs',
  };

  // 合并：默认配置 +（可选）前端覆盖配置
  const mergedConfig = mergeConfig(defaultConfig, incomingConfig);

  upstream.set('config_json', JSON.stringify(mergedConfig));

  // 4) 转发给 Railway FastAPI
  let r: Response;
  try {
    r = await fetchWithTimeout(
      `${API_BASE_URL}/seo/jobs`,
      {
        method: 'POST',
        body: upstream,
        headers: {
          // ✅ dev 模式绕过 Clerk
          'X-User-Id': DEV_USER_ID,
        },
      },
      120_000, // 2 分钟超时：上传+创建任务一般够用
    );
  } catch (e: any) {
    const msg =
      e?.name === 'AbortError'
        ? 'Upstream timeout while creating job'
        : `Upstream fetch failed: ${e?.message || String(e)}`;

    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const text = await r.text();

  // 5) 原样透传后端返回
  return new NextResponse(text, {
    status: r.status,
    headers: {
      'content-type': r.headers.get('content-type') ?? 'application/json',
      // 小优化：方便你排查请求链路
      'x-proxy-upstream': 'railway',
    },
  });
}
