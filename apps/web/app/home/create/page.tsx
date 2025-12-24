"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Sparkles, Play, Pause, RotateCcw, Download, ExternalLink } from "lucide-react";

// Makerkit UI (shadcn wrappers)
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

type JobStatus = "idle" | "running" | "succeeded" | "failed" | "paused";

type AdvancedConfig = {
  // 和你之前 Streamlit config_json 类似：可选字段 + 默认值
  language: string;
  mode: string;
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

  // 允许未知字段（后端阶段A会用 Pydantic 忽略）
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

function safeInt(v: string, fallback: number) {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

export default function CreateContentPage() {
  // Left column
  const [keyword, setKeyword] = useState("");
  const [site, setSite] = useState("Default Site");
  const [brief, setBrief] = useState("");

  // Right column (Advanced)
  const [cfg, setCfg] = useState<AdvancedConfig>({ ...DEFAULT_CONFIG });

  // Middle column
  const [status, setStatus] = useState<JobStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [resultMarkdown, setResultMarkdown] = useState<string>("");
  const [resultMeta, setResultMeta] = useState<{ title?: string; createdAt?: string }>(
    {}
  );

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const canRun = useMemo(() => keyword.trim().length > 0, [keyword]);

  function pushLog(line: string) {
    setLogs((prev) => {
      const next = [...prev, line];
      // 控制最大行数，避免页面卡顿
      if (next.length > 300) next.splice(0, next.length - 300);
      return next;
    });
  }

  function resetAll() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;

    setStatus("idle");
    setProgress(0);
    setLogs([]);
    setResultMarkdown("");
    setResultMeta({});
  }

  function pause() {
    if (status !== "running") return;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setStatus("paused");
    pushLog("⏸ Paused.");
  }

  function resume() {
    if (status !== "paused") return;
    setStatus("running");
    pushLog("▶ Resumed.");
    startMockPipeline();
  }

  // ✅ 先用前端模拟任务（不依赖后端，不会 401）
  function runJob() {
    resetAll();
    setStatus("running");
    setResultMeta({
      title: `${keyword.trim()} — ${cfg.mode}`,
      createdAt: new Date().toISOString(),
    });

    pushLog("✅ Job created.");
    pushLog(`• Site: ${site}`);
    pushLog(`• Language: ${cfg.language} | Mode: ${cfg.mode}`);
    pushLog(`• Writer: ${cfg.model_writer} | Outline: ${cfg.model_outline}`);
    pushLog("—");
    startMockPipeline();
  }

  function startMockPipeline() {
    // 分阶段模拟 QuickCreator：Search → Extract → Outline → Write → Images → Finalize
    const steps = [
      { p: 10, t: "🔎 Searching web sources (mock)..." },
      { p: 25, t: "🧠 Extracting facts & evidence (mock)..." },
      { p: 40, t: "🧩 Building outline (mock)..." },
      { p: 65, t: "✍️ Writing article draft (mock)..." },
      {
        p: 82,
        t: cfg.enable_images
          ? `🖼 Generating ${cfg.image_count} images (mock)...`
          : "🖼 Images disabled.",
      },
      { p: 95, t: "🧷 Inserting links & citations (mock)..." },
      { p: 100, t: "✅ Finalizing output..." },
    ];

    let i = 0;
    let localProgress = progress;

    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      // 被暂停就不走
      setStatus((s) => s);

      // 如果用户点了 pause，外部会 clearInterval
      if (i >= steps.length) {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;

        setProgress(100);
        setStatus("succeeded");
        pushLog("✅ Job succeeded.");

        const md = buildMockMarkdown({ keyword, site, brief, cfg });
        setResultMarkdown(md);

        return;
      }

      const step = steps[i];
      pushLog(step.t);

      // 平滑推进进度
      const target = step.p;
      const tick = setInterval(() => {
        localProgress = Math.min(target, localProgress + 2);
        setProgress(localProgress);

        if (localProgress >= target) {
          clearInterval(tick);
          i += 1;
        }
      }, 80);
    }, 900);
  }

  function downloadMarkdown() {
    if (!resultMarkdown) return;
    const blob = new Blob([resultMarkdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `${(resultMeta.title ?? "article").replaceAll(" ", "-")}.md`;
    a.click();

    URL.revokeObjectURL(url);
  }

  return (
    <div className="text-zinc-100">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Create Content</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Streamlit-like controls + QuickCreator 3-column workflow.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/home/library"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-200 hover:bg-white/6"
          >
            Content Library <ExternalLink className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <Separator className="my-5 bg-white/5" />

      {/* 3 columns */}
      <div className="grid gap-4 lg:grid-cols-[320px_1fr_360px]">
        {/* LEFT: inputs */}
        <Card className="border-white/5 bg-white/[0.02]">
          <CardHeader>
            <CardTitle className="text-sm">Inputs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="text-xs font-medium text-zinc-300">Keyword</div>
              <Input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder='e.g. "best CRM for manufacturers"'
                className="border-white/10 bg-white/[0.03] text-zinc-100 placeholder:text-zinc-500"
              />
              <div className="text-[11px] text-zinc-500">
                Required. This drives search → outline → writing.
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-medium text-zinc-300">Site</div>
              <Select value={site} onValueChange={setSite}>
                <SelectTrigger className="border-white/10 bg-white/[0.03]">
                  <SelectValue placeholder="Select a site" />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-zinc-950 text-zinc-100">
                  <SelectItem value="Default Site">Default Site</SelectItem>
                  <SelectItem value="Site A">Site A</SelectItem>
                  <SelectItem value="Site B">Site B</SelectItem>
                </SelectContent>
              </Select>
              <div className="text-[11px] text-zinc-500">
                Later we will load real sites from backend.
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-medium text-zinc-300">
                Brief / Notes (optional)
              </div>
              <Textarea
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                placeholder="Any constraints, audience, product focus..."
                className="min-h-[120px] border-white/10 bg-white/[0.03] text-zinc-100 placeholder:text-zinc-500"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                disabled={!canRun || status === "running"}
                onClick={runJob}
                className="rounded-xl bg-gradient-to-r from-violet-500 to-sky-400 text-black hover:opacity-95"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Generate
              </Button>

              {status === "running" ? (
                <Button
                  variant="outline"
                  onClick={pause}
                  className="rounded-xl border-white/10 bg-white/[0.03] hover:bg-white/6"
                >
                  <Pause className="mr-2 h-4 w-4" />
                  Pause
                </Button>
              ) : null}

              {status === "paused" ? (
                <Button
                  variant="outline"
                  onClick={resume}
                  className="rounded-xl border-white/10 bg-white/[0.03] hover:bg-white/6"
                >
                  <Play className="mr-2 h-4 w-4" />
                  Resume
                </Button>
              ) : null}

              <Button
                variant="outline"
                onClick={resetAll}
                className="rounded-xl border-white/10 bg-white/[0.03] hover:bg-white/6"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* MIDDLE: progress/log/preview */}
        <Card className="border-white/5 bg-white/[0.02]">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div className="space-y-1">
              <CardTitle className="text-sm">Run</CardTitle>
              <div className="text-[11px] text-zinc-500">
                Status:{" "}
                <span className="text-zinc-200">
                  {status.toUpperCase()}
                </span>{" "}
                • Progress:{" "}
                <span className="text-zinc-200">{progress}%</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {status === "succeeded" ? (
                <Badge className="border border-emerald-400/20 bg-emerald-500/15 text-emerald-200">
                  Done
                </Badge>
              ) : status === "failed" ? (
                <Badge className="border border-red-400/20 bg-red-500/15 text-red-200">
                  Failed
                </Badge>
              ) : status === "running" ? (
                <Badge className="border border-sky-400/20 bg-sky-500/15 text-sky-200">
                  Running
                </Badge>
              ) : status === "paused" ? (
                <Badge className="border border-amber-400/20 bg-amber-500/15 text-amber-200">
                  Paused
                </Badge>
              ) : (
                <Badge className="border border-zinc-400/10 bg-white/[0.03] text-zinc-300">
                  Idle
                </Badge>
              )}

              <Button
                variant="outline"
                disabled={!resultMarkdown}
                onClick={downloadMarkdown}
                className="rounded-xl border-white/10 bg-white/[0.03] hover:bg-white/6"
              >
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            {/* progress bar */}
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-sky-400"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              {/* logs */}
              <div className="rounded-2xl border border-white/5 bg-black/20 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-xs font-medium text-zinc-300">Logs</div>
                  <div className="text-[11px] text-zinc-500">
                    {logs.length} lines
                  </div>
                </div>

                <div className="h-[340px] overflow-auto rounded-xl bg-black/30 p-3 text-[12px] leading-relaxed text-zinc-200">
                  {logs.length === 0 ? (
                    <div className="text-zinc-500">
                      No logs yet. Click Generate.
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

              {/* preview */}
              <div className="rounded-2xl border border-white/5 bg-black/20 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-xs font-medium text-zinc-300">
                    Preview
                  </div>
                  <div className="text-[11px] text-zinc-500">
                    Markdown (mock)
                  </div>
                </div>

                <Tabs defaultValue="md">
                  <TabsList className="bg-white/[0.03]">
                    <TabsTrigger value="md">Markdown</TabsTrigger>
                    <TabsTrigger value="raw">Raw</TabsTrigger>
                  </TabsList>

                  <TabsContent value="md" className="mt-3">
                    <div className="h-[340px] overflow-auto rounded-xl bg-black/30 p-3 text-[13px] leading-relaxed text-zinc-100">
                      {resultMarkdown ? (
                        <pre className="whitespace-pre-wrap">{resultMarkdown}</pre>
                      ) : (
                        <div className="text-zinc-500">
                          Result will appear here after job finishes.
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="raw" className="mt-3">
                    <div className="h-[340px] overflow-auto rounded-xl bg-black/30 p-3 text-[12px] text-zinc-200">
                      <pre className="whitespace-pre-wrap">
                        {JSON.stringify(
                          { keyword, site, brief, config_json: cfg },
                          null,
                          2
                        )}
                      </pre>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* RIGHT: Advanced settings */}
        <Card className="border-white/5 bg-white/[0.02]">
          <CardHeader>
            <CardTitle className="text-sm">Advanced Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* basics */}
            <div className="grid gap-3">
              <div className="grid gap-2">
                <div className="text-xs font-medium text-zinc-300">Language</div>
                <Select
                  value={cfg.language}
                  onValueChange={(v) => setCfg((p) => ({ ...p, language: v }))}
                >
                  <SelectTrigger className="border-white/10 bg-white/[0.03]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-white/10 bg-zinc-950 text-zinc-100">
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="de">Deutsch</SelectItem>
                    <SelectItem value="fr">Français</SelectItem>
                    <SelectItem value="es">Español</SelectItem>
                    <SelectItem value="zh">中文</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <div className="text-xs font-medium text-zinc-300">Mode</div>
                <Select
                  value={cfg.mode}
                  onValueChange={(v) => setCfg((p) => ({ ...p, mode: v }))}
                >
                  <SelectTrigger className="border-white/10 bg-white/[0.03]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-white/10 bg-zinc-950 text-zinc-100">
                    <SelectItem value="SEO">SEO Blog</SelectItem>
                    <SelectItem value="GEO">GEO Local</SelectItem>
                    <SelectItem value="Landing">Landing Page</SelectItem>
                    <SelectItem value="Product">Product Page</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <div className="text-xs font-medium text-zinc-300">Tone</div>
                <Select
                  value={cfg.tone}
                  onValueChange={(v) => setCfg((p) => ({ ...p, tone: v }))}
                >
                  <SelectTrigger className="border-white/10 bg-white/[0.03]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-white/10 bg-zinc-950 text-zinc-100">
                    <SelectItem value="Professional">Professional</SelectItem>
                    <SelectItem value="Friendly">Friendly</SelectItem>
                    <SelectItem value="Authoritative">Authoritative</SelectItem>
                    <SelectItem value="Conversational">Conversational</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <div className="text-xs font-medium text-zinc-300">Word Count</div>
                <Input
                  value={String(cfg.word_count)}
                  onChange={(e) =>
                    setCfg((p) => ({ ...p, word_count: safeInt(e.target.value, p.word_count) }))
                  }
                  className="border-white/10 bg-white/[0.03] text-zinc-100"
                />
              </div>
            </div>

            <Separator className="bg-white/5" />

            {/* models */}
            <div className="grid gap-3">
              <div className="text-xs font-medium text-zinc-300">Models</div>

              <div className="grid gap-2">
                <div className="text-[11px] text-zinc-500">Outline model</div>
                <Select
                  value={cfg.model_outline}
                  onValueChange={(v) => setCfg((p) => ({ ...p, model_outline: v }))}
                >
                  <SelectTrigger className="border-white/10 bg-white/[0.03]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-white/10 bg-zinc-950 text-zinc-100">
                    <SelectItem value="gpt-4o-mini">gpt-4o-mini</SelectItem>
                    <SelectItem value="gpt-4.1-mini">gpt-4.1-mini</SelectItem>
                    <SelectItem value="claude-3.5-sonnet">claude-3.5-sonnet</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <div className="text-[11px] text-zinc-500">Writer model</div>
                <Select
                  value={cfg.model_writer}
                  onValueChange={(v) => setCfg((p) => ({ ...p, model_writer: v }))}
                >
                  <SelectTrigger className="border-white/10 bg-white/[0.03]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-white/10 bg-zinc-950 text-zinc-100">
                    <SelectItem value="gpt-4o-mini">gpt-4o-mini</SelectItem>
                    <SelectItem value="gpt-4.1">gpt-4.1</SelectItem>
                    <SelectItem value="claude-3.5-sonnet">claude-3.5-sonnet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator className="bg-white/5" />

            {/* media */}
            <div className="space-y-3">
              <div className="text-xs font-medium text-zinc-300">Media</div>

              <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5">
                <div>
                  <div className="text-sm text-zinc-200">Images</div>
                  <div className="text-[11px] text-zinc-500">Generate images and insert into content</div>
                </div>
                <Switch
                  checked={cfg.enable_images}
                  onCheckedChange={(v) => setCfg((p) => ({ ...p, enable_images: v }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <div className="text-[11px] text-zinc-500">Image count</div>
                  <Input
                    disabled={!cfg.enable_images}
                    value={String(cfg.image_count)}
                    onChange={(e) =>
                      setCfg((p) => ({ ...p, image_count: safeInt(e.target.value, p.image_count) }))
                    }
                    className="border-white/10 bg-white/[0.03] text-zinc-100"
                  />
                </div>

                <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5">
                  <div>
                    <div className="text-sm text-zinc-200">Video</div>
                    <div className="text-[11px] text-zinc-500">YouTube embed</div>
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

            <Separator className="bg-white/5" />

            {/* links & evidence */}
            <div className="space-y-3">
              <div className="text-xs font-medium text-zinc-300">Links & Evidence</div>

              <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5">
                <div>
                  <div className="text-sm text-zinc-200">Internal links</div>
                  <div className="text-[11px] text-zinc-500">Insert internal links (sitemap / rules)</div>
                </div>
                <Switch
                  checked={cfg.enable_internal_links}
                  onCheckedChange={(v) => setCfg((p) => ({ ...p, enable_internal_links: v }))}
                />
              </div>

              <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5">
                <div>
                  <div className="text-sm text-zinc-200">External links</div>
                  <div className="text-[11px] text-zinc-500">Citations & outbound sources</div>
                </div>
                <Switch
                  checked={cfg.enable_external_links}
                  onCheckedChange={(v) => setCfg((p) => ({ ...p, enable_external_links: v }))}
                />
              </div>

              <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5">
                <div>
                  <div className="text-sm text-zinc-200">Facts & evidence</div>
                  <div className="text-[11px] text-zinc-500">Generate evidence sentences and cite</div>
                </div>
                <Switch
                  checked={cfg.enable_facts}
                  onCheckedChange={(v) => setCfg((p) => ({ ...p, enable_facts: v }))}
                />
              </div>

              <div className="grid gap-2">
                <div className="text-[11px] text-zinc-500">Citations style</div>
                <Select
                  value={cfg.citations_style}
                  onValueChange={(v) => setCfg((p) => ({ ...p, citations_style: v }))}
                >
                  <SelectTrigger className="border-white/10 bg-white/[0.03]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-white/10 bg-zinc-950 text-zinc-100">
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="inline">Inline</SelectItem>
                    <SelectItem value="footnote">Footnote</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator className="bg-white/5" />

            {/* raw config */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium text-zinc-300">config_json</div>
                <Button
                  variant="outline"
                  className="h-8 rounded-xl border-white/10 bg-white/[0.03] px-3 text-xs hover:bg-white/6"
                  onClick={() => setCfg({ ...DEFAULT_CONFIG })}
                >
                  Reset defaults
                </Button>
              </div>

              <div className="rounded-xl border border-white/5 bg-black/20 p-3 text-[12px] text-zinc-200">
                <pre className="whitespace-pre-wrap">
                  {JSON.stringify(cfg, null, 2)}
                </pre>
              </div>

              <div className="text-[11px] text-zinc-500">
                Next step: send this as config_json to backend /seo/jobs.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/** 构造一个“看起来像你真实输出”的 mock markdown（用于 UI 测试） */
function buildMockMarkdown({
  keyword,
  site,
  brief,
  cfg,
}: {
  keyword: string;
  site: string;
  brief: string;
  cfg: AdvancedConfig;
}) {
  const title = `${keyword.trim()} (${cfg.mode})`;
  const now = new Date().toLocaleString();

  const citations =
    cfg.enable_external_links && cfg.enable_facts && cfg.citations_style !== "none"
      ? `\n\n## Sources\n- https://example.com/source-1\n- https://example.com/source-2`
      : "";

  const media =
    cfg.enable_images
      ? `\n\n## Images\n- [BOM Image #1]\n- [BOM Image #2]\n- [BOM Image #3]\n- [BOM Image #4]\n`
      : "";

  const video =
    cfg.enable_video ? `\n\n## Video\n- YouTube embed: https://youtube.com/watch?v=dQw4w9WgXcQ\n` : "";

  return `# ${title}

**Site:** ${site}  
**Language:** ${cfg.language}  
**Tone:** ${cfg.tone}  
**Word target:** ~${cfg.word_count}  
**Generated:** ${now}

---

## Introduction
This is a mock output to test UI and workflow.  
Keyword: **${keyword.trim()}**.

${brief ? `## Brief\n${brief}\n` : ""}

## Outline
1. What it is and why it matters
2. Key considerations
3. Step-by-step process
4. FAQs

## Draft (Mock)
Write your real content here later.  
This page is only to validate the QuickCreator-like user experience: **3-column generator + advanced settings + logs + preview**.

${media}
${video}
${citations}
`;
}
