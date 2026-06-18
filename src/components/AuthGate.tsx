"use client";
import { useState, useEffect } from "react";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if cookie exists
    const cookies = document.cookie.split(";");
    const hasAuth = cookies.some(c => c.trim().startsWith("ha-auth=ok"));
    setAuthed(hasAuth);
    setChecking(false);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      if (res.ok) {
        setAuthed(true);
        setPw("");
      } else {
        setError("Wrong password");
      }
    } catch {
      setError("Connection error");
    }
    setLoading(false);
  };

  if (checking) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#fef6e4" }}>
        <div style={{ width: 48, height: 48, border: "4px solid #0a0a0a", borderTopColor: "#ff2d2d", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      </div>
    );
  }

  if (authed) return <>{children}</>;

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#fef6e4", padding: "20px" }}>
      <form onSubmit={handleSubmit} style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 56, height: 56, background: "#ff2d2d", border: "3px solid #0a0a0a", boxShadow: "4px 4px 0 #0a0a0a", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z" /></svg>
          </div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "-0.03em", color: "#0a0a0a", marginBottom: 8 }}>
            hyper<span style={{ color: "#ff2d2d" }}>Aspect</span>
          </h1>
          <p style={{ fontSize: "0.875rem", color: "#6b6b6b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.02em" }}>
            Enter password to access
          </p>
        </div>
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="Password"
          autoFocus
          style={{ width: "100%", padding: "16px 20px", border: "3px solid #0a0a0a", background: "#fff", fontSize: "1rem", fontWeight: 500, outline: "none", boxShadow: "4px 4px 0 #0a0a0a", marginBottom: 16 }}
        />
        {error && (
          <p style={{ color: "#ff2d2d", fontSize: "0.85rem", fontWeight: 700, marginBottom: 12, textAlign: "center" }}>{error}</p>
        )}
        <button
          type="submit"
          disabled={loading || !pw}
          style={{ width: "100%", padding: "16px", background: "#ff2d2d", color: "#fef6e4", border: "3px solid #0a0a0a", fontWeight: 900, fontSize: "1rem", textTransform: "uppercase", cursor: loading || !pw ? "not-allowed" : "pointer", boxShadow: "4px 4px 0 #0a0a0a", opacity: loading || !pw ? 0.5 : 1 }}
        >
          {loading ? "Checking..." : "Enter"}
        </button>
      </form>
    </div>
  );
}
