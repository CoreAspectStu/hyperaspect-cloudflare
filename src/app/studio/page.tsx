import Link from "next/link";
import { getStore } from "@/lib/template-store/store";

/**
 * /studio — the video gallery. Lists every template in the store (hand-built
 * like deal-01 + generated ha-* videos registered after creation) so you can
 * pick one to edit by clicking, instead of typing a /studio/editor?template= URL.
 */
export default async function StudioGalleryPage() {
  let templates: { id: string; family: string; name: string }[] = [];
  let loadError: string | null = null;
  try {
    templates = await getStore().list();
  } catch (e) {
    loadError = e instanceof Error ? e.message : String(e);
  }

  return (
    <main style={{ minHeight: "100vh", background: "#f7f8fa", color: "#1a1d23", fontFamily: "'Inter', system-ui, sans-serif", padding: "48px 24px" }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: "1.8rem", fontWeight: 800, margin: 0, letterSpacing: "-0.01em" }}>Studio</h1>
            <p style={{ color: "#697386", margin: "4px 0 0", fontSize: "0.95rem" }}>
              Your videos — click one to open it in the editor.
            </p>
          </div>
          <Link
            href="/"
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "10px 18px", borderRadius: 8,
              background: "#4f46e5", color: "#fff", textDecoration: "none",
              fontWeight: 700, fontSize: "0.9rem",
              boxShadow: "0 1px 3px rgba(16,24,40,0.12)",
            }}
          >
            + Create new video
          </Link>
        </header>

        {loadError && (
          <div style={{ padding: 16, background: "#fee2e2", color: "#b91c1c", borderRadius: 8, fontSize: "0.9rem" }}>
            Couldn’t load videos: {loadError}
          </div>
        )}

        {!loadError && templates.length === 0 && (
          <div style={{ padding: 48, textAlign: "center", color: "#697386", background: "#fff", borderRadius: 12, border: "1px solid #e3e7ec" }}>
            No videos yet. <Link href="/" style={{ color: "#4f46e5", fontWeight: 700 }}>Create one</Link> to get started.
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
          {templates.map((t) => {
            const generated = t.family === "generated";
            return (
              <Link
                key={t.id}
                href={`/studio/editor?template=${encodeURIComponent(t.id)}`}
                style={{
                  display: "block", padding: 20, background: "#fff",
                  border: "1px solid #e3e7ec", borderRadius: 12, textDecoration: "none", color: "inherit",
                  boxShadow: "0 1px 3px rgba(16,24,40,0.04)",
                  transition: "box-shadow 120ms ease, border-color 120ms ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <span
                    style={{
                      fontSize: "0.65rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em",
                      padding: "3px 8px", borderRadius: 999,
                      background: generated ? "rgba(79,70,229,0.1)" : "rgba(22,163,74,0.1)",
                      color: generated ? "#4f46e5" : "#16a34a",
                    }}
                  >
                    {generated ? "Generated" : t.family}
                  </span>
                </div>
                <div style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: 6, lineHeight: 1.3 }}>
                  {t.name}
                </div>
                <code style={{ fontSize: "0.75rem", color: "#697386" }}>{t.id}</code>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
