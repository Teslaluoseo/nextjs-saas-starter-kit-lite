'use client';

import { useEffect, useMemo, useState } from 'react';

type JobCreateResponse = {
  job_id?: string;
  jobId?: string;
  id?: string;
  [k: string]: any;
};

type JobStatusResponse = {
  status?: 'queued' | 'running' | 'done' | 'failed' | string;
  progress?: number; // 0-100
  message?: string;
  result_url?: string;
  error?: string;
  [k: string]: any;
};

export default function SeoJobsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);

  const [status, setStatus] = useState<JobStatusResponse | null>(null);
  const [polling, setPolling] = useState(false);

  const canStart = useMemo(() => !!file && !creating, [file, creating]);

  async function startJob() {
    if (!file) return;

    setCreating(true);
    setStatus(null);
    setJobId(null);

    try {
      const fd = new FormData();
      // ⚠️ 这个字段名要和你的 FastAPI 一致（常见是 file）
      fd.append('file', file);

      const res = await fetch('/api/seo/jobs', {
        method: 'POST',
        body: fd,
      });

      if (!res.ok) {
        const t = await res.text();
        throw new Error(`Create job failed: ${res.status} ${t}`);
      }

      const data: JobCreateResponse = await res.json();
      const id = (data.job_id || data.jobId || data.id) as string | undefined;

      if (!id) {
        throw new Error(
          `Create job ok but missing job_id in response: ${JSON.stringify(data)}`,
        );
      }

      setJobId(id);
      setPolling(true);
    } catch (e: any) {
      setStatus({ status: 'failed', error: e?.message ?? String(e) });
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => {
    if (!jobId || !polling) return;

    let alive = true;
    let timer: any = null;

    async function tick() {
      try {
        const res = await fetch(`/api/seo/jobs/${encodeURIComponent(jobId)}`, {
          method: 'GET',
          cache: 'no-store',
        });

        if (!res.ok) {
          const t = await res.text();
          throw new Error(`Get status failed: ${res.status} ${t}`);
        }

        const data: JobStatusResponse = await res.json();
        if (!alive) return;

        setStatus(data);

        if (data.status === 'done' || data.status === 'failed') {
          setPolling(false);
          return;
        }

        timer = setTimeout(tick, 1500);
      } catch (e: any) {
        if (!alive) return;
        setStatus({ status: 'failed', error: e?.message ?? String(e) });
        setPolling(false);
      }
    }

    tick();

    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [jobId, polling]);

  return (
    <div style={{ padding: 24, maxWidth: 720 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>SEO Jobs</h1>
      <p style={{ marginTop: 8, opacity: 0.8 }}>
        上传 Excel → 创建任务 → 轮询状态
      </p>

      <div
        style={{
          marginTop: 16,
          padding: 16,
          border: '1px solid #ddd',
          borderRadius: 12,
        }}
      >
        <label style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>
          选择 Excel 文件（.xlsx）
        </label>

        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />

        <div style={{ marginTop: 12 }}>
          <button
            onClick={startJob}
            disabled={!canStart}
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              border: '1px solid #333',
              cursor: canStart ? 'pointer' : 'not-allowed',
              opacity: canStart ? 1 : 0.5,
            }}
          >
            {creating ? 'Creating...' : '开始任务'}
          </button>
        </div>

        {file && (
          <div style={{ marginTop: 10, fontSize: 13, opacity: 0.8 }}>
            已选择：{file.name} ({Math.round(file.size / 1024)} KB)
          </div>
        )}
      </div>

      <div
        style={{
          marginTop: 16,
          padding: 16,
          border: '1px solid #ddd',
          borderRadius: 12,
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
          任务状态
        </h2>

        {!jobId && !status && <div style={{ opacity: 0.7 }}>还没有任务</div>}

        {jobId && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 13, opacity: 0.75 }}>Job ID</div>
            <div style={{ fontFamily: 'monospace' }}>{jobId}</div>
          </div>
        )}

        {status && (
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(status, null, 2)}
          </pre>
        )}

        {polling && (
          <div style={{ marginTop: 10, fontSize: 13, opacity: 0.75 }}>
            正在轮询中...
          </div>
        )}
      </div>
    </div>
  );
}
