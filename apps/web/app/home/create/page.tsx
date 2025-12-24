"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import {
  Sparkles,
  RotateCcw,
  Download,
  ExternalLink,
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  Loader2,
} from "lucide-react";

import { Button } from "@kit/ui/button";
import { Input } from "@kit/ui/input";
import { Textarea } from "@kit/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@kit/ui/card";
import { Separator } from "@kit/ui/separator";
import { Badge } from "@kit/ui/badge";
import { Switch } from "@kit/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@kit/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@kit/ui/tabs";

type JobStatus = "idle" | "queued" | "running" | "succeeded" | "failed";

type AdvancedConfig = {
  language: string;
  mode: "SEO" | "GEO" | "Landing" | "Product";
  tone: string;
  word_count: number;

  enable_images: boolean;
  image_count: number;

  enable_video: boolean;
  video_provider: "youtube" | "none";

  enable_internal_links: boolean;
  enable_external_links: boolean;

  enable_facts: boolean;
  citations_style: "none" | "inline" | "footnote";

  model_writer: string;
  model_outline: string;

  // allow unknown backend fields
  [k: string]: any;
};

const DEFAULT_CONFIG: AdvancedConfig = {
  language: "en",
  mode: "SEO",
  tone: "Professional",
  word_count: 1800,

  enable_images: true,
  image_count: 4,

  enable_video: false,
  video_provider: "none",

  enable_internal_links: true,
  enable_external_links: true,

  enable_facts: true,
  citations_style: "inline",

  model_writer: "gpt-4o-mini",
  model_outline: "gpt-4o-mini",
};

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL;

function safeInt(v: string, fallback: number) {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

async function readAsArrayBuffer(file: File) {
  return await file.arrayBuffer();
}

function makeFilenameSafe(name: string) {
  return name
    .trim()
    .replace(/[\/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

/**
 * Build a 1-row Excel (.xlsx) in browser for "single article" mode.
 * The backend legacy expects columns like:
 * - main_keyword, secondary_keyword, topic, wordcounts, specific
 */
async function buildSingleRowXlsx(params: {
  keyword: string;
  brief: string;
  wordcounts: number;
}) {
  const XLSX = await import("xlsx");

  const rows = [
    {
      main_keyword: params.keyword,
      secondary_keyword: "",
      topic: params.keyword,
      wordcounts: params.wordcounts,
      specific: params.brief ?? "",
    },
  ];

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  return new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

async function buildTemplateXlsx() {
  const XLSX = await import("xlsx");

  const rows = [
    {
      main_keyword: "example keyword 1",
      secondary_keyword: "optional secondary keyword",
      topic: "topic / angle",
      wordcounts: 1800,
      specific: "brief / constraints / audience / product focus",
    },
    {
      main_keyword: "example keyword 2",
      secondary_keyword: "",
      topic: "another topic",
      wordcounts: 1500,
      specific: "",
    },
  ];

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  return new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

/**
 * Backend calls
 * - POST /seo/jobs (multipart: excel, config_json, images_zip?)
 * - GET /seo/jobs/{job_id}
 * - GET /seo/jobs/{job_id}/download  (xlsx)
 */
async function backendFetchJson(args: {
  path: string;
  method?: "GET" | "POST";
  token?: string | null;
  xUserId?: string;
  body?: any;
}) {
  if (!BACKEND) throw new Error("NEXT_PUBLIC_BACKEND_URL is not set.");

  const res = await fetch(`${BACKEND}${args.path}`, {
    method: args.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(args.token ? { Authorization: `Bearer ${args.token}` } : {}),
      ...(!args.token && args.xUserId ? { "X-User-Id": args.xUserId } : {}),
    },
    body: args.body ? JSON.stringify(args.body) : undefined,
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Backend ${res.status}: ${text}`);
  }
  return await res.json();
}

async function backendUploadMultipart(args: {
  path: string;
  token?: string | null;
  xUserId?: string;
  form: FormData;
}) {
  if (!BACKEND) throw new Error("NEXT_PUBLIC_BACKEND_URL is not set.");

  const res = await fetch(`${BACKEND}${args.path}`, {
    method: "POST",
    headers: {
      ...(args.token ? { Authorization: `Bearer ${args.token}` } : {}),
      ...(!args.token && args.xUserId ? { "X-User-Id": args.xUserId } : {}),
      // ⚠️ Do NOT set Content-Type for FormData; browser will set boundary.
    },
    body: args.form,
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Backend ${res.status}: ${text}`);
  }
  return await res.json();
}

async function backendDownloadXlsx(args: {
  path: string;
  token?: string | null;
  xUserId?: string;
}) {
  if (!BACKEND) throw new Error("NEXT_PUBLIC_BACKEND_URL is not set.");

  const res = await fetch(`${BACKEND}${args.path}`, {
    method: "GET",
    headers: {
      ...(args.token ? { Authorization: `Bearer ${args.token}` } : {}),
      ...(!args.token && args.xUserId ? { "X-User-Id": args.xUserId } : {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Backend ${res.status}: ${text}`);
  }

  const blob = await res.blob();
  return blob;
}

export default function CreateContentPage() {
  const { getToken, isSignedIn } = useAuth();

  // UI tab
  const [tab, setTab] = useState<"single" | "batch">("single");

  // Single inputs
  const [keyword, setKeyword] = useState("");
  const [brief, setBrief] = useState("");

  // Batch inputs
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [imagesZip, setImagesZip] = useState<File | null>(null);

  // Advanced settings (shared)
  const [cfg, setCfg] = useState<AdvancedConfig>({ ...DEFAULT_CONFIG });

  // Auth dev fallback (only used when token missing)
  const [devUserId, setDevUserId] = useState("");

  // Job state
  const [jobId, setJobId] = useState<string>("");
  const [status, setStatus] = useState<JobStatus>("idle");
  const [progress, setProgress] = useState<number>(0); // 0..100
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string>("");

  // Job result: backend mainly gives xlsx download. We still keep a preview placeholder.
  const [resultMeta, setResultMeta] = useState<any>(null);

  const pollTimer = useRef<NodeJS.Timeout | null>(null);

  const canRunSingle = useMemo(() => keyword.trim().length > 0, [keyword]);
  const canRunBatch = useMemo(() => !!excelFile, [excelFile]);

  function clearPolling() {
    if (pollTimer.current) clearInterval(pollTimer.current);
    pollTimer.current = null;
  }

  function resetAll() {
    clearPolling();
    setJobId("");
    setStatus("idle");
    setProgress(0);
    setLogs([]);
    setError("");
    setResultMeta(null);
  }

  function pushLog(line: string) {
    setLogs((prev) => {
      const next = [...prev, line];
      if (next.length > 400) next.splice(0, next.length - 400);
      return next;
    });
  }

  async function getAuthForBackend() {
    // Prefer Clerk token if signed in
    const token = await getToken().catch(() => null);

    // If backend is in dev mode, allow X-User-Id
    const xUserId = token ? "" : devUserId.trim();

    if (!token && !xUserId) {
      // If Clerk is not working yet, this tells you exactly what to do
      throw new Error(
        "No Clerk token available. If backend is in dev mode, fill in Dev User ID (X-User-Id). Otherwise fix Clerk login first."
      );
    }

    return { token, xUserId };
  }

  async function pollJobOnce(job_id: string) {
    const { token, xUserId } = await getAuthForBackend();

    const data = await backendFetchJson({
      path: `/seo/jobs/${job_id}`,
      method: "GET",
      token,
      xUserId,
    });

    // We normalize expected fields.
    const st = String(data.status ?? "running").toLowerCase();
    const p = clamp01(Number(data.progress ?? 0));
    const logLines: string[] = Array.isArray(data.logs) ? data.logs : [];

    setStatus(
      st === "succeeded"
        ? "succeeded"
        : st === "failed"
        ? "failed"
        : st === "queued"
        ? "queued"
        : "running"
    );

    setProgress(Math.round(p * 100));
    setLogs(logLines);

    if (data.result) setResultMeta(data.result);
    if (data.result_meta) setResultMeta(data.result_meta);

    // stop polling if done
    if (st === "succeeded" || st === "failed") {
      clearPolling();
    }
  }

  function startPolling(job_id: string) {
    clearPolling();
    pollTimer.current = setInterval(() => {
      pollJobOnce(job_id).catch((e) => {
        setError(String(e?.message ?? e));
        clearPolling();
      });
    }, 1200);
  }

  async function runSingle() {
    setError("");
    setLogs([]);
    setProgress(0);
    setStatus("running");
    setResultMeta(null);

    try {
      const { token, xUserId } = await getAuthForBackend();

      pushLog("✅ Building 1-row Excel in browser...");
      const blob = await buildSingleRowXlsx({
        keyword: keyword.trim(),
        brief: brief.trim(),
        wordcounts: cfg.word_count,
      });

      const fileName = `${makeFilenameSafe(keyword)}.xlsx`;
      const file = new File([blob], fileName, {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const form = new FormData();
      form.append("excel", file);
      form.append("config_json", JSON.stringify(cfg));
      // images_zip is optional; in single mode we keep off by default

      pushLog("🚀 POST /seo/jobs ...");
      const resp = await backendUploadMultipart({
        path: "/seo/jobs",
        token,
        xUserId,
        form,
      });

      const id = String(resp.job_id ?? "");
      if (!id) throw new Error("Backend did not return job_id");

      setJobId(id);
      pushLog(`✅ Job created: ${id}`);
      startPolling(id);
      await pollJobOnce(id);
    } catch (e: any) {
      setStatus("failed");
      setError(String(e?.message ?? e));
    }
  }

  async function runBatch() {
    if (!excelFile) return;

    setError("");
    setLogs([]);
    setProgress(0);
    setStatus("running");
    setResultMeta(null);

    try {
      const { token, xUserId } = await getAuthForBackend();

      const form = new FormData();
      form.append("excel", excelFile);
      form.append("config_json", JSON.stringify(cfg));
      if (imagesZip) form.append("images_zip", imagesZip);

      pushLog("🚀 POST /seo/jobs (batch) ...");
      const resp = await backendUploadMultipart({
        path: "/seo/jobs",
        token,
        xUserId,
        form,
      });

      const id = String(resp.job_id ?? "");
      if (!id) throw new Error("Backend did not return job_id");

      setJobId(id);
      pushLog(`✅ Job created: ${id}`);
      startPolling(id);
      await pollJobOnce(id);
    } catch (e: any) {
      setStatus("failed");
      setError(String(e?.message ?? e));
    }
  }

  async function downloadResultXlsx() {
    if (!jobId) return;

    try {
      const { token, xUserId } = await getAuthForBackend();
      const blob = await backendDownloadXlsx({
        path: `/seo/jobs/${jobId}/download`,
        token,
        xUserId,
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `seo_result_${jobId}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
  }

  async function downloadTemplate() {
    try {
      const blob = await buildTemplateXlsx();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `seo_batch_template.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
  }

  // cleanup polling on unmount
  useEffect(() => {
    return () => clearPolling();
  }, []);

  const badge = (() => {
    if (status === "idle") return <Badge variant="outline">Idle</Badge>;
    if (status === "queued") return <Badge variant="outline">Queued</Badge>;
    if (status === "running")
      return (
        <Badge variant="outline" className="flex items-center gap-2">
          <Loader2 className="h-3 w-3 animate-spin" /> Running
        </Badge>
      );
    if (status === "succeeded")
      return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-200">Succeeded</Badge>;
    return <Badge className="bg-red-500/15 text-red-700 dark:text-red-200">Failed</Badge>;
  })();

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Create Content</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Blog Generator • Single + Batch (Excel) • Real backend run
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/home/library"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm hover:bg-accent"
          >
            Content Library <ExternalLink className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <Separator />

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="bg-card">
          <TabsTrigger value="single">Single Article</TabsTrigger>
          <TabsTrigger value="batch">Batch (Excel)</TabsTrigger>
        </TabsList>

        <div className="grid gap-4 lg:grid-cols-[360px_1fr_360px] mt-4">
          {/* LEFT */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                {tab === "single" ? "Inputs" : "Batch Upload"}
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Dev auth helper */}
              <div className="rounded-xl border border-border bg-muted/30 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div className="text-xs text-muted-foreground">
                    If Clerk token is unavailable (dev mode backend), fill Dev User ID.
                    Otherwise leave empty.
                  </div>
                </div>

                <div className="mt-2 space-y-2">
                  <div className="text-xs font-medium">Dev User ID (X-User-Id)</div>
                  <Input
                    value={devUserId}
                    onChange={(e) => setDevUserId(e.target.value)}
                    placeholder='e.g. "user_123"'
                  />
                </div>

                <div className="mt-2 text-[11px] text-muted-foreground">
                  Signed in: <span className="font-medium">{String(!!isSignedIn)}</span>
                </div>
              </div>

              {tab === "single" ? (
                <>
                  <div className="space-y-2">
                    <div className="text-xs font-medium">Keyword</div>
                    <Input
                      value={keyword}
                      onChange={(e) => setKeyword(e.target.value)}
                      placeholder='e.g. "12 volt rv refrigerator"'
                    />
                    <div className="text-[11px] text-muted-foreground">
                      Single mode builds a 1-row .xlsx and runs the same backend pipeline.
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-medium">Brief / Notes (optional)</div>
                    <Textarea
                      value={brief}
                      onChange={(e) => setBrief(e.target.value)}
                      placeholder="constraints, audience, product focus..."
                      className="min-h-[120px]"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      disabled={!canRunSingle || status === "running" || status === "queued"}
                      onClick={runSingle}
                      className="rounded-xl"
                    >
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generate
                    </Button>

                    <Button
                      variant="outline"
                      onClick={resetAll}
                      className="rounded-xl"
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Reset
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-medium">Excel template</div>
                    <Button variant="outline" onClick={downloadTemplate} className="h-8 rounded-xl text-xs">
                      <FileSpreadsheet className="mr-2 h-4 w-4" />
                      Download template
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-medium">Upload Excel (.xlsx)</div>
                    <Input
                      type="file"
                      accept=".xlsx"
                      onChange={(e) => setExcelFile(e.target.files?.[0] ?? null)}
                    />
                    <div className="text-[11px] text-muted-foreground">
                      Must include columns: main_keyword, secondary_keyword, topic, wordcounts, specific.
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-medium">Optional images zip (images_zip)</div>
                    <Input
                      type="file"
                      accept=".zip"
                      onChange={(e) => setImagesZip(e.target.files?.[0] ?? null)}
                    />
                    <div className="text-[11px] text-muted-foreground">
                      If you use server-side image insertion, upload a zip here.
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      disabled={!canRunBatch || status === "running" || status === "queued"}
                      onClick={runBatch}
                      className="rounded-xl"
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Start batch
                    </Button>

                    <Button
                      variant="outline"
                      onClick={resetAll}
                      className="rounded-xl"
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Reset
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* MIDDLE */}
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div className="space-y-1">
                <CardTitle className="text-sm">Run</CardTitle>
                <div className="text-[11px] text-muted-foreground">
                  Job: <span className="font-medium">{jobId || "-"}</span> • Progress:{" "}
                  <span className="font-medium">{progress}%</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {badge}
                <Button
                  variant="outline"
                  disabled={!jobId || status !== "succeeded"}
                  onClick={downloadResultXlsx}
                  className="rounded-xl"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download xlsx
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* progress bar */}
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${progress}%` }}
                />
              </div>

              {error ? (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-200">
                  <div className="font-medium">Error</div>
                  <div className="mt-1 whitespace-pre-wrap text-xs">{error}</div>
                </div>
              ) : null}

              <div className="grid gap-4 xl:grid-cols-2">
                {/* logs */}
                <div className="rounded-2xl border border-border bg-card p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-xs font-medium">Logs</div>
                    <div className="text-[11px] text-muted-foreground">
                      {logs.length} lines
                    </div>
                  </div>

                  <div className="h-[360px] overflow-auto rounded-xl bg-muted/30 p-3 text-[12px] leading-relaxed">
                    {logs.length === 0 ? (
                      <div className="text-muted-foreground">
                        No logs yet. Start a job.
                      </div>
                    ) : (
                      logs.map((l, idx) => (
                        <div key={idx} className="whitespace-pre-wrap">
                          {l}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* result preview / meta */}
                <div className="rounded-2xl border border-border bg-card p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-xs font-medium">Result</div>
                    <div className="text-[11px] text-muted-foreground">
                      Backend output is xlsx (download)
                    </div>
                  </div>

                  <div className="h-[360px] overflow-auto rounded-xl bg-muted/30 p-3 text-[12px]">
                    {status === "succeeded" ? (
                      <>
                        <div className="text-sm font-medium">✅ Job finished</div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          Download the xlsx result. (Your legacy pipeline writes final content into the spreadsheet.)
                        </div>

                        {resultMeta ? (
                          <pre className="mt-3 whitespace-pre-wrap text-[12px]">
                            {JSON.stringify(resultMeta, null, 2)}
                          </pre>
                        ) : (
                          <div className="mt-3 text-xs text-muted-foreground">
                            (No meta returned from backend.)
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-muted-foreground">
                        Result will be available after job succeeds.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* RIGHT */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Advanced Settings</CardTitle>
            </CardHeader>

            <CardContent className="space-y-5">
              {/* basics */}
              <div className="grid gap-3">
                <div className="grid gap-2">
                  <div className="text-xs font-medium">Language</div>
                  <Select
                    value={cfg.language}
                    onValueChange={(v) => setCfg((p) => ({ ...p, language: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="de">Deutsch</SelectItem>
                      <SelectItem value="fr">Français</SelectItem>
                      <SelectItem value="es">Español</SelectItem>
                      <SelectItem value="zh">中文</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <div className="text-xs font-medium">Mode</div>
                  <Select
                    value={cfg.mode}
                    onValueChange={(v) => setCfg((p) => ({ ...p, mode: v as any }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SEO">SEO Blog</SelectItem>
                      <SelectItem value="GEO">GEO Local</SelectItem>
                      <SelectItem value="Landing">Landing Page</SelectItem>
                      <SelectItem value="Product">Product Page</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <div className="text-xs font-medium">Tone</div>
                  <Select
                    value={cfg.tone}
                    onValueChange={(v) => setCfg((p) => ({ ...p, tone: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Professional">Professional</SelectItem>
                      <SelectItem value="Friendly">Friendly</SelectItem>
                      <SelectItem value="Authoritative">Authoritative</SelectItem>
                      <SelectItem value="Conversational">Conversational</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <div className="text-xs font-medium">Word Count</div>
                  <Input
                    value={String(cfg.word_count)}
                    onChange={(e) =>
                      setCfg((p) => ({
                        ...p,
                        word_count: safeInt(e.target.value, p.word_count),
                      }))
                    }
                  />
                </div>
              </div>

              <Separator />

              {/* models */}
              <div className="grid gap-3">
                <div className="text-xs font-medium">Models</div>

                <div className="grid gap-2">
                  <div className="text-[11px] text-muted-foreground">Outline model</div>
                  <Select
                    value={cfg.model_outline}
                    onValueChange={(v) => setCfg((p) => ({ ...p, model_outline: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gpt-4o-mini">gpt-4o-mini</SelectItem>
                      <SelectItem value="gpt-4.1-mini">gpt-4.1-mini</SelectItem>
                      <SelectItem value="claude-3.5-sonnet">claude-3.5-sonnet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <div className="text-[11px] text-muted-foreground">Writer model</div>
                  <Select
                    value={cfg.model_writer}
                    onValueChange={(v) => setCfg((p) => ({ ...p, model_writer: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gpt-4o-mini">gpt-4o-mini</SelectItem>
                      <SelectItem value="gpt-4.1">gpt-4.1</SelectItem>
                      <SelectItem value="claude-3.5-sonnet">claude-3.5-sonnet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              {/* media */}
              <div className="space-y-3">
                <div className="text-xs font-medium">Media</div>

                <div className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2.5">
                  <div>
                    <div className="text-sm">Images</div>
                    <div className="text-[11px] text-muted-foreground">
                      Generate images and insert into content
                    </div>
                  </div>
                  <Switch
                    checked={cfg.enable_images}
                    onCheckedChange={(v) => setCfg((p) => ({ ...p, enable_images: v }))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <div className="text-[11px] text-muted-foreground">Image count</div>
                    <Input
                      disabled={!cfg.enable_images}
                      value={String(cfg.image_count)}
                      onChange={(e) =>
                        setCfg((p) => ({
                          ...p,
                          image_count: safeInt(e.target.value, p.image_count),
                        }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2.5">
                    <div>
                      <div className="text-sm">Video</div>
                      <div className="text-[11px] text-muted-foreground">YouTube embed</div>
                    </div>
                    <Switch
                      checked={cfg.enable_video}
                      onCheckedChange={(v) =>
                        setCfg((p) => ({
                          ...p,
                          enable_video: v,
                          video_provider: v ? "youtube" : "none",
                        }))
                      }
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* links & evidence */}
              <div className="space-y-3">
                <div className="text-xs font-medium">Links & Evidence</div>

                <div className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2.5">
                  <div>
                    <div className="text-sm">Internal links</div>
                    <div className="text-[11px] text-muted-foreground">Insert internal links</div>
                  </div>
                  <Switch
                    checked={cfg.enable_internal_links}
                    onCheckedChange={(v) => setCfg((p) => ({ ...p, enable_internal_links: v }))}
                  />
                </div>

                <div className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2.5">
                  <div>
                    <div className="text-sm">External links</div>
                    <div className="text-[11px] text-muted-foreground">Citations & outbound sources</div>
                  </div>
                  <Switch
                    checked={cfg.enable_external_links}
                    onCheckedChange={(v) => setCfg((p) => ({ ...p, enable_external_links: v }))}
                  />
                </div>

                <div className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2.5">
                  <div>
                    <div className="text-sm">Facts & evidence</div>
                    <div className="text-[11px] text-muted-foreground">Generate evidence + cite</div>
                  </div>
                  <Switch
                    checked={cfg.enable_facts}
                    onCheckedChange={(v) => setCfg((p) => ({ ...p, enable_facts: v }))}
                  />
                </div>

                <div className="grid gap-2">
                  <div className="text-[11px] text-muted-foreground">Citations style</div>
                  <Select
                    value={cfg.citations_style}
                    onValueChange={(v) => setCfg((p) => ({ ...p, citations_style: v as any }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="inline">Inline</SelectItem>
                      <SelectItem value="footnote">Footnote</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              {/* raw config */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium">config_json</div>
                  <Button
                    variant="outline"
                    className="h-8 rounded-xl px-3 text-xs"
                    onClick={() => setCfg({ ...DEFAULT_CONFIG })}
                  >
                    Reset defaults
                  </Button>
                </div>

                <div className="rounded-xl border border-border bg-muted/30 p-3 text-[12px]">
                  <pre className="whitespace-pre-wrap">{JSON.stringify(cfg, null, 2)}</pre>
                </div>

                <div className="text-[11px] text-muted-foreground">
                  This JSON is sent as <code>config_json</code> to backend <code>/seo/jobs</code>.
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </Tabs>
    </div>
  );
}
