import React, { useState, useEffect, useMemo, useCallback } from "react";
import axios from "axios";
import useAuthStore from "../../store/authStore";

const API = "http://localhost:3000";
const THEME_STORAGE_KEY = "3rdeyez360.theme";

/* ============= Theme system ============= */

const THEMES = {
  dark: {
    name: "dark",
    canvas: "#07080d",
    canvasTint:
      "radial-gradient(ellipse at top left, #10152a 0%, #07080d 50%), radial-gradient(ellipse at bottom right, #1a0f2e 0%, #07080d 60%)",
    surface: "rgba(22, 26, 40, 0.72)",
    surfaceElevated: "rgba(30, 34, 50, 0.85)",
    surfaceGlass: "rgba(255, 255, 255, 0.03)",
    surfaceGlassHover: "rgba(255, 255, 255, 0.055)",
    cardSurface: "rgba(28, 32, 48, 0.72)",
    cardSurfaceHover: "rgba(34, 38, 56, 0.82)",
    border: "rgba(255, 255, 255, 0.06)",
    borderStrong: "rgba(255, 255, 255, 0.12)",
    borderAccent: "rgba(91, 140, 255, 0.4)",
    textPrimary: "#f1f3fb",
    textSecondary: "#a8afc7",
    textMuted: "#6b7286",
    textFaint: "#464b60",
    accent: "#5b8cff",
    accent2: "#a065ff",
    accent3: "#ff6ec7",
    accentGradient: "linear-gradient(135deg, #5b8cff 0%, #a065ff 50%, #ff6ec7 100%)",
    accentGradientSoft:
      "linear-gradient(135deg, rgba(91,140,255,0.15) 0%, rgba(160,101,255,0.15) 50%, rgba(255,110,199,0.15) 100%)",
    accentSoft: "rgba(91,140,255,0.12)",
    success: "#3ecf8e",
    successGradient: "linear-gradient(135deg, #3ecf8e 0%, #22a37a 100%)",
    successBg: "rgba(62,207,142,0.12)",
    danger: "#ef6a6a",
    dangerGradient: "linear-gradient(135deg, #ff7a7a 0%, #d94a4a 100%)",
    dangerBg: "rgba(239,106,106,0.12)",
    glowAccent: "0 8px 32px rgba(91,140,255,0.28), 0 0 60px rgba(160,101,255,0.15)",
    inputBg: "rgba(255,255,255,0.04)",
  },
  light: {
    name: "light",
    canvas: "#eef1fb",
    canvasTint:
      "radial-gradient(ellipse at top left, #dbe4ff 0%, #eef1fb 45%), radial-gradient(ellipse at bottom right, #ffd9ec 0%, #eef1fb 55%)",
    surface: "rgba(255, 255, 255, 0.85)",
    surfaceElevated: "rgba(255, 255, 255, 0.94)",
    surfaceGlass: "rgba(255, 255, 255, 0.6)",
    surfaceGlassHover: "rgba(255, 255, 255, 0.85)",
    cardSurface: "#ffffff",
    cardSurfaceHover: "#fbfcff",
    border: "rgba(20, 28, 60, 0.08)",
    borderStrong: "rgba(20, 28, 60, 0.15)",
    borderAccent: "rgba(75, 96, 232, 0.4)",
    textPrimary: "#0b1024",
    textSecondary: "#3a4160",
    textMuted: "#6a7290",
    textFaint: "#a4abc0",
    accent: "#4b60e8",
    accent2: "#7c3aed",
    accent3: "#e94aa8",
    accentGradient: "linear-gradient(135deg, #4b60e8 0%, #7c3aed 50%, #e94aa8 100%)",
    accentGradientSoft:
      "linear-gradient(135deg, rgba(75,96,232,0.12) 0%, rgba(124,58,237,0.12) 50%, rgba(233,74,168,0.12) 100%)",
    accentSoft: "rgba(75,96,232,0.10)",
    success: "#0ea564",
    successGradient: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
    successBg: "rgba(14,165,100,0.14)",
    danger: "#dc2626",
    dangerGradient: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
    dangerBg: "rgba(220,38,38,0.12)",
    glowAccent: "0 12px 40px rgba(75,96,232,0.25), 0 0 60px rgba(124,58,237,0.15)",
    inputBg: "#ffffff",
  },
};

function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === "light" || stored === "dark") return stored;
    } catch (e) {}
    return "dark";
  });

  useEffect(() => {
    const handler = (e) => {
      if (e.key === THEME_STORAGE_KEY && (e.newValue === "light" || e.newValue === "dark")) {
        setTheme(e.newValue);
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch (e) {}
      return next;
    });
  }, []);

  return { theme, toggleTheme };
}

function ThemeToggle({ theme, onToggle }) {
  const isDark = theme === "dark";
  const t = THEMES[theme];
  return (
    <button
      onClick={onToggle}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      style={{
        position: "relative",
        width: 58,
        height: 30,
        borderRadius: 999,
        border: `1px solid ${t.borderStrong}`,
        background: isDark
          ? "linear-gradient(135deg, #0f1428 0%, #1a0f2e 100%)"
          : "linear-gradient(135deg, #ffe9a8 0%, #ffcfd8 100%)",
        cursor: "pointer",
        padding: 0,
        overflow: "hidden",
        flexShrink: 0,
        transition: "background 0.6s ease, border-color 0.5s ease",
      }}
    >
      {[
        { top: 6, left: 10, size: 2, o: isDark ? 0.9 : 0 },
        { top: 18, left: 15, size: 1.5, o: isDark ? 0.6 : 0 },
        { top: 9, left: 20, size: 1.5, o: isDark ? 0.7 : 0 },
      ].map((s, i) => (
        <span key={i} style={{ position: "absolute", top: s.top, left: s.left, width: s.size, height: s.size, borderRadius: "50%", background: "#ffffff", opacity: s.o, transition: "opacity 0.6s ease" }} />
      ))}
      <span
        style={{
          position: "absolute",
          top: 3,
          left: isDark ? 31 : 3,
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: isDark
            ? "linear-gradient(135deg, #e2e6f2 0%, #b0b8d0 100%)"
            : "linear-gradient(135deg, #ffd75c 0%, #ff9640 100%)",
          boxShadow: isDark
            ? "0 2px 10px rgba(0,0,0,0.5), inset -2px -2px 5px rgba(0,0,0,0.2)"
            : "0 2px 12px rgba(255,150,0,0.45), inset -2px -2px 5px rgba(180,90,0,0.2)",
          transition: "left 0.5s cubic-bezier(0.68, -0.4, 0.27, 1.4), background 0.5s ease, box-shadow 0.5s ease",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={isDark ? "#3d4460" : "#7a4a00"} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: isDark ? 1 : 0, transform: isDark ? "rotate(0)" : "rotate(-140deg) scale(0.4)", transition: "opacity 0.4s ease, transform 0.5s ease", position: "absolute" }}>
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7a4a00" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: isDark ? 0 : 1, transform: isDark ? "rotate(140deg) scale(0.4)" : "rotate(0)", transition: "opacity 0.4s ease, transform 0.5s ease", position: "absolute" }}>
          <circle cx="12" cy="12" r="4" />
          <line x1="12" y1="2" x2="12" y2="4" />
          <line x1="12" y1="20" x2="12" y2="22" />
          <line x1="4.93" y1="4.93" x2="6.34" y2="6.34" />
          <line x1="17.66" y1="17.66" x2="19.07" y2="19.07" />
          <line x1="2" y1="12" x2="4" y2="12" />
          <line x1="20" y1="12" x2="22" y2="12" />
          <line x1="4.93" y1="19.07" x2="6.34" y2="17.66" />
          <line x1="17.66" y1="6.34" x2="19.07" y2="4.93" />
        </svg>
      </span>
    </button>
  );
}

function BackButton({ theme, onClick }) {
  const t = THEMES[theme];
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 14px 8px 10px",
        borderRadius: 12,
        background: hover ? t.surfaceGlassHover : t.surfaceGlass,
        border: `1px solid ${hover ? t.borderStrong : t.border}`,
        color: t.textSecondary,
        cursor: "pointer",
        fontFamily: "'Inter', sans-serif",
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: 0.2,
        transition: "all 0.25s ease",
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ transform: hover ? "translateX(-2px)" : "translateX(0)", transition: "transform 0.25s ease" }}>
        <line x1="19" y1="12" x2="5" y2="12" />
        <polyline points="12 19 5 12 12 5" />
      </svg>
      Back
    </button>
  );
}

function LogoutButton({ theme }) {
  const t = THEMES[theme];
  const [loading, setLoading] = useState(false);
  const [hover, setHover] = useState(false);

  const handleLogout = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const { refreshToken } = useAuthStore.getState();
      if (refreshToken) {
        try {
          await axios.post(`${API}/api/auth/logout`, { refreshtoken: refreshToken });
        } catch (e) {
          console.log("Logout API failed, clearing local session anyway", e);
        }
      }
    } finally {
      localStorage.removeItem("app-screen");
      localStorage.removeItem("auth-storage");
      localStorage.removeItem("exam-storage");
      useAuthStore.getState().clearAuth();
    }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-label="Sign out"
      title="Sign out"
      style={{
        width: 38,
        height: 38,
        borderRadius: 10,
        background: hover ? t.dangerBg : t.surfaceGlass,
        border: `1px solid ${hover ? t.danger + "55" : t.border}`,
        cursor: loading ? "wait" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: hover ? t.danger : t.textSecondary,
        transition: "all 0.25s ease",
        flexShrink: 0,
      }}
    >
      {loading ? (
        <span style={{ width: 14, height: 14, border: `2px solid ${t.textMuted}44`, borderTopColor: t.textPrimary, borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
      ) : (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: hover ? "translateX(2px)" : "translateX(0)", transition: "transform 0.3s ease" }}>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      )}
    </button>
  );
}

export default function AssignCandidates({ exam, onBack }) {
  const { theme, toggleTheme } = useTheme();
  const t = THEMES[theme];

  const { accessToken } = useAuthStore();
  const [allCandidates, setAllCandidates] = useState([]);
  const [assigned, setAssigned] = useState([]);
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const headers = useMemo(() => ({ Authorization: `Bearer ${accessToken}` }), [accessToken]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [allRes, assignedRes] = await Promise.all([
        axios.get(`${API}/api/users?role=Candidate`, { headers }),
        axios.get(`${API}/api/exams/${exam.exam_id}/assessments`, { headers }),
      ]);

      const normalizedCandidates = (allRes.data || []).map((c) => ({
        ...c,
        user_id: c.user_id || c.userid || "",
        name: c.name || "",
        email: c.email || "",
      }));

      const assignedIds = (assignedRes.data || []).map((a) => a.candidate_id);

      setAllCandidates(normalizedCandidates);
      setAssigned(assignedIds);
    } catch (e) {
      console.error("Failed to load candidates/assignments", e);
      setError(e?.response?.data?.detail || "Failed to load candidates.");
      setAllCandidates([]);
      setAssigned([]);
    } finally {
      setLoading(false);
    }
  };

  const toggle = async (candidateId) => {
    if (!candidateId) return;
    setSaving(true);
    const isAssigned = assigned.includes(candidateId);
    try {
      if (isAssigned) {
        await axios.delete(`${API}/api/exams/${exam.exam_id}/assign/${candidateId}`, { headers });
        setAssigned((prev) => prev.filter((id) => id !== candidateId));
      } else {
        await axios.post(
          `${API}/api/exams/${exam.exam_id}/assign`,
          { candidate_id: candidateId },
          { headers }
        );
        setAssigned((prev) => [...prev, candidateId]);
      }
    } catch (e) {
      console.error("Assignment update failed", e);
      alert(e?.response?.data?.detail || "Failed to update assignment.");
    } finally {
      setSaving(false);
    }
  };

  const filtered = allCandidates.filter(
    (c) =>
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: t.canvas,
        backgroundImage: t.canvasTint,
        color: t.textPrimary,
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        transition: "background 0.7s ease, color 0.6s ease",
        position: "relative",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes cardEnter { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideInRow { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes gradientShift { 0%, 100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
        @keyframes floatBlob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(24px, -18px) scale(1.05); }
          66% { transform: translate(-18px, 20px) scale(0.96); }
        }
        ::-webkit-scrollbar { width: 9px; height: 9px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${t.borderStrong}; border-radius: 999px; }
        ::-webkit-scrollbar-thumb:hover { background: ${t.accent}; }
        .brand-gradient { background: ${t.accentGradient}; background-size: 200% 200%; animation: gradientShift 8s ease infinite; }
        button, a, input { transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease, opacity 0.2s ease; }
      `}</style>

      <div style={{ position: "absolute", top: "-10%", left: "-8%", width: 460, height: 460, borderRadius: "50%", background: `radial-gradient(circle, ${t.accent}22 0%, transparent 65%)`, filter: "blur(50px)", animation: "floatBlob 24s ease-in-out infinite", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "-14%", right: "-10%", width: 540, height: 540, borderRadius: "50%", background: `radial-gradient(circle, ${t.accent3}18 0%, transparent 65%)`, filter: "blur(60px)", animation: "floatBlob 30s ease-in-out infinite", pointerEvents: "none" }} />

      {/* Header */}
      <header
        style={{
          minHeight: 64,
          background: t.surface,
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          borderBottom: `1px solid ${t.border}`,
          display: "flex",
          alignItems: "center",
          padding: "0 24px",
          gap: 14,
          flexShrink: 0,
          flexWrap: "wrap",
          position: "relative",
          zIndex: 10,
          transition: "background 0.55s ease, border-color 0.5s ease",
        }}
      >
        <BackButton theme={theme} onClick={onBack} />
        <div style={{ width: 1, height: 24, background: t.border }} />
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2, gap: 4 }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: t.textPrimary, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: -0.2, lineHeight: 1 }}>
            Assign Candidates
          </span>
          <span style={{ fontSize: 10.5, color: t.textMuted, letterSpacing: 0.6, fontWeight: 600, lineHeight: 1 }}>
            {exam?.name}
          </span>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: t.accentSoft,
              border: `1px solid ${t.borderAccent}`,
              borderRadius: 999,
              padding: "6px 14px",
              fontSize: 12.5,
              fontWeight: 700,
              color: t.accent,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            {assigned.length} assigned
          </div>
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <LogoutButton theme={theme} />
        </div>
      </header>

      <div style={{ flex: 1, overflowY: "auto", padding: "28px 24px 40px", position: "relative", zIndex: 1 }}>
        <div style={{ maxWidth: 720, margin: "0 auto", animation: "cardEnter 0.5s ease" }}>
          {/* Search */}
          <div style={{ position: "relative", marginBottom: 20 }}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke={searchFocused ? t.accent : t.textMuted}
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", transition: "stroke 0.25s ease", pointerEvents: "none" }}
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder="Search candidates by name or email..."
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "12px 14px 12px 42px",
                fontSize: 14,
                color: t.textPrimary,
                background: t.inputBg,
                border: `1px solid ${searchFocused ? t.accent : t.border}`,
                borderRadius: 12,
                outline: "none",
                fontFamily: "'Inter', sans-serif",
                boxShadow: searchFocused ? `0 0 0 3px ${t.accentSoft}` : "none",
                transition: "border-color 0.2s ease, box-shadow 0.2s ease, background 0.5s ease",
              }}
            />
          </div>

          {loading ? (
            <div style={{ textAlign: "center", color: t.textMuted, padding: 40, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
              <span style={{ width: 26, height: 26, border: `3px solid ${t.border}`, borderTopColor: t.accent, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              Loading candidates...
            </div>
          ) : error ? (
            <div
              style={{
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
                color: t.danger,
                padding: "14px 16px",
                background: t.dangerBg,
                border: `1px solid ${t.danger}55`,
                borderRadius: 12,
                fontSize: 14,
                lineHeight: 1.5,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
            </div>
          ) : filtered.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                color: t.textMuted,
                padding: "48px 24px",
                background: t.cardSurface,
                border: `1px dashed ${t.borderStrong}`,
                borderRadius: 18,
              }}
            >
              <div style={{ width: 52, height: 52, borderRadius: "50%", background: t.accentGradientSoft, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", border: `1px solid ${t.border}` }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="1.8">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <div style={{ color: t.textPrimary, fontWeight: 700, marginBottom: 4, fontSize: 15, fontFamily: "'Space Grotesk', sans-serif" }}>No candidates found</div>
              <div>Try a different search term.</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filtered.map((c, i) => {
                const isAssigned = assigned.includes(c.user_id);
                return (
                  <div
                    key={c.user_id}
                    style={{
                      background: t.cardSurface,
                      backdropFilter: "blur(20px)",
                      WebkitBackdropFilter: "blur(20px)",
                      border: `1px solid ${isAssigned ? t.success + "66" : t.border}`,
                      borderRadius: 14,
                      padding: "14px 18px",
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      boxShadow: t.name === "light" ? "0 4px 14px rgba(20,28,60,0.06)" : "none",
                      animation: `slideInRow 0.35s cubic-bezier(0.2, 0.8, 0.2, 1) ${i * 0.03}s both`,
                    }}
                  >
                    {/* Avatar */}
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: "50%",
                        background: isAssigned ? t.successGradient : t.accentGradient,
                        backgroundSize: "200% 200%",
                        animation: "gradientShift 6s ease infinite",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        color: "#ffffff",
                        fontSize: 14,
                        fontWeight: 700,
                        boxShadow: isAssigned ? `0 4px 12px ${t.success}44` : t.glowAccent,
                      }}
                    >
                      {isAssigned ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        (c.name || "?").charAt(0).toUpperCase()
                      )}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: t.textPrimary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {c.name || "Unnamed candidate"}
                      </div>
                      <div style={{ fontSize: 12, color: t.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "'JetBrains Mono', monospace" }}>
                        {c.email || "No email"}
                      </div>
                    </div>

                    <button
                      onClick={() => toggle(c.user_id)}
                      disabled={saving}
                      style={{
                        padding: "9px 18px",
                        fontSize: 13,
                        fontWeight: 700,
                        minWidth: 96,
                        borderRadius: 10,
                        cursor: saving ? "wait" : "pointer",
                        fontFamily: "'Inter', sans-serif",
                        letterSpacing: 0.2,
                        border: isAssigned ? `1px solid ${t.danger}55` : "none",
                        background: isAssigned ? t.dangerBg : t.accentGradient,
                        color: isAssigned ? t.danger : "#ffffff",
                        boxShadow: isAssigned ? "none" : t.glowAccent,
                        opacity: saving ? 0.6 : 1,
                        transition: "all 0.2s ease",
                      }}
                    >
                      {isAssigned ? "Remove" : "Assign"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
