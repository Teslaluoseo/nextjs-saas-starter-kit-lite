'use client';

import React, { useMemo, useRef, useState } from 'react';

type JobResp = {
  job_id?: string;
  id?: string;
  status?: string;
  error?: any;
};

const MODEL_OPTIONS = [
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

const LANGUAGE_OPTIONS = ['English', 'Spanish', 'French', 'German', 'Japanese', 'Chinese'];

export default function SeoJobsPage() {
  const [file, setFile] = useState<File | null>(null);

  // ====== Streamlit 风格配置区（最核心）=====
  const [mode, setMode] = useState<'SEO' | 'GEO'>('SEO');
  const [language, setLanguage] = useState('English');

  const [useRephrasy, setUseRephrasy] = useState(true);
  const [productLevel, setProductLevel] = useState('简短提及');

  const [enableImageFeature, setEnableImageFeature] = useState(true);
  const [imageSource, setImageSource] = useState<'ai' | 'urls'>('ai');
  const [numImages, setNumImages] = useState(4);
  const [customImageUrls, setCustomImageUrls] = useState<string>('');

  const [useYoutube, setUseYoutube] = useState(true);
  const [customYoutubeUrl, setCustomYoutubeUrl] = useState('');

  const [uiAuthorName, setUiAuthorName] = useState('');

  const [modelOutline, setModelOutline] = useState(MODEL_OPTIONS[0]);
  const [modelWriter, setModelWriter] = useState(MODEL_OPTIONS[0]);
  const [modelRewrite, setModelRewrite] = useState(MODEL_OPTIONS[2]);
  const [modelRestore, setModelRestore] = useState(MODEL_OPTIONS[1]);
  const [modelSeo, setModelSeo] = useState(MODEL_OPTIONS[2]);

  const [jobId, setJobId] = useState<string>('');
  const [statusJson, setStatusJson] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const pollTimer = useRef<any>(null);

  const uiCustomImages = useMemo(() => {
    const urls = customImageUrls
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    return urls;
  }, [customImageUrls]);

  function buildConfigJson() {
    return {
      // 对齐你 Streamlit 的 config 结构（后端按这个读）:contentReference[oaicite:11]{index=11}
      language,
      mode,

      model_outline: modelOutline,
      model_writer: modelWriter,
      model_rewrite: modelRewrite,
      model_restore: modelRestore,
      model_seo: modelSeo,

      use_rephrasy: useRephrasy,
      product_level: productLevel,

      enable_image_feature: enableImageFeature,
      generate_images: enableImageFeature ? imageSource === 'ai' : false,
      num_images: enableImageFeature ? (imageSource === 'ai' ? numImages : uiCustomImages.length) : 0,
      ui_custom_images: enableImageFeature ? (imageSource === 'urls' ? uiCustomImages : []) : [],

      use_youtube: useYoutube,
      custom_youtube_url: customYoutubeUrl,

      ui_author_name: uiAuthorName,

      // 兼容字段（无害，后端不用会忽略）
      kind: 'seo_generate',
      brand_info: '',
      country: 'US',
      output_format: 'markdown',
      include_schema: true,
    };
  }

  async function startJob() {
    if (!file) {
      alert('先选择 Excel 文件');
      return;
    }

    setBusy(true);
    setStatusJson(null);
    setJobId('');

    try {
      const fd = new FormData();
      fd.set('file', file, file.name);
      fd.set('config_json', JSON.stringify(buildConfigJson()));

      const r = await fetch('/api/seo/jobs', { method: 'POST', body: fd });
      const text = await r.text();

      let json: any;
      try {
        json = JSON.parse(text);
      } catch {
        json = { raw: text };
      }

      if (!r.ok) {
        setStatusJson({ status: 'failed', error: json });
        return;
      }

      const id = json.job_id || json.id;
      setJobId(id || '');
      setStatusJson(json);

      if (id) {
        startPolling(id);
      }
    } finally {
      setBusy(false);
    }
  }

  function stopPolling() {
    if (pollTimer.current) clearInterval(pollTimer.current);
    pollTimer.current = null;
  }

  function startPolling(id: string) {
    stopPolling();

    pollTimer.current = setInterval(async () => {
      try {
        const r = await fetch(`/api/seo/jobs/${encodeURIComponent(id)}`, { cache: 'no-store' });
        const text = await r.text();
        let json: any;
        try {
          json = JSON.parse(text);
        } catch {
          json = { raw: text };
        }
        setStatusJson(json);

        const st = String(json?.status || '').toLowerCase();
        if (st === 'done' || st === 'completed' || st === 'success' || st === 'failed') {
          stopPolling();
        }
      } catch (e: any) {
        setStatusJson({ status: 'failed', error: String(e?.message || e) });
        stopPolling();
      }
    }, 1500);
  }

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>
        SEO Jobs
      </h1>
      <p style={{ opacity: 0.8, marginBottom: 18 }}>
        上传 Excel → 创建任务 → 轮询状态（先把 Streamlit 的核心交互还原出来）
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* 左侧：策略/开关 */}
        <div style={{ border: '1px solid #eee', borderRadius: 12, padding: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>📝 Article Strategy</h2>

          <label style={{ display: 'block', marginBottom: 8 }}>
            Optimization Mode
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as any)}
              style={{ display: 'block', width: '100%', marginTop: 6 }}
            >
              <option value="SEO">SEO</option>
              <option value="GEO">GEO</option>
            </select>
          </label>

          <label style={{ display: 'block', marginBottom: 8 }}>
            Article Language
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              style={{ display: 'block', width: '100%', marginTop: 6 }}
            >
              {LANGUAGE_OPTIONS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '10px 0' }}>
            <input
              type="checkbox"
              checked={useRephrasy}
              onChange={(e) => setUseRephrasy(e.target.checked)}
            />
            Enable Rephrasy Anti-AI Detection
          </label>

          <label style={{ display: 'block', marginBottom: 8 }}>
            Product Recommendation Detail Level
            <select
              value={productLevel}
              onChange={(e) => setProductLevel(e.target.value)}
              style={{ display: 'block', width: '100%', marginTop: 6 }}
            >
              <option value="简短提及">简短提及</option>
              <option value="中等介绍">中等介绍</option>
              <option value="详细介绍">详细介绍</option>
            </select>
          </label>

          <hr style={{ margin: '14px 0' }} />

          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>🖼️ Image Settings</h3>

          <label style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '10px 0' }}>
            <input
              type="checkbox"
              checked={enableImageFeature}
              onChange={(e) => setEnableImageFeature(e.target.checked)}
            />
            Enable Image Insertion (AI or Custom)
          </label>

          {enableImageFeature && (
            <>
              <label style={{ display: 'block', marginBottom: 8 }}>
                Image Source
                <select
                  value={imageSource}
                  onChange={(e) => setImageSource(e.target.value as any)}
                  style={{ display: 'block', width: '100%', marginTop: 6 }}
                >
                  <option value="ai">AI Generation (Hive)</option>
                  <option value="urls">Custom Image URLs (Global)</option>
                </select>
              </label>

              {imageSource === 'ai' ? (
                <label style={{ display: 'block', marginBottom: 8 }}>
                  Number of AI Images
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={numImages}
                    onChange={(e) => setNumImages(Number(e.target.value || 1))}
                    style={{ display: 'block', width: '100%', marginTop: 6 }}
                  />
                </label>
              ) : (
                <label style={{ display: 'block', marginBottom: 8 }}>
                  Enter Image URLs (One per line)
                  <textarea
                    value={customImageUrls}
                    onChange={(e) => setCustomImageUrls(e.target.value)}
                    style={{ display: 'block', width: '100%', marginTop: 6, minHeight: 120 }}
                  />
                </label>
              )}
            </>
          )}

          <hr style={{ margin: '14px 0' }} />

          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>🎥 Video & Author</h3>

          <label style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '10px 0' }}>
            <input
              type="checkbox"
              checked={useYoutube}
              onChange={(e) => setUseYoutube(e.target.checked)}
            />
            Insert YouTube Video
          </label>

          {useYoutube && (
            <label style={{ display: 'block', marginBottom: 8 }}>
              Global Custom YouTube URL (Optional)
              <input
                value={customYoutubeUrl}
                onChange={(e) => setCustomYoutubeUrl(e.target.value)}
                placeholder="Paste link here to override auto-search"
                style={{ display: 'block', width: '100%', marginTop: 6 }}
              />
            </label>
          )}

          <label style={{ display: 'block', marginBottom: 8 }}>
            Author Name (Default)
            <input
              value={uiAuthorName}
              onChange={(e) => setUiAuthorName(e.target.value)}
              placeholder="e.g., Tesla Luo, Expertise 1, Expertise 2"
              style={{ display: 'block', width: '100%', marginTop: 6 }}
            />
          </label>
        </div>

        {/* 右侧：模型 */}
        <div style={{ border: '1px solid #eee', borderRadius: 12, padding: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>🤖 AI Model Selection</h2>

          <label style={{ display: 'block', marginBottom: 8 }}>
            1. Outline Generation Model
            <select
              value={modelOutline}
              onChange={(e) => setModelOutline(e.target.value)}
              style={{ display: 'block', width: '100%', marginTop: 6 }}
            >
              {MODEL_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: 'block', marginBottom: 8 }}>
            2. Article Writer Model
            <select
              value={modelWriter}
              onChange={(e) => setModelWriter(e.target.value)}
              style={{ display: 'block', width: '100%', marginTop: 6 }}
            >
              {MODEL_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: 'block', marginBottom: 8 }}>
            3. Polishing/Rewriting Model
            <select
              value={modelRewrite}
              onChange={(e) => setModelRewrite(e.target.value)}
              style={{ display: 'block', width: '100%', marginTop: 6 }}
            >
              {MODEL_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: 'block', marginBottom: 8 }}>
            4. Format Restoration Model
            <select
              value={modelRestore}
              onChange={(e) => setModelRestore(e.target.value)}
              style={{ display: 'block', width: '100%', marginTop: 6 }}
            >
              {MODEL_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: 'block', marginBottom: 8 }}>
            5. SEO Meta & Image Prompt Model
            <select
              value={modelSeo}
              onChange={(e) => setModelSeo(e.target.value)}
              style={{ display: 'block', width: '100%', marginTop: 6 }}
            >
              {MODEL_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>

          <hr style={{ margin: '14px 0' }} />

          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>📂 Upload Data</h2>

          <input
            type="file"
            accept=".xlsx"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />

          <div style={{ marginTop: 10 }}>
            <button
              onClick={startJob}
              disabled={busy}
              style={{
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid #ddd',
                cursor: busy ? 'not-allowed' : 'pointer',
              }}
            >
              {busy ? 'Starting...' : '🚀 Start Generation'}
            </button>

            <button
              onClick={() => jobId && startPolling(jobId)}
              disabled={!jobId}
              style={{
                marginLeft: 10,
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid #ddd',
                cursor: !jobId ? 'not-allowed' : 'pointer',
              }}
            >
              继续轮询
            </button>

            <button
              onClick={stopPolling}
              style={{
                marginLeft: 10,
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid #ddd',
                cursor: 'pointer',
              }}
            >
              停止轮询
            </button>
          </div>

          {jobId && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontWeight: 700 }}>Job ID</div>
              <div style={{ fontFamily: 'monospace', marginTop: 6 }}>{jobId}</div>
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 16, border: '1px solid #eee', borderRadius: 12, padding: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>任务状态</h2>
        <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {statusJson ? JSON.stringify(statusJson, null, 2) : '尚未开始'}
        </pre>

        <details style={{ marginTop: 10 }}>
          <summary>当前会提交给后端的 config_json（调试用）</summary>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {JSON.stringify(buildConfigJson(), null, 2)}
          </pre>
        </details>
      </div>
    </div>
  );
}
