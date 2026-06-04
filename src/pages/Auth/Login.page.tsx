import { useState } from "react";
import type { FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { signInWithEmailPassword } from "@/lib/supabase";
import { Border, Palette, Text } from "@/lib/theme";

type LoginPageProps = {
  onLogin: (session: Session) => void;
};

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const session = await signInWithEmailPassword(email.trim(), password);
      onLogin(session);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg,#060d1f 0%,#0a1628 40%,#071220 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div className="bg-grid" />
      <form
        onSubmit={handleSubmit}
        style={{
          width: "min(100%, 420px)",
          background: "rgba(6,13,31,0.88)",
          border: `1px solid ${Border.default}`,
          borderRadius: 20,
          boxShadow: "0 24px 80px rgba(0,0,0,0.36)",
          padding: 28,
          position: "relative",
          zIndex: 1,
        }}
      >
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              color: Palette.cyan,
              fontFamily: "'DM Mono', monospace",
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: "0.16em",
              marginBottom: 8,
              textTransform: "uppercase",
            }}
          >
            Devtracker
          </div>
          <h1
            style={{
              color: "#e8f4ff",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 30,
              lineHeight: 1,
              margin: 0,
            }}
          >
            Sign in
          </h1>
          <p
            style={{
              color: Text.faint,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 13,
              margin: "10px 0 0",
            }}
          >
            Login with your Supabase account to access the dashboard.
          </p>
        </div>

        <label style={{ display: "block", marginBottom: 14 }}>
          <span
            style={{
              color: Text.faint,
              display: "block",
              fontFamily: "'DM Mono', monospace",
              fontSize: 10,
              fontWeight: 900,
              letterSpacing: "0.1em",
              marginBottom: 6,
              textTransform: "uppercase",
            }}
          >
            Email
          </span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
            style={{
              width: "100%",
              boxSizing: "border-box",
              border: `1px solid ${Border.default}`,
              borderRadius: 12,
              background: "rgba(255,255,255,0.04)",
              color: "#e8f4ff",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 14,
              outline: "none",
              padding: "11px 12px",
            }}
          />
        </label>

        <label style={{ display: "block", marginBottom: 18 }}>
          <span
            style={{
              color: Text.faint,
              display: "block",
              fontFamily: "'DM Mono', monospace",
              fontSize: 10,
              fontWeight: 900,
              letterSpacing: "0.1em",
              marginBottom: 6,
              textTransform: "uppercase",
            }}
          >
            Password
          </span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoComplete="current-password"
            style={{
              width: "100%",
              boxSizing: "border-box",
              border: `1px solid ${Border.default}`,
              borderRadius: 12,
              background: "rgba(255,255,255,0.04)",
              color: "#e8f4ff",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 14,
              outline: "none",
              padding: "11px 12px",
            }}
          />
        </label>

        {error && (
          <div
            role="alert"
            style={{
              color: "#ff8d8d",
              background: "rgba(255,71,87,0.1)",
              border: "1px solid rgba(255,71,87,0.28)",
              borderRadius: 12,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 13,
              marginBottom: 16,
              padding: "10px 12px",
            }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            border: "none",
            borderRadius: 999,
            background: loading
              ? "rgba(255,255,255,0.08)"
              : "linear-gradient(135deg, #00c8ff, #00e5a0)",
            color: loading ? Text.faint : "#060d1f",
            cursor: loading ? "not-allowed" : "pointer",
            fontFamily: "'DM Mono', monospace",
            fontSize: 12,
            fontWeight: 900,
            padding: "12px 16px",
            textTransform: "uppercase",
          }}
        >
          {loading ? "Signing in..." : "Login"}
        </button>
      </form>
    </div>
  );
}
