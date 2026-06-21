"use client";
import { useState, useEffect } from "react";
import { Settings2, X, Zap, Server, Monitor, Cpu, Gauge, Film } from "lucide-react";

export type RenderEngine = "auto" | "server" | "client";
export type FrameRate = 30 | 15 | 10;
export type DurationCap = 5 | 10 | 15 | 30;
export type WorkerCount = 1 | 3 | 6 | 12;
export type Quality = "high" | "medium" | "low";

export interface AdminRenderConfig {
  engine: RenderEngine;
  framerate: FrameRate;
  durationCap: DurationCap;
  workers: WorkerCount;
  quality: Quality;
}

export const DEFAULT_ADMIN_CONFIG: AdminRenderConfig = {
  engine: "auto",
  framerate: 30,
  durationCap: 15,
  workers: 6,
  quality: "high",
};

const STORAGE_KEY = "ha-admin-config";

export function loadAdminConfig(): AdminRenderConfig {
  if (typeof window === "undefined") return DEFAULT_ADMIN_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_ADMIN_CONFIG, ...parsed };
    }
  } catch {}
  return DEFAULT_ADMIN_CONFIG;
}

export function saveAdminConfig(config: AdminRenderConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {}
}

/** Check if admin panel should be visible (?admin=1 in URL or localStorage flag */
export function isAdminMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search);
    return params.has("admin") || localStorage.getItem("ha-admin") === "1";
  } catch {
    return false;
  }
}

interface OptionButton {
  label: string;
  value: string | number;
  icon?: typeof Zap;
  desc?: string;
}

function OptionRow({
  label,
  icon: Icon,
  options,
  current,
  onSelect,
}: {
  label: string;
  icon: typeof Zap;
  options: OptionButton[];
  current: string | number;
  onSelect: (v: string | number) => void;
}) {
  return (
    <div className="mb-5">
      <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-2.5">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </label>
      <div className="grid grid-cols-4 gap-2">
        {options.map((opt) => {
          const selected = opt.value === current;
          const OptIcon = opt.icon;
          return (
            <button
              key={String(opt.value)}
              onClick={() => onSelect(opt.value)}
              className="relative flex flex-col items-center justify-center gap-1 py-2.5 px-1 transition-all"
              style={{
                border: "3px solid #0a0a0a",
                background: selected ? "var(--accent)" : "#fff",
                color: selected ? "#fff" : "#0a0a0a",
                boxShadow: selected ? "3px 3px 0 #0a0a0a" : "2px 2px 0 #0a0a0a",
                transform: selected ? "translate(-1px, -1px)" : "none",
                fontWeight: 800,
                fontSize: "0.75rem",
                cursor: "pointer",
              }}
            >
              {OptIcon && <OptIcon className="w-4 h-4" />}
              <span>{opt.label}</span>
              {opt.desc && (
                <span style={{ fontSize: "0.6rem", fontWeight: 500, opacity: 0.8 }}>
                  {opt.desc}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function AdminPanel({
  config,
  onChange,
}: {
  config: AdminRenderConfig;
  onChange: (c: AdminRenderConfig) => void;
}) {
  const engines: OptionButton[] = [
    { label: "Auto", value: "auto", icon: Cpu, desc: "Best pick" },
    { label: "Server", value: "server", icon: Server, desc: "Slower" },
    { label: "Client", value: "client", icon: Monitor, desc: "Browser" },
  ];

  const framerates: OptionButton[] = [
    { label: "10fps", value: 10, desc: "Fastest" },
    { label: "15fps", value: 15, desc: "Balanced" },
    { label: "30fps", value: 30, desc: "Smooth" },
  ];

  const durations: OptionButton[] = [
    { label: "5s", value: 5 },
    { label: "10s", value: 10 },
    { label: "15s", value: 15 },
    { label: "30s", value: 30 },
  ];

  const workers: OptionButton[] = [
    { label: "1×", value: 1, desc: "Low CPU" },
    { label: "3×", value: 3 },
    { label: "6×", value: 6, desc: "Default" },
    { label: "12×", value: 12, desc: "Max" },
  ];

  const qualities: OptionButton[] = [
    { label: "High", value: "high", desc: "PNG" },
    { label: "Med", value: "medium", desc: "JPG 90" },
    { label: "Low", value: "low", desc: "JPG 70" },
  ];

  return (
    <div
      className="p-5"
      style={{
        background: "var(--bg-surface)",
        border: "3px solid #0a0a0a",
        boxShadow: "4px 4px 0 #0a0a0a",
      }}
    >
      <h4 className="font-black mb-1 text-sm tracking-tight uppercase flex items-center gap-2">
        <Settings2 className="w-4 h-4" />
        Render Engine Settings
      </h4>
      <p className="text-xs text-[var(--text-muted)] mb-4 font-medium">
        Override default render behavior for testing
      </p>

      <OptionRow
        label="Engine"
        icon={Cpu}
        options={engines}
        current={config.engine}
        onSelect={(v) => onChange({ ...config, engine: v as RenderEngine })}
      />

      <OptionRow
        label="Frame Rate"
        icon={Gauge}
        options={framerates}
        current={config.framerate}
        onSelect={(v) => onChange({ ...config, framerate: v as FrameRate })}
      />

      <OptionRow
        label="Duration Cap"
        icon={Film}
        options={durations}
        current={config.durationCap}
        onSelect={(v) => onChange({ ...config, durationCap: v as DurationCap })}
      />

      <OptionRow
        label="Server Workers"
        icon={Server}
        options={workers}
        current={config.workers}
        onSelect={(v) => onChange({ ...config, workers: v as WorkerCount })}
      />

      <OptionRow
        label="Quality"
        icon={Zap}
        options={qualities}
        current={config.quality}
        onSelect={(v) => onChange({ ...config, quality: v as Quality })}
      />

      <div
        className="mt-4 p-3 text-xs font-medium"
        style={{
          background:
            config.engine === "client"
              ? "rgba(0, 229, 255, 0.1)"
              : config.engine === "auto"
                ? "rgba(0, 200, 0, 0.1)"
                : "rgba(255, 149, 0, 0.1)",
          border: "2px solid #0a0a0a",
        }}
      >
        {config.engine === "client" && "⚡ Browser render: POC demo only — renders hardcoded animation, not real content"}
        {config.engine === "auto" && "🖥️ Server render: ~2-4min per video, full AI pipeline (recommended)"}
        {config.engine === "server" && "🖥️ Server render: ~2-4min per video, full pipeline"}
      </div>
    </div>
  );
}

/** Floating gear button + modal drawer for the admin panel */
export function AdminGearButton({
  config,
  onChange,
}: {
  config: AdminRenderConfig;
  onChange: (c: AdminRenderConfig) => void;
}) {
  const [open, setOpen] = useState(false);

  // Keyboard shortcut: Ctrl+Shift+A toggles admin panel
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "A") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      {/* Floating gear icon */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Admin settings"
        className="fixed bottom-4 right-4 z-40 flex items-center justify-center w-11 h-11 transition-all hover:scale-110"
        style={{
          background: "var(--accent)",
          border: "3px solid #0a0a0a",
          boxShadow: "4px 4px 0 #0a0a0a",
          color: "#fff",
        }}
      >
        <Settings2 className="w-5 h-5" />
      </button>

      {/* Modal overlay */}
      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.5)" }}
            onClick={() => setOpen(false)}
          >
            <div
              className="relative max-w-md w-full max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
              style={{ background: "var(--bg-surface)", border: "4px solid #0a0a0a", boxShadow: "8px 8px 0 #0a0a0a" }}
            >
              {/* Close button */}
              <button
                onClick={() => setOpen(false)}
                className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center"
                style={{ border: "2px solid #0a0a0a", background: "#fff", cursor: "pointer" }}
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="p-6">
                <AdminPanel config={config} onChange={onChange} />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

import { createPortal } from "react-dom";
