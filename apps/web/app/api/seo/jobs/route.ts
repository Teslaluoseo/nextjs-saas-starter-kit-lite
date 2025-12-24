import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEV_USER_ID = process.env.DEV_USER_ID?.trim() || 'dev';

function getApiBaseUrl() {
  const v = process.env.API_BASE_URL?.trim();
  return v && v.length > 0 ? v.replace(/\/+$/, '') : null;
}

function safeJsonParse(input: unknown): any | null {
  if (typeof input !== 'string') return null;
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

function getCorrelationId(req: NextRequest) {
  return (
    req.headers.get('x-correlation-id') ||
    req.headers.get('x-request-id') ||
    crypto.randomUUID()
  );
}

/**
 * 你的 Streamlit 里真实会传的 config 字段（核心部分）
 * 参考：app.py 里点击 Start Generation 的 config 结构。:contentReference[oaicite:3]{index=3}
 */
function buildDefaultConfig() {
  const modelOptions = [
    'google/gemini-2.5-pro',
    'google/gemini-2.5-pro-preview',
    'anthropic/claude-sonnet-4',
    'anthropic/claude-3.5-sonnet',
    'openai/gpt-4o',
    'openai/gpt-4o-mini',
    'google/gemini-3-pro-preview',
    'anthropic/claude-sonnet-4.5',
    'openai/gpt-5.1',
  ];

  const defaultModelOutline = process.env.DEFAULT_MODEL_OUTLINE || modelOptions[0];
  const defaultModelWriter = process.env.DEFAULT_MODEL_WRITER || modelOptions[0];
  const defaultModelRewrite = process.env.DEFAULT_MODEL_REWRITE || modelOptions[2];
  const defaultModelRestore = process.env.DEFAULT_MODEL_RESTORE || modelOptions[1];
  const defaultModelSeo = process.env.DEFAULT_MODEL_SEO || modelOptions[2];

  return {
    // ===== 你后端 job kind（如果后端忽略也没问题）=====
    kind: 'seo_generate',

    // ===== Streamlit 核心字段（缺一个就会 KeyError）=====
    language: 'English', // 你 Streamlit 用的是 English/Spanish/... :contentReference[oaicite:4]{index=4}
    mode: 'SEO', // SEO / GEO :contentReference[oaicite:5]{index=5}

    model_outline: defaultModelOutline,
    model_writer: defaultModelWriter,
    model_rewrite: defaultModelRewrite,
    model_restore: defaultModelRestore,
    model_seo: defaultModelSeo,

    use_rephrasy: true,
    product_level: '简短提及',

    // 图片相关（Streamlit 的 Enable Image Insertion + source）:contentReference[oaicite:6]{index=6}
    enable_image_feature: true,
    generate_images: false,
    num_images: 0,
    ui_custom_images: [],

    // GEO/品牌信息（你 Streamlit 里 GEO 会用 brand_info）:contentReference[oaicite:7]{index=7}
    brand_info: '',

    // 视频相关 :contentReference[oaicite:8]{index=8}
    use_youtube: true,
    custom_youtube_url: '',

    // 作者 :contentReference[oaicite:9]{index=9}
    ui_author_name: '',

    // 兼容你之前 defaultConfig 里出现过的字段（后端不用会忽略）
    country: 'US',
    temperature: 0.7,
    output_format: 'markdown',
    include_schema: true,
    include_images: false,
    concurrency: 1,
    dry_run: false,
  };
}

function mergeConfig(userConfig: any) {
  const base = buildDefaultConfig();
  const cfg = { ...base, ...(userConfig && typeof userConfig === 'object' ? userConfig : {}) };

  // 兜底：确保关键字段一定存在（防止前端传了空值/删掉）
  const mustKeys: Array<keyof typeof base> = [
    'language',
    'mode',
    'model_outline',
    'model_writer',
    'model_rewrite',
    'model_restore',
    'model_seo',
    'use_rephrasy',
    'product_level',
    'enable_image_feature',
    'generate_images',
    'num_images',
    'ui_custom_images',
    'brand_info',
    'use_youtube',
    'custom_youtube_url',
    'ui_author_name',
  ];

  for (const k of mustKeys) {
    if (cfg[k] === undefined || cfg[k] === null) cfg[k] = (base as any)[k];
  }

  // 类型修正
  cfg.use_rephrasy = Boolean(cfg.use_rephrasy);
  cfg.enable_image_feature = Boolean(cfg.enable_image_feature);
  cfg.generate_images = Boolean(cfg.generate_images);
  cfg.use_youtube = Boolean(cfg.use_youtube);

  if (!Number.isFinite(Number(cfg.num_images))) cfg.num_images = 0;
  cfg.num_images = Number(cfg.num_images);

  if (!Array.isArray(cfg.ui_custom_images)) cfg.ui_custom_images = [];

  if (typeof cfg.language !== 'string' || !cfg.language.trim()) cfg.language = base.language;
  if (typeof cfg.mode !== 'string' || !cfg.mode.trim()) cfg.mode = base.mode;

  return cfg;
}

/**
 * 调试：打开 /api/seo/jobs 看 env 是否生效
 */
export async function GET(req: NextRequest) {
  const correlationId = getCorrelationId(req);
  return NextResponse.json(
    {
      ok: true,
      API_BASE_URL: getApiBaseUrl(),
      DEV_USER_ID,
      correlationId,
    },
    { headers: { 'x-correlation-id': correlationId } },
  );
}

/**
 * 上传 Excel → 创建 SEO Job
 */
export async function POST(req: NextRequest) {
  const API_BASE_URL = getApiBaseUrl();
  const correlationId = getCorrelationId(req);

  if (!API_BASE_URL) {
    return NextResponse.json(
      { error: 'Missing API_BASE_URL in env' },
      { status: 500, headers: { 'x-correlation-id': correlationId } },
    );
  }

  const incoming = await req.formData();

  // 兼容字段名：file / excel
  const file = incoming.get('file') ?? incoming.get('excel');

  if (!(file instanceof File)) {
    return NextResponse.json(
      {
        error:
          'Missing upload file. Please upload via form-data with field "file" (or "excel").',
      },
      { status: 400, headers: { 'x-correlation-id': correlationId } },
    );
  }

  // 前端可选传 config_json；不传也没关系，我们会自动补齐
  const rawConfig = incoming.get('config_json');
  const parsed = safeJsonParse(rawConfig);
  const finalConfig = mergeConfig(parsed);

  const upstream = new FormData();
  upstream.set('excel', file, file.name);
  upstream.set('config_json', JSON.stringify(finalConfig));

  const r = await fetch(`${API_BASE_URL}/seo/jobs`, {
    method: 'POST',
    body: upstream,
    headers: {
      // dev 模式绕过 Clerk（你后端现在就是这么提示的）
      'X-User-Id': DEV_USER_ID,
      'X-Correlation-Id': correlationId,
    },
  });

  const text = await r.text();

  return new NextResponse(text, {
    status: r.status,
    headers: {
      'content-type': r.headers.get('content-type') ?? 'application/json',
      'x-correlation-id': correlationId,
    },
  });
}
