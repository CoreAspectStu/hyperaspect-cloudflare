"use client";

/**
 * Client host for the dev template-editor entry. <TimelineEditor> portals a
 * full-screen overlay into document.body (and guards on `document`), so it is
 * not SSR-safe as a top-level page. We gate its render on a mount flag so the
 * server and first client paint agree (both render nothing), then mount the
 * editor after hydration — no hydration mismatch.
 */
import { useEffect, useState } from "react";
import TimelineEditor from "@/components/TimelineEditor";

export default function TemplateEditorClient({
  templateId,
}: {
  templateId: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  if (closed) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          fontFamily: "system-ui, sans-serif",
          background: "#fef6e4",
          color: "#0a0a0a",
        }}
      >
        <h1 style={{ fontSize: "1.25rem", fontWeight: 800, textTransform: "uppercase" }}>
          Template editor closed
        </h1>
        <button
          type="button"
          onClick={() => setClosed(false)}
          style={{
            padding: "10px 20px",
            border: "3px solid #0a0a0a",
            boxShadow: "3px 3px 0 #0a0a0a",
            background: "#fff",
            cursor: "pointer",
            fontWeight: 800,
          }}
        >
          Reopen &ldquo;{templateId}&rdquo;
        </button>
        <p style={{ color: "#6b6b6b", fontSize: "0.85rem" }}>
          Dev entry &mdash; template:{" "}
          <a href="?template=deal-01" style={{ fontWeight: 700 }}>
            deal-01
          </a>
        </p>
      </main>
    );
  }

  return <TimelineEditor templateId={templateId} onClose={() => setClosed(true)} />;
}
