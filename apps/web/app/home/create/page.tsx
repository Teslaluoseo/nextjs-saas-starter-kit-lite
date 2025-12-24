"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Sparkles, Play, Pause, RotateCcw, Download, ExternalLink } from "lucide-react";

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

  // Right column
  const [cfg, setCfg] = useState<AdvancedConfig>({ ...DEFAULT_CONFIG });

  // Middle column
  const [status, setStatus] = useState<JobStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [resultMarkdown, setResultMarkdown] = useState<string>("");
  const [resultMeta, setResultMeta] = useState<{ title?: string; createdAt?: string }>({});

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const canRun = useMemo(() => keyword.trim().length > 0, [keyword]);

  function pushLog(line: string) {
    setLogs((prev) => {
      const next = [...prev, line];
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
    let localProgress = 0;

    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
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
    <div className="p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Create Content</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Blog Generator • 3-column workflow (Inputs → Run → Settings)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/home/library"
            className="inline-flex items-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm hover:bg-muted"
          >
            Content Library <ExternalLink className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <Separator className="my-5" />

      {/* 3 columns */}
      <div className="grid gap-4 lg:grid-cols-[320px_1fr_360px]">
        {/* LEFT */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Inputs</CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="text-xs font-medium">Keyword</div>
              <Input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder='e.g. "best CRM for manufacturers"'
              />
              <div className="text-[11px] text-muted-foreground">
                Required. This drives search → outline → writing.
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-medium">Site</div>
              <Select value={site} onValueChange={setSite}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a site" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Default Site">Default Site</SelectItem>
                  <SelectItem value="Site A">Site A</SelectItem>
                  <SelectItem value="Site B">Site B</SelectItem>
                </SelectContent>
              </Select>
              <div className="text-[11px] text-muted-foreground">
                Later we will load real sites from backend.
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-medium">Brief / Notes (optional)</div>
              <Textarea
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                placeholder="Any constraints, audience, product focus..."
                className="min-h-[120px]"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button disabled={!canRun || status === "running"} onClick={runJob} className="rounded-xl">
                <Sparkles className="mr-2 h-4 w-4" />
                Generate
              </Button>

              {status === "running" ? (
                <Button variant="outline" onClick={pause} className="rounded-xl">
                  <Pause className="mr-2 h-4 w-4" />
                  Pause
                </Button>
              ) : null}

              {status === "paused" ? (
                <Button variant="outline" onClick={resume} className="rounded-xl">
                  <Play className="mr-2 h-4 w-4" />
                  Resume
                </Button>
              ) : null}

              <Button variant="outline" onClick={resetAll} className="rounded-xl">
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* MIDDLE */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div className="space-y-1">
              <CardTitle className="text-sm">Run</CardTitle>
              <div className="text-[11px] text-muted-foreground">
                Status: <span className="text-foreground">{status.toUpperCase()}</span> • Progress:{" "}
                <span className="text-foreground">{progress}%</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {status === "succeeded" ? (
                <Badge className="rounded-full">Done</Badge>
              ) : status === "failed" ? (
                <Badge variant="destructive" className="rounded-full">Failed</Badge>
              ) : status === "running" ? (
                <Badge className="rounded-full">Running</Badge>
              ) : status === "paused" ? (
                <Badge className="rounded-full">Paused</Badge>
              ) : (
                <Badge variant="secondary" className="rounded-full">Idle</Badge>
              )}

              <Button variant="outline" disabled={!resultMarkdown} onClick={downloadMarkdown} className="rounded-xl">
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            {/* progress bar */}
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              {/* logs */}
              <div className="rounded-2xl border bg-card p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-xs font-medium">Logs</div>
                  <div className="text-[11px] text-muted-foreground">{logs.length} lines</div>
                </div>

                <div className="h-[340px] overflow-auto rounded-xl bg-background p-3 text-[12px] leading-relaxed">
                  {logs.length === 0 ? (
                    <div className="text-muted-foreground">No logs yet. Click Generate.</div>
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
              <div className="rounded-2xl border bg-card p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-xs font-medium">Preview</div>
                  <div className="text-[11px] text-muted-foreground">Markdown (mock)</div>
                </div>

                <Tabs defaultValue="md">
                  <TabsList>
                    <TabsTrigger value="md">Markdown</TabsTrigger>
                    <TabsTrigger value="raw">Raw</TabsTrigger>
                  </TabsList>

                  <TabsContent value="md" className="mt-3">
                    <div className="h-[340px] overflow-auto rounded-xl bg-background p-3 text-[13px] leading-relaxed">
                      {resultMarkdown ? (
                        <pre className="whitespace-pre-wrap">{resultMarkdown}</pre>
                      ) : (
                        <div className="text-muted-foreground">Result will appear here after job finishes.</div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="raw" className="mt-3">
                    <div className="h-[340px] overflow-auto rounded-xl bg-background p-3 text-[12px]">
                      <pre className="whitespace-pre-wrap">
                        {JSON.stringify({ keyword, site, brief, config_json: cfg }, null, 2)}
                      </pre>
                    </div>
                  </TabsContent>
                </Tabs>
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
                <Select value={cfg.language} onValueChange={(v) => setCfg((p) => ({ ...p, language: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="zh">中文</SelectItem>
                    <SelectItem value="de">Deutsch</SelectItem>
                    <SelectItem value="fr">Français</SelectItem>
                    <SelectItem value="es">Español</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <div className="text-xs font-medium">Mode</div>
                <Select value={cfg.mode} onValueChange={(v) => setCfg((p) => ({ ...p, mode: v }))}>
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
                <Select value={cfg.tone} onValueChange={(v) => setCfg((p) => ({ ...p, tone: v }))}>
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
                  onChange={(e) => setCfg((p) => ({ ...p, word_count: safeInt(e.target.value, p.word_count) }))}
                />
              </div>
            </div>

            <Separator />

            {/* models */}
            <div className="grid gap-3">
              <div className="text-xs font-medium">Models</div>

              <div className="grid gap-2">
                <div className="text-[11px] text-muted-foreground">Outline model</div>
                <Select value={cfg.model_outline} onValueChange={(v) => setCfg((p) => ({ ...p, model_outline: v }))}>
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
                <Select value={cfg.model_writer} onValueChange={(v) => setCfg((p) => ({ ...p, model_writer: v }))}>
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

              <div className="flex items-center justify-between rounded-xl border bg-card px-3 py-2.5">
                <div>
                  <div className="text-sm">Images</div>
                  <div className="text-[11px] text-muted-foreground">
                    Generate images and insert into content
                  </div>
                </div>
                <Switch checked={cfg.enable_images} onCheckedChange={(v) => setCfg((p) => ({ ...p, enable_images: v }))} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <div className="text-[11px] text-muted-foreground">Image count</div>
                  <Input
                    disabled={!cfg.enable_images}
                    value={String(cfg.image_count)}
                    onChange={(e) => setCfg((p) => ({ ...p, image_count: safeInt(e.target.value, p.image_count) }))}
                  />
                </div>

                <div className="flex items-center justify-between rounded-xl border bg-card px-3 py-2.5">
                  <div>
                    <div className="text-sm">Video</div>
                    <div className="text-[11px] text-muted-foreground">YouTube embed</div>
                  </div>
                  <Switch
                    checked={cfg.enable_video}
                    onCheckedChange={(v) => setCfg((p) => ({ ...p, enable_video: v, video_provider: v ? "youtube" : "none" }))}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* raw config */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium">config_json</div>
                <Button variant="outline" className="h-8 rounded-xl px-3 text-xs" onClick={() => setCfg({ ...DEFAULT_CONFIG })}>
                  Reset defaults
                </Button>
              </div>

              <div className="rounded-xl border bg-card p-3 text-[12px]">
                <pre className="whitespace-pre-wrap">{JSON.stringify(cfg, null, 2)}</pre>
              </div>

              <div className="text-[11px] text-muted-foreground">
                Next step: send this as config_json to backend /seo/jobs.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

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
      ? `\n\n## Images\n- [Image #1]\n- [Image #2]\n- [Image #3]\n- [Image #4]\n`
      : "";

  const video =
    cfg.enable_video ? `\n\n## Video\n- YouTube embed: https://youtube.com/watch?v=dQw4w9WgXcQ\n` : "";

  return `# ${title}

**Product:** Blog Generator  
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
Replace this with your real pipeline output later.

${media}
${video}
${citations}
`;
}
