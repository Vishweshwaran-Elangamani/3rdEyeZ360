import React, { useState } from "react";
import axios from "axios";
import useAuthStore from "../store/authStore";
import useExamStore from "../store/examStore";

const API = "http://localhost:3000";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const setAuth = useAuthStore((s) => s.setAuth);
  const resetExam = useExamStore((s) => s.reset);

  const handleLogin = async () => {
    if (loading) return;

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      setError("Email and password are required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await axios.post(`${API}/api/auth/login`, {
        email: cleanEmail,
        password: cleanPassword,
      });

      resetExam();

      setAuth(
        res.data.user,
        res.data.access_token,
        res.data.refresh_token
      );

      onLogin?.(res.data.user);
    } catch (e) {
      console.error("Login Error:", e.response?.data);

      const detail = e?.response?.data?.detail || "";

      if (
        detail.includes("invalid_grant") ||
        detail.includes("Invalid user credentials") ||
        e?.response?.status === 401
      ) {
        setError("Invalid email or password");
      } else {
        setError("Unable to sign in. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleLogin();
  };

  const inputStyle = {
    width: "100%",
    padding: "12px 14px",
    borderRadius: "10px",
    border: "1px solid #2e3347",
    background: "#23283b",
    color: "#ffffff",
    fontSize: "14px",
    outline: "none",
    boxSizing: "border-box",
  };

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0f1117",
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          background: "#1a1d27",
          border: "1px solid #2e3347",
          borderRadius: "18px",
          padding: "40px",
          width: "380px",
          boxShadow: "0 12px 40px rgba(0,0,0,0.55)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "30px" }}>
          <div
            style={{
              width: "60px",
              height: "60px",
              borderRadius: "50%",
              background: "linear-gradient(135deg,#4f8ef7,#7c5ce7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "28px",
              margin: "0 auto 14px",
            }}
          >
            👁
          </div>

          <h1
            style={{
              color: "#ffffff",
              fontSize: "22px",
              fontWeight: "700",
              margin: 0,
            }}
          >
            3rdEyeZ360
          </h1>

          <p
            style={{
              color: "#9ba3b6",
              fontSize: "14px",
              marginTop: "6px",
            }}
          >
            Secure Assessment Platform
          </p>
        </div>

        {error && (
          <div
            style={{
              background: "rgba(255,92,92,0.12)",
              border: "1px solid #ff5c5c",
              borderRadius: "10px",
              padding: "12px 14px",
              color: "#ff8f8f",
              fontSize: "14px",
              fontWeight: "500",
              textAlign: "center",
              marginBottom: "18px",
            }}
          >
            ⚠ {error}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "6px",
                fontSize: "13px",
                color: "#9ba3b6",
              }}
            >
              Email
            </label>

            <input
              type="email"
              placeholder="you@example.com"
              autoComplete="username"
              value={email}
              disabled={loading}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "6px",
                fontSize: "13px",
                color: "#9ba3b6",
              }}
            >
              Password
            </label>

            <input
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              value={password}
              disabled={loading}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: "8px",
              width: "100%",
              padding: "12px",
              border: "none",
              borderRadius: "10px",
              background: loading
                ? "#406fc0"
                : "linear-gradient(90deg,#4f8ef7,#5c8df0)",
              color: "#ffffff",
              fontSize: "15px",
              fontWeight: "600",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </div>
      </form>
    </div>
  );
}
