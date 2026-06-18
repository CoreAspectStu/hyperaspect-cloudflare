'use client';

import { useState, useEffect } from 'react';
import { CREAM_BG, DARK_TEXT, BORDER, SHADOW_LG } from '@/lib/constants';

const AUTH_PASSWORD = 'spacecubed';
const STORAGE_KEY = 'hyperaspect-auth';

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [authorized, setAuthorized] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'true') {
      setAuthorized(true);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === AUTH_PASSWORD) {
      setAuthorized(true);
      setError('');
      localStorage.setItem(STORAGE_KEY, 'true');
    } else {
      setError('Incorrect password. Try again.');
    }
  };

  // Avoid hydration mismatch — render nothing until mounted
  if (!mounted) {
    return null;
  }

  if (authorized) {
    return <>{children}</>;
  }

  const gateStyle: React.CSSProperties = {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CREAM_BG,
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: CREAM_BG,
    border: BORDER,
    boxShadow: SHADOW_LG,
    padding: '2rem',
    width: '100%',
    maxWidth: '360px',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.75rem',
    border: BORDER,
    backgroundColor: '#fff',
    color: DARK_TEXT,
    fontSize: '1rem',
    outline: 'none',
  };

  const buttonStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.75rem',
    border: BORDER,
    backgroundColor: DARK_TEXT,
    color: CREAM_BG,
    fontSize: '1rem',
    fontWeight: 700,
    cursor: 'pointer',
    textTransform: 'uppercase',
  };

  const errorStyle: React.CSSProperties = {
    color: '#ff0000',
    fontWeight: 700,
    marginTop: '0.5rem',
    fontSize: '0.875rem',
  };

  return (
    <div style={gateStyle}>
      <form onSubmit={handleSubmit} style={cardStyle}>
        <h1 style={{ color: DARK_TEXT, fontSize: '1.5rem', fontWeight: 800, marginBottom: '1rem', textTransform: 'uppercase' }}>
          HyperAspect
        </h1>
        <p style={{ color: DARK_TEXT, fontSize: '0.875rem', marginBottom: '1rem' }}>
          Enter password to access the gallery.
        </p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          style={{ ...inputStyle, marginBottom: '1rem' }}
          autoFocus
        />
        <button type="submit" style={{ ...buttonStyle, boxShadow: SHADOW_LG, border: BORDER }}>
          Enter
        </button>
        {error && <p style={{ ...errorStyle, border: BORDER, padding: '0.5rem', marginTop: '1rem' }}>{error}</p>}
      </form>
    </div>
  );
}
