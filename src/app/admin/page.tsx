"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { TEMPLATES, CATEGORIES, type Template, type TemplateCategory } from "@/lib/templates";
import { isClientRenderSupported, renderInBrowser } from "@/lib/client-renderer";

const ADMIN_PASSWORD = "spacecubed";
const SESSION_KEY = "hyperaspect_admin_auth";
const RENDER_HEALTH_URL = "https://render.coreaspectai.com/health";
const MAX_CONCURRENT = 3;

type Job = {
  id: string;
  video_name: string;
  status: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  frames_total: number;
  frames_captured: number;
  output_path: string | null;
  error: string | null;
  priority: number;
};

type TabId = "stats" | "templates" | "queue" | "metrics" | "health";

// Neo-brutalist design tokens
const C = {
  cream: "#fef6e4",
  ink: "#0a0a0a",
  paper: "#ffffff",
  sun: "#ffd803",
  pink: "#ff8fab",
  blue: "#4dabf7",
  green: "#51cf66",
  red: "#ff5a5f",
  gray: "#868e96",
  violet: "#a78bfa",
  orange: "#ff922b",
};

const SHADOW = "6px 6px 0 #0a0a0a";
const SHADOW_SM = "4px 4px 0 #0a0a0a";
const BORDER = "4px solid #0a0a0a";
const BORDER_SM = "3px solid #0a0a0a";

const STATUS_STYLE: Record<string, { bg: string; label: string }> = {
  pending: { bg: C.gray, label: "Queued" },
  running: { bg: C.blue, label: "Rendering" },
  completed: { bg: C.green, label: "Done" },
  failed: { bg: C.red, label: "Failed" },
  "failed-rescued": { bg: C.orange, label: "Rescued" },
};

const TABS: { id: TabId; label: string; emoji: string }[] = [
  { id: "stats", label: "Stats", emoji: "📈" },
  { id: "templates", label: "Templates", emoji: "🗂️" },
  { id: "queue", label: "Render Queue", emoji: "🎥" },
  { id: "metrics", label: "Metrics", emoji: "📊" },
  { id: "health", label: "System Health", emoji: "🩺" },
];

// Helpers
function renderSeconds(job: Job): number | null {
  if (!job.started_at || !job.finished_at) return null;
  const ms = new Date(job.finished_at).getTime() - new Date(job.started_at).getTime();
  return ms > 0 ? Math.round(ms / 1000) : null;
}

function defaultVariablesFor(tpl: Template): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [key, slot] of Object.entries(tpl.slots)) {
    if (slot.required) {
      vars[key] = slot.default || slot.example || "HyperAspect";
    }
  }
  return vars;
}

function humanBytes(n: number | null | undefined): string {
  if (!n || n <= 0) return "—";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return v.toFixed(v < 10 && i > 0 ? 1 : 0) + " " + u[i];
}

export default function AdminPage() {
  // Auth state
  const [authed, setAuthed] = useState(false);
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState(false);

  // Data state
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>("");

  // UI state
  const [activeTab, setActiveTab] = useState<TabId>("stats");
  const [queueFilter, setQueueFilter] = useState<string>("all");
  const [deleteTarget, setDeleteTarget] = useState<Job | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Template browser state
  const [tplCategory, setTplCategory] = useState<string>("all");
  const [tplSearch, setTplSearch] = useState("");
  const [testingTpl, setTestingTpl] = useState<string | null>(null);
  const [browserTpl, setBrowserTpl] = useState<string | null>(null);
  const [browserResult, setBrowserResult] = useState<Record<string, string>>({});
  const [browserUrls, setBrowserUrls] = useState<Record<string, string>>({});
  const [testResult, setTestResult] = useState<Record<string, string>>({});

  // System health state
  const [health, setHealth] = useState<{ relay: string; relayMs: number | null }>({ relay: "checking", relayMs: null });

  // Check auth on mount — MUST be before any conditional return
  useEffect(() => {
    try {
      if (sessionStorage.getItem(SESSION_KEY) === "1") setAuthed(true);
    } catch {}
  }, []);

  // Fetch jobs — MUST be before any conditional return
  const fetchJobs = useCallback(async () => {
    try {
      const resp = await fetch("/api/jobs");
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      const data = await resp.json();
      setJobs(data.jobs || []);
      setError(null);
      setLastUpdate(new Date().toLocaleTimeString());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll when authed — MUST be before any conditional return
  useEffect(() => {
    if (!authed) return;
    fetchJobs();
    const interval = setInterval(fetchJobs, 5000);
    return () => clearInterval(interval);
  }, [authed, fetchJobs]);

  // Relay health probe (runs while the health tab is open)
  useEffect(() => {
    if (!authed || activeTab !== "health") return;
    let cancelled = false;
    const probe = async () => {
      const t0 = Date.now();
      try {
        await fetch(RENDER_HEALTH_URL, { mode: "no-cors" });
        if (!cancelled) setHealth({ relay: "up", relayMs: Date.now() - t0 });
      } catch {
        if (!cancelled) setHealth({ relay: "down", relayMs: null });
      }
    };
    probe();
    const iv = setInterval(probe, 30000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [authed, activeTab]);

  // Auth handlers
  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (pwInput === ADMIN_PASSWORD) {
      try { sessionStorage.setItem(SESSION_KEY, "1"); } catch {}
      setAuthed(true);
      setPwError(false);
      setPwInput("");
    } else {
      setPwError(true);
    }
  }

  function handleLogout() {
    try { sessionStorage.removeItem(SESSION_KEY); } catch {}
    setAuthed(false);
    setPwInput("");
  }

  // Delete handler
  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const resp = await fetch("/api/jobs/delete?id=" + deleteTarget.id, { method: "DELETE" });
      if (!resp.ok) throw new Error("Delete failed");
      await fetchJobs();
      setDeleteTarget(null);
    } catch (err: any) {
      setError("Delete failed: " + err.message);
    } finally {
      setDeleting(false);
    }
  }

  // Test Render handler
  async function handleTestRender(tpl: Template) {
    setTestingTpl(tpl.id);
    setTestResult((p) => ({ ...p, [tpl.id]: "submitting" }));
    try {
      const resp = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief: Object.assign({ _template_id: tpl.id }, defaultVariablesFor(tpl)),
          inputValue: "Test: " + tpl.name,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || data.status === "error") {
        setTestResult((p) => ({ ...p, [tpl.id]: "error: " + (data.error || resp.status) }));
      } else {
        const jid = data.id ? String(data.id).substring(0, 10) : "ok";
        setTestResult((p) => ({ ...p, [tpl.id]: "queued: " + jid }));
        setTimeout(fetchJobs, 1500);
      }
    } catch (err: any) {
      setTestResult((p) => ({ ...p, [tpl.id]: "error: " + err.message }));
    } finally {
      setTestingTpl(null);
    }
  }

  // Browser render handler — renders entirely in the admin's browser
  async function handleTestRenderBrowser(tpl: Template) {
    const dur = Math.min(tpl.default_duration_sec, 15); // cap at 15s for admin test
    setBrowserTpl(tpl.id);
    setBrowserResult((p) => ({ ...p, [tpl.id]: "rendering" }));
    try {
      const result = await renderInBrowser({
        duration: dur,
        fps: 30,
        width: tpl.aspect_ratios.recommended[0] === "9:16" ? 1080 : 1920,
        height: tpl.aspect_ratios.recommended[0] === "9:16" ? 1920 : 1080,
        onProgress: (frame, total) => {
          const pct = Math.round((frame / total) * 100);
          setBrowserResult((p) => ({ ...p, [tpl.id]: pct + "%" }));
        },
      });
      const url = URL.createObjectURL(result.blob);
      setBrowserUrls((p) => ({ ...p, [tpl.id]: url }));
      setBrowserResult((p) => ({ ...p, [tpl.id]: "done · " + result.duration.toFixed(1) + "s · " + result.workerCount + " workers · " + result.codec }));
    } catch (err: any) {
      setBrowserResult((p) => ({ ...p, [tpl.id]: "error: " + err.message }));
    } finally {
      setBrowserTpl(null);
    }
  }

  // Derived data
  const stats = useMemo(() => {
    const completed = jobs.filter((j) => j.status === "completed");
    const failed = jobs.filter((j) => j.status === "failed" || j.status === "failed-rescued");
    const running = jobs.filter((j) => j.status === "running");
    const pending = jobs.filter((j) => j.status === "pending");
    const durations = completed.map(renderSeconds).filter((d): d is number => d != null);
    const avgRender = durations.length
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : null;
    const totalFrames = jobs.reduce((a, j) => a + (j.frames_total || 0), 0);
    const storageBytes = completed.reduce(
      (a, j) => a + Math.round((j.frames_total || 0) * 0.18 * 1024 * 1024),
      0
    );
    const denom = completed.length + failed.length;
    const successRate = denom > 0 ? Math.round((completed.length / denom) * 100) : null;
    return {
      total: jobs.length,
      completed: completed.length,
      failed: failed.length,
      running: running.length,
      pending: pending.length,
      avgRender,
      storageBytes,
      successRate,
      totalFrames,
    };
  }, [jobs]);

  const filteredJobs = useMemo(
    () => (queueFilter === "all" ? jobs : jobs.filter((j) => j.status === queueFilter)),
    [jobs, queueFilter]
  );

  const filteredTemplates = useMemo(() => {
    const q = tplSearch.trim().toLowerCase();
    return TEMPLATES.filter((t) => {
      if (tplCategory !== "all" && t.category !== tplCategory) return false;
      if (q) {
        const hay = (t.id + " " + t.name + " " + t.description + " " + t.tags.join(" ")).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [tplCategory, tplSearch]);

  // Login screen (after all hooks)
  if (!authed) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.cream, fontFamily: "Inter, system-ui, sans-serif", padding: "20px" }}>
        <form
          onSubmit={handleLogin}
          style={{ background: C.paper, border: BORDER, boxShadow: SHADOW, padding: "44px 36px", width: "100%", maxWidth: "420px" }}
        >
          <div style={{ fontSize: "40px", marginBottom: "8px" }}>⚡</div>
          <h1 style={{ fontSize: "30px", fontWeight: 900, margin: "0 0 6px", letterSpacing: "-0.5px", color: C.ink, textTransform: "uppercase" }}>
            Admin Access
          </h1>
          <p style={{ color: C.gray, margin: "0 0 28px", fontSize: "14px", fontWeight: 600 }}>
            HyperAspect Management Console
          </p>
          <input
            type="password"
            autoFocus
            value={pwInput}
            onChange={(e) => { setPwInput(e.target.value); setPwError(false); }}
            placeholder="Enter password"
            style={{
              width: "100%", boxSizing: "border-box", padding: "16px 18px",
              background: C.cream, border: BORDER_SM, color: C.ink, fontSize: "17px",
              fontWeight: 700, outline: "none", marginBottom: pwError ? "12px" : "22px",
            }}
          />
          {pwError && (
            <div style={{ background: C.red, color: C.paper, border: BORDER_SM, padding: "8px 12px", fontWeight: 800, fontSize: "13px", textTransform: "uppercase", marginBottom: "16px", boxShadow: SHADOW_SM }}>
              Incorrect password
            </div>
          )}
          <button
            type="submit"
            style={{
              width: "100%", padding: "16px", background: C.ink, color: C.cream,
              border: BORDER_SM, boxShadow: SHADOW_SM, fontWeight: 900, fontSize: "16px",
              cursor: "pointer", textTransform: "uppercase", letterSpacing: "1px",
            }}
          >
            Enter Console →
          </button>
          <a href="/" style={{ display: "inline-block", marginTop: "22px", color: C.gray, fontSize: "13px", textDecoration: "none", fontWeight: 700 }}>
            ← Back to app
          </a>
        </form>
      </div>
    );
  }

  // Dashboard
  return (
    <div style={{ minHeight: "100vh", background: C.cream, color: C.ink, fontFamily: "Inter, system-ui, sans-serif", padding: "24px 20px 60px" }}>
      <div style={{ maxWidth: "1500px", margin: "0 auto" }}>
        {/* Header */}
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <h1 style={{ fontSize: "34px", fontWeight: 900, margin: 0, letterSpacing: "-1px", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ background: C.sun, border: BORDER_SM, padding: "2px 12px", boxShadow: SHADOW_SM }}>⚡</span>
              HyperAspect Admin
            </h1>
            <p style={{ color: C.gray, marginTop: "8px", fontSize: "13px", fontWeight: 600 }}>
              Management Console {lastUpdate && ("· Updated " + lastUpdate)}
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            <button onClick={handleLogout} style={{ ...btnGhost, background: C.paper }}>Logout</button>
            <a href="/" style={{ ...btnSolid, background: C.ink, color: C.cream, textDecoration: "none" }}>Back to App →</a>
          </div>
        </header>

        {/* Stats Cards Row (always visible) */}
        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "14px", marginBottom: "24px" }}>
          <StatCard label="Total Renders" value={String(stats.total)} accent={C.ink} />
          <StatCard label="Done / Failed" value={stats.completed + " / " + stats.failed} accent={stats.failed > 0 ? C.red : C.green} sub={stats.successRate != null ? (stats.successRate + "% success") : "—"} />
          <StatCard label="Avg Render Time" value={stats.avgRender != null ? (stats.avgRender + "s") : "—"} accent={C.blue} />
          <StatCard label="Active Queue" value={String(stats.pending + stats.running)} accent={C.orange} sub={(stats.running + " running · " + stats.pending + " queued")} />
          <StatCard label="Storage Used" value={humanBytes(stats.storageBytes)} accent={C.violet} sub={stats.totalFrames.toLocaleString() + " frames"} />
        </section>

        {/* Tab Nav */}
        <nav style={{ display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap" }}>
          {TABS.map((t) => {
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                style={{
                  padding: "12px 20px", border: BORDER_SM, fontWeight: 900, cursor: "pointer",
                  textTransform: "uppercase", fontSize: "13px", letterSpacing: "0.5px",
                  background: active ? C.sun : C.paper, color: C.ink,
                  boxShadow: active ? SHADOW_SM : "2px 2px 0 #0a0a0a",
                  transform: active ? "translate(-2px,-2px)" : "none",
                  transition: "transform .08s",
                }}
              >
                {t.emoji} {t.label}
              </button>
            );
          })}
        </nav>

        {/* Error banner */}
        {error && (
          <div style={{ background: C.red, color: C.paper, border: BORDER_SM, padding: "12px 16px", marginBottom: "16px", fontSize: "14px", fontWeight: 800, boxShadow: SHADOW_SM, textTransform: "uppercase" }}>
            ⚠ {error}
          </div>
        )}

        {/* Tab Content */}
        {activeTab === "stats" && <StatsTab jobs={jobs} stats={stats} />}
        {activeTab === "templates" && (
          <TemplatesTab
            templates={filteredTemplates}
            category={tplCategory}
            setCategory={setTplCategory}
            search={tplSearch}
            setSearch={setTplSearch}
            onTest={handleTestRender}
            testingTpl={testingTpl}
            testResult={testResult}
            onTestBrowser={handleTestRenderBrowser}
            testingBrowser={browserTpl}
            browserResult={browserResult}
            browserUrls={browserUrls}
            browserSupported={isClientRenderSupported()}
          />
        )}
        {activeTab === "queue" && (
          <QueueTab
            jobs={filteredJobs}
            allJobs={jobs}
            loading={loading}
            filter={queueFilter}
            setFilter={setQueueFilter}
            onDelete={setDeleteTarget}
          />
        )}
        {activeTab === "metrics" && <MetricsTab jobs={jobs} />}
        {activeTab === "health" && <HealthTab jobs={jobs} stats={stats} health={health} />}
      </div>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div
          onClick={() => !deleting && setDeleteTarget(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(10,10,10,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "20px" }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: C.paper, border: BORDER, boxShadow: SHADOW, padding: "32px", maxWidth: "440px", width: "100%" }}>
            <div style={{ fontSize: "32px", marginBottom: "8px" }}>🗑️</div>
            <h2 style={{ fontSize: "24px", fontWeight: 900, margin: "0 0 12px", textTransform: "uppercase", color: C.ink }}>
              Delete this render?
            </h2>
            <p style={{ color: "#444", fontSize: "15px", marginBottom: "24px", fontWeight: 500, lineHeight: 1.5 }}>
              Permanently delete job <code style={{ background: C.cream, border: "2px solid #0a0a0a", padding: "1px 6px", fontWeight: 800 }}>{deleteTarget.id.substring(0, 10)}</code>
              {" "}<strong>{deleteTarget.video_name}</strong> and all rendered files. This cannot be undone.
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button onClick={() => setDeleteTarget(null)} disabled={deleting} style={{ ...btnGhost }}>Cancel</button>
              <button onClick={handleDeleteConfirm} disabled={deleting} style={{ ...btnSolid, background: deleting ? "#c9b9bd" : C.red, cursor: deleting ? "wait" : "pointer" }}>
                {deleting ? "Deleting..." : "Delete Permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// SHARED STYLE HELPERS
const btnSolid: React.CSSProperties = {
  padding: "10px 18px", border: BORDER_SM, boxShadow: SHADOW_SM,
  color: C.cream, fontWeight: 800, fontSize: "14px", cursor: "pointer",
  textTransform: "uppercase", letterSpacing: "0.5px",
};
const btnGhost: React.CSSProperties = {
  padding: "10px 18px", border: BORDER_SM, boxShadow: SHADOW_SM,
  background: C.cream, color: C.ink, fontWeight: 800, fontSize: "14px",
  cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.5px",
};

function StatCard({ label, value, accent, sub }: { label: string; value: string; accent: string; sub?: string }) {
  return (
    <div style={{ background: C.paper, border: BORDER, boxShadow: SHADOW, padding: "16px 18px" }}>
      <div style={{ fontSize: "11px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "1px", color: C.gray, marginBottom: "6px" }}>
        {label}
      </div>
      <div style={{ fontSize: "30px", fontWeight: 900, color: accent, lineHeight: 1, marginBottom: sub ? "6px" : 0 }}>{value}</div>
      {sub && <div style={{ fontSize: "12px", fontWeight: 700, color: C.gray }}>{sub}</div>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] || { bg: C.gray, label: status };
  const pulse = status === "running";
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: "6px",
        background: s.bg, color: C.ink, border: "2px solid #0a0a0a",
        padding: "3px 10px", fontSize: "11px", fontWeight: 900,
        textTransform: "uppercase", letterSpacing: "0.5px",
      }}
    >
      <span
        style={{
          width: "8px", height: "8px", borderRadius: "50%", background: C.ink,
          animation: pulse ? "brPulse 1s infinite" : "none",
        }}
      />
      {s.label}
      {pulse && <style>{"@keyframes brPulse{0%,100%{opacity:1}50%{opacity:0.25}}"}</style>}
    </span>
  );
}

// TAB 1 — STATS
function StatsTab({ jobs, stats }: { jobs: Job[]; stats: any }) {
  const byStatus = ["pending", "running", "completed", "failed", "failed-rescued"].map((st) => ({
    st, count: jobs.filter((j) => j.status === st).length,
  }));
  const maxCount = Math.max(1, ...byStatus.map((b) => b.count));

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
      <Panel title="Render Outcomes" emoji="🏁">
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "8px" }}>
          {byStatus.map((b) => (
            <div key={b.st}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", fontWeight: 800, marginBottom: "4px", textTransform: "uppercase" }}>
                <span>{(STATUS_STYLE[b.st] || { label: b.st }).label}</span>
                <span>{b.count}</span>
              </div>
              <div style={{ height: "18px", background: C.cream, border: "2px solid #0a0a0a" }}>
                <div style={{ height: "100%", width: ((b.count / maxCount) * 100) + "%", background: (STATUS_STYLE[b.st] || { bg: C.gray }).bg }} />
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Performance" emoji="⏱️">
        <Row label="Average render time" value={stats.avgRender != null ? (stats.avgRender + "s") : "—"} />
        <Row label="Success rate" value={stats.successRate != null ? (stats.successRate + "%") : "—"} />
        <Row label="Total frames captured" value={stats.totalFrames.toLocaleString()} />
        <Row label="Completed renders" value={String(stats.completed)} />
        <Row label="Storage (est.)" value={humanBytes(stats.storageBytes)} />
      </Panel>

      <Panel title="Queue Depth" emoji="📬">
        <Row label="Pending" value={String(stats.pending)} />
        <Row label="Running" value={String(stats.running)} />
        <Row label="Concurrent slots free" value={(Math.max(0, MAX_CONCURRENT - stats.running) + " / " + MAX_CONCURRENT)} />
        <Row label="Backlog (pending + failed)" value={String(stats.pending + stats.failed)} />
      </Panel>
    </div>
  );
}

// TAB 2 — TEMPLATE BROWSER
function TemplatesTab({
  templates, category, setCategory, search, setSearch, onTest, testingTpl, testResult,
  onTestBrowser, testingBrowser, browserResult, browserUrls, browserSupported,
}: {
  templates: Template[];
  category: string; setCategory: (s: string) => void;
  search: string; setSearch: (s: string) => void;
  onTest: (t: Template) => void;
  testingTpl: string | null;
  testResult: Record<string, string>;
  onTestBrowser: (t: Template) => void;
  testingBrowser: string | null;
  browserResult: Record<string, string>;
  browserUrls: Record<string, string>;
  browserSupported: boolean;
}) {
  return (
    <div>
      <div style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap", alignItems: "center" }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Search templates..."
          style={{ flex: "1 1 240px", minWidth: "220px", padding: "12px 14px", background: C.paper, border: BORDER_SM, fontWeight: 700, fontSize: "14px", outline: "none", boxShadow: SHADOW_SM }}
        />
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          <FilterChip active={category === "all"} onClick={() => setCategory("all")} label={"All (" + TEMPLATES.length + ")"} />
          {CATEGORIES.map((c) => {
            const n = TEMPLATES.filter((t) => t.category === c.name).length;
            return (
              <FilterChip key={c.name} active={category === c.name} onClick={() => setCategory(c.name)} label={(c.emoji + " " + c.name + " (" + n + ")")} color={c.color} />
            );
          })}
        </div>
      </div>

      <div style={{ fontSize: "12px", fontWeight: 700, color: C.gray, marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
        Showing {templates.length} template{templates.length !== 1 ? "s" : ""}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "16px" }}>
        {templates.map((t) => {
          const catMeta = CATEGORIES.find((c) => c.name === t.category);
          const accent = catMeta ? catMeta.color : C.ink;
          const result = testResult[t.id];
          const busy = testingTpl === t.id;
          return (
            <div key={t.id} style={{ background: C.paper, border: BORDER, boxShadow: SHADOW, padding: "16px", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px", paddingBottom: "10px", borderBottom: "3px solid #0a0a0a" }}>
                <div style={{ fontSize: "26px", lineHeight: 1 }}>{t.emoji}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 900, fontSize: "15px", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</div>
                  <div style={{ fontSize: "11px", fontWeight: 800, color: accent, textTransform: "uppercase", letterSpacing: "0.5px" }}>{t.category}</div>
                </div>
              </div>

              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "10px" }}>
                <MetaChip label={"🎚️ " + t.difficulty} />
                <MetaChip label={"🎬 " + t.scenes.length + " beats"} />
                <MetaChip label={"⏱️ " + t.default_duration_sec + "s"} />
                <MetaChip label={"🖼️ " + (t.aspect_ratios.recommended[0] || "16:9")} />
              </div>

              <p style={{ fontSize: "12px", color: "#555", fontWeight: 500, lineHeight: 1.4, margin: "0 0 12px", flex: 1 }}>
                {t.description}
              </p>

              <code style={{ display: "block", fontSize: "10px", background: C.cream, border: "2px solid #0a0a0a", padding: "4px 8px", fontWeight: 800, color: C.gray, marginBottom: "10px", wordBreak: "break-all" }}>
                {t.id}
              </code>

              {result && (
                <div style={{
                  fontSize: "11px", fontWeight: 800, padding: "6px 8px", marginBottom: "10px",
                  border: "2px solid #0a0a0a", background: result.indexOf("error") === 0 ? C.red : C.green,
                  color: C.ink, textTransform: "uppercase",
                }}>
                  {(result.indexOf("error") === 0 ? "✖ " : "✓ ") + result}
                </div>
              )}

              <button
                onClick={() => onTest(t)}
                disabled={busy}
                style={{
                  width: "100%", padding: "11px", background: busy ? C.cream : C.sun,
                  border: BORDER_SM, boxShadow: SHADOW_SM, fontWeight: 900, cursor: busy ? "wait" : "pointer",
                  fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.5px", color: C.ink,
                }}
              >
                {busy ? "Submitting..." : "🎬 Test Render"}
              </button>

              {browserSupported && (
                <>
                  <button
                    onClick={() => onTestBrowser(t)}
                    disabled={testingBrowser === t.id}
                    style={{
                      width: "100%", padding: "11px", marginTop: "8px",
                      background: testingBrowser === t.id ? C.cream : C.green,
                      border: BORDER_SM, boxShadow: SHADOW_SM, fontWeight: 900,
                      cursor: testingBrowser === t.id ? "wait" : "pointer",
                      fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.5px", color: C.ink,
                    }}
                  >
                    {testingBrowser === t.id ? "Rendering..." : "🖥️ Browser Render"}
                  </button>

                  {browserResult[t.id] && (
                    <div style={{
                      fontSize: "10px", fontWeight: 800, padding: "5px 7px", marginTop: "8px",
                      border: "2px solid #0a0a0a",
                      background: browserResult[t.id].indexOf("error") === 0 ? C.red :
                                  browserResult[t.id].indexOf("done") === 0 ? C.green : C.blue,
                      color: C.ink, textTransform: "uppercase",
                    }}>
                      {browserResult[t.id]}
                    </div>
                  )}

                  {browserUrls[t.id] && (
                    <a
                      href={browserUrls[t.id]}
                      download={"browser-" + t.id + ".mp4"}
                      style={{
                        display: "block", textAlign: "center", marginTop: "6px",
                        padding: "8px", background: C.violet,
                        border: BORDER_SM, boxShadow: SHADOW_SM, fontWeight: 900,
                        fontSize: "12px", textTransform: "uppercase", color: C.ink,
                        textDecoration: "none",
                      }}
                    >
                      ⬇ Download MP4
                    </a>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {templates.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px", background: C.paper, border: BORDER, boxShadow: SHADOW, fontWeight: 800, color: C.gray }}>
          No templates match your filters.
        </div>
      )}
    </div>
  );
}

// TAB 3 — RENDER QUEUE MONITOR
function QueueTab({
  jobs, allJobs, loading, filter, setFilter, onDelete,
}: {
  jobs: Job[]; allJobs: Job[]; loading: boolean;
  filter: string; setFilter: (s: string) => void;
  onDelete: (j: Job) => void;
}) {
  return (
    <div>
      <div style={{ display: "flex", gap: "6px", marginBottom: "16px", flexWrap: "wrap" }}>
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label={"All (" + allJobs.length + ")"} />
        {["pending", "running", "completed", "failed"].map((f) => {
          const n = allJobs.filter((j) => j.status === f || (f === "failed" && j.status === "failed-rescued")).length;
          return (
            <FilterChip key={f} active={filter === f} onClick={() => setFilter(f)} label={((STATUS_STYLE[f] || { label: f }).label + " (" + n + ")")} />
          );
        })}
      </div>

      {loading ? (
        <Panel emoji="⏳" title="Loading">
          <div style={{ padding: "20px", fontWeight: 800, color: C.gray }}>Fetching render jobs...</div>
        </Panel>
      ) : jobs.length === 0 ? (
        <Panel emoji="📭" title="Empty Queue">
          <div style={{ padding: "20px", fontWeight: 800, color: C.gray }}>No jobs match this filter.</div>
        </Panel>
      ) : (
        <div style={{ background: C.paper, border: BORDER, boxShadow: SHADOW, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "820px" }}>
            <thead>
              <tr style={{ background: C.ink, color: C.cream }}>
                {["Job", "Template", "Status", "Created", "Duration", "Frames", "Actions"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "12px 12px", fontSize: "11px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "1px" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {jobs.map((job, i) => {
                const dur = renderSeconds(job);
                const frameInfo = job.frames_total > 0 ? (job.frames_captured + "/" + job.frames_total) : "—";
                return (
                  <tr key={job.id} style={{ borderBottom: i === jobs.length - 1 ? "none" : "3px solid #0a0a0a" }}>
                    <td style={{ padding: "12px", verticalAlign: "middle" }}>
                      <code style={{ fontSize: "11px", fontWeight: 800, background: C.cream, border: "2px solid #0a0a0a", padding: "2px 6px" }}>{job.id.substring(0, 10)}</code>
                    </td>
                    <td style={{ padding: "12px", fontSize: "13px", fontWeight: 700, verticalAlign: "middle" }}>{job.video_name}</td>
                    <td style={{ padding: "12px", verticalAlign: "middle" }}><StatusBadge status={job.status} /></td>
                    <td style={{ padding: "12px", fontSize: "12px", fontWeight: 600, color: "#666", verticalAlign: "middle" }}>
                      {job.created_at ? new Date(job.created_at).toLocaleString() : "—"}
                    </td>
                    <td style={{ padding: "12px", fontSize: "13px", fontWeight: 800, verticalAlign: "middle" }}>{dur != null ? (dur + "s") : "—"}</td>
                    <td style={{ padding: "12px", fontSize: "12px", fontWeight: 700, color: "#666", verticalAlign: "middle", fontFamily: "monospace" }}>{frameInfo}</td>
                    <td style={{ padding: "12px", verticalAlign: "middle" }}>
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                        {job.output_path && (
                          <>
                            <a href={("/api/video?id=" + job.id)} target="_blank" style={linkBtn(C.blue)}>▶ View</a>
                            <a href={("/api/video?id=" + job.id)} download style={linkBtn(C.green)}>⬇</a>
                          </>
                        )}
                        <button onClick={() => onDelete(job)} style={{ ...miniBtn, background: C.red, color: C.paper }}>✖</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p style={{ textAlign: "center", color: C.gray, fontSize: "11px", marginTop: "14px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
        ⟳ Auto-refreshing every 5s · {jobs.length} jobs shown
      </p>
    </div>
  );
}

// TAB 4 — METRICS CHARTS
function MetricsTab({ jobs }: { jobs: Job[] }) {
  const days = useMemo(() => {
    const out: { key: string; label: string; total: number; completed: number; failed: number; durations: number[] }[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      d.setHours(0, 0, 0, 0);
      out.push({
        key: d.toISOString().slice(0, 10),
        label: d.toLocaleDateString("en-US", { weekday: "short" }),
        total: 0, completed: 0, failed: 0, durations: [],
      });
    }
    const map = new Map(out.map((d) => [d.key, d]));
    for (const j of jobs) {
      if (!j.created_at) continue;
      const k = new Date(j.created_at).toISOString().slice(0, 10);
      const bucket = map.get(k);
      if (!bucket) continue;
      bucket.total++;
      if (j.status === "completed") bucket.completed++;
      if (j.status === "failed" || j.status === "failed-rescued") bucket.failed++;
      const d = renderSeconds(j);
      if (d != null && j.status === "completed") bucket.durations.push(d);
    }
    return out;
  }, [jobs]);

  const maxTotal = Math.max(1, ...days.map((d) => d.total));
  const maxDur = Math.max(1, ...days.map((d) => (d.durations.length ? Math.max(...d.durations) : 0)));

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "16px" }}>
      <Panel title="Renders Per Day (7d)" emoji="📊">
        <BarChart
          data={days.map((d) => ({ label: d.label, value: d.total, max: maxTotal, color: C.sun, sub: String(d.total) }))}
          unit="renders"
        />
      </Panel>

      <Panel title="Success Rate Per Day" emoji="✅">
        <BarChart
          data={days.map((d) => {
            const denom = d.completed + d.failed;
            const pct = denom > 0 ? Math.round((d.completed / denom) * 100) : 0;
            return { label: d.label, value: pct, max: 100, color: (d.failed > 0 && d.completed === 0) ? C.red : C.green, sub: (pct + "%") };
          })}
          unit="% success"
        />
      </Panel>

      <Panel title="Avg Render Time Trend" emoji="⏱️">
        <BarChart
          data={days.map((d) => {
            const avg = d.durations.length ? Math.round(d.durations.reduce((a, b) => a + b, 0) / d.durations.length) : 0;
            return { label: d.label, value: avg, max: maxDur, color: C.blue, sub: avg ? (avg + "s") : "—" };
          })}
          unit="seconds"
        />
      </Panel>

      <Panel title="Completed vs Failed (7d)" emoji="🏁">
        <div style={{ marginTop: "8px" }}>
          {days.map((d) => {
            const denom = d.completed + d.failed;
            const cpct = denom > 0 ? (d.completed / denom) * 100 : 0;
            return (
              <div key={d.key} style={{ marginBottom: "10px" }}>
                <div style={{ fontSize: "12px", fontWeight: 800, marginBottom: "4px", display: "flex", justifyContent: "space-between" }}>
                  <span>{d.label}</span>
                  <span style={{ color: C.gray }}>{d.completed}✓ {d.failed}✖</span>
                </div>
                <div style={{ height: "16px", background: C.cream, border: "2px solid #0a0a0a", display: "flex" }}>
                  <div style={{ width: cpct + "%", background: C.green }} />
                  <div style={{ flex: 1, background: denom > 0 ? C.red : "transparent" }} />
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

function BarChart({ data, unit }: { data: { label: string; value: number; max: number; color: string; sub: string }[]; unit: string }) {
  return (
    <div style={{ marginTop: "12px" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: "10px", height: "180px", padding: "8px 0", borderBottom: "3px solid #0a0a0a" }}>
        {data.map((d, i) => {
          const h = d.max > 0 ? Math.max(2, (d.value / d.max) * 100) : 2;
          return (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end", gap: "4px" }}>
              <div style={{ fontSize: "10px", fontWeight: 900, color: C.ink }}>{d.sub}</div>
              <div style={{ width: "100%", maxWidth: "42px", height: h + "%", background: d.color, border: "2px solid #0a0a0a", minHeight: "4px" }} />
              <div style={{ fontSize: "11px", fontWeight: 800, color: C.gray }}>{d.label}</div>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: "10px", fontWeight: 700, color: C.gray, marginTop: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{unit}</div>
    </div>
  );
}

// TAB 5 — SYSTEM HEALTH
function HealthTab({ jobs, stats, health }: { jobs: Job[]; stats: any; health: { relay: string; relayMs: number | null } }) {
  const running = stats.running;
  const slotsFree = Math.max(0, MAX_CONCURRENT - running);
  const slotStatus = slotsFree > 0 ? "ok" : "full" as "ok" | "full";
  const relayState: "ok" | "down" | "checking" =
    health.relay === "up" ? "ok" :
    health.relay === "down" ? "down" : "checking";

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px" }}>
      <HealthCard
        title="Relay Server"
        subtitle="render.coreaspectai.com/health"
        status={relayState}
        detail={health.relay === "up" ? ("Reachable" + (health.relayMs != null ? (" · " + health.relayMs + "ms") : "")) : health.relay === "down" ? "Unreachable" : "Probing..."}
      />

      <HealthCard
        title="Concurrent Render Slots"
        subtitle={"Max " + MAX_CONCURRENT + " parallel renders"}
        status={slotStatus === "ok" ? "ok" : "warn"}
        detail={(running + " in use · " + slotsFree + " free")}
      >
        <div style={{ display: "flex", gap: "6px", marginTop: "10px" }}>
          {Array.from({ length: MAX_CONCURRENT }).map((_, i) => (
            <div key={i} style={{
              flex: 1, height: "24px", border: "2px solid #0a0a0a",
              background: i < running ? C.blue : C.cream, fontWeight: 900,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px",
            }}>
              {i < running ? "●" : "○"}
            </div>
          ))}
        </div>
      </HealthCard>

      <HealthCard
        title="Active Queue Depth"
        subtitle="Pending + running jobs"
        status={stats.pending > 20 ? "warn" : "ok"}
        detail={(stats.pending + " pending · " + stats.running + " running")}
      />

      <HealthCard
        title="Worker Timer"
        subtitle="hf-worker.timer (cloudflare)"
        status="checking"
        detail="Runs every 60s — verify server-side"
      >
        <p style={{ fontSize: "11px", fontWeight: 700, color: C.gray, margin: "8px 0 0", lineHeight: 1.4 }}>
          The render worker fires via a Cloudflare Cron Trigger. This is a server-side resource — confirm in <code style={{ background: C.cream, border: "1px solid #0a0a0a", padding: "0 3px" }}>wrangler.jsonc</code> triggers config.
        </p>
      </HealthCard>

      <HealthCard
        title="Disk Space (Render Volume)"
        subtitle="Backend render output storage"
        status="checking"
        detail={("Est. " + humanBytes(stats.storageBytes) + " used locally")}
      >
        <p style={{ fontSize: "11px", fontWeight: 700, color: C.gray, margin: "8px 0 0", lineHeight: 1.4 }}>
          Precise disk usage lives on the render backend. Shown value is a client-side estimate from completed frame counts.
        </p>
      </HealthCard>

      <HealthCard
        title="Queue Database Size"
        subtitle="Render job records"
        status={stats.total > 5000 ? "warn" : "ok"}
        detail={(stats.total.toLocaleString() + " job records")}
      >
        <p style={{ fontSize: "11px", fontWeight: 700, color: C.gray, margin: "8px 0 0", lineHeight: 1.4 }}>
          Backed by the render service job store. Consider archiving old completed jobs past a few thousand.
        </p>
      </HealthCard>
    </div>
  );
}

// SMALL UI PRIMITIVES
function Panel({ title, emoji, children }: { title?: string; emoji?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: C.paper, border: BORDER, boxShadow: SHADOW, padding: "18px" }}>
      {title && (
        <div style={{ fontSize: "13px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
          {emoji && <span>{emoji}</span>} {title}
        </div>
      )}
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "2px dashed #0a0a0a", fontSize: "13px" }}>
      <span style={{ fontWeight: 600, color: "#555", textTransform: "uppercase", fontSize: "11px", letterSpacing: "0.5px" }}>{label}</span>
      <span style={{ fontWeight: 900 }}>{value}</span>
    </div>
  );
}

function MetaChip({ label }: { label: string }) {
  return (
    <span style={{ background: C.cream, border: "2px solid #0a0a0a", padding: "2px 7px", fontSize: "10px", fontWeight: 800 }}>
      {label}
    </span>
  );
}

function FilterChip({ active, onClick, label, color }: { active: boolean; onClick: () => void; label: string; color?: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "8px 14px", border: BORDER_SM, cursor: "pointer", fontWeight: 800, fontSize: "12px",
        textTransform: "uppercase", letterSpacing: "0.5px", boxShadow: SHADOW_SM,
        background: active ? (color || C.ink) : C.paper,
        color: active ? C.paper : C.ink,
        transform: active ? "translate(-2px,-2px)" : "none",
      }}
    >
      {label}
    </button>
  );
}

function HealthCard({ title, subtitle, status, detail, children }: { title: string; subtitle: string; status: "ok" | "warn" | "down" | "checking"; detail: string; children?: React.ReactNode }) {
  const meta = {
    ok: { bg: C.green, label: "Operational", dot: C.ink },
    warn: { bg: C.sun, label: "Warning", dot: C.ink },
    down: { bg: C.red, label: "Down", dot: C.paper },
    checking: { bg: C.gray, label: "Server-Side Check", dot: C.paper },
  }[status];
  return (
    <div style={{ background: C.paper, border: BORDER, boxShadow: SHADOW, padding: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
        <span style={{ width: "14px", height: "14px", background: meta.bg, border: "2px solid #0a0a0a", flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "15px", fontWeight: 900 }}>{title}</div>
          <div style={{ fontSize: "11px", fontWeight: 700, color: C.gray }}>{subtitle}</div>
        </div>
      </div>
      <div style={{ display: "inline-block", background: meta.bg, color: meta.dot, border: "2px solid #0a0a0a", padding: "3px 10px", fontSize: "11px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>
        {meta.label}
      </div>
      <div style={{ fontSize: "13px", fontWeight: 700 }}>{detail}</div>
      {children}
    </div>
  );
}

const miniBtn: React.CSSProperties = {
  padding: "4px 8px", border: "2px solid #0a0a0a", fontWeight: 900, fontSize: "12px", cursor: "pointer",
};

function linkBtn(color: string): React.CSSProperties {
  return {
    display: "inline-block", padding: "4px 9px", border: "2px solid #0a0a0a", background: color,
    color: C.ink, fontWeight: 900, fontSize: "11px", textDecoration: "none", textTransform: "uppercase",
  };
}
