import React, { useEffect, useMemo, useRef, useState } from "react";

export default function ActiveExam({
  exam,
  assessment,
  onLogout,
}) {
  const shellRef = useRef(null);
  const browserAreaRef = useRef(null);

  const allowedSites = useMemo(() => {
    const candidates = [
      assessment?.allowedwebsites,
      assessment?.allowed_websites,
      exam?.allowedwebsites,
      exam?.allowed_websites,
    ];

    for (const item of candidates) {
      if (Array.isArray(item) && item.length) return item;
    }

    return [];
  }, [assessment, exam]);

  const [activeTab, setActiveTab] = useState(0);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const activeUrl = allowedSites[activeTab] || "";

  useEffect(() => {
    if (!window.electronAPI) return;

    window.electronAPI.openBrowser?.({ allowedWebsites: allowedSites });

    return () => {
      window.electronAPI.closeBrowser?.();
    };
  }, [allowedSites]);

  useEffect(() => {
    if (!window.electronAPI || !activeUrl) return;
    window.electronAPI.navigateBrowser?.(activeUrl);
  }, [activeUrl]);

  useEffect(() => {
    const sendBounds = () => {
      if (!shellRef.current || !browserAreaRef.current || !window.electronAPI) return;

      const shellRect = shellRef.current.getBoundingClientRect();
      const browserRect = browserAreaRef.current.getBoundingClientRect();

      const top = Math.max(0, Math.round(browserRect.top - shellRect.top));
      const left = Math.max(0, Math.round(browserRect.left - shellRect.left));
      const right = Math.max(0, Math.round(shellRect.width - browserRect.right));
      const bottom = Math.max(0, Math.round(shellRect.height - browserRect.bottom));

      window.electronAPI.resizeBrowser?.({ top, left, right, bottom });
    };

    sendBounds();

    const id = setTimeout(sendBounds, 300);
    window.addEventListener("resize", sendBounds);

    return () => {
      clearTimeout(id);
      window.removeEventListener("resize", sendBounds);
    };
  }, [activeTab, allowedSites.length]);

  const endLabel = exam?.endtime || exam?.end_time || "23:55";

  const durationSecs = 1 * 60 * 60 + 52 * 60 + 16;
  const mins = Math.floor(durationSecs / 60);
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  const secs = durationSecs % 60;

  return (
    <div
      ref={shellRef}
      style={{
        minHeight: "100vh",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#0f1117",
        color: "#e8eaf0",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: 58,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 18px",
          background: "#1a1d27",
          borderBottom: "1px solid #2c3143",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>3rdEyeZ360</div>
          <div style={{ width: 1, height: 20, background: "#394055" }} />
          <div style={{ fontSize: 14, fontWeight: 600 }}>
            {exam?.name || "Exam"}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={pill("#2b2230", "#ff6b6b")}>
            ⏱ {String(hrs).padStart(2, "0")}:
            {String(remMins).padStart(2, "0")}:
            {String(secs).padStart(2, "0")}
          </div>
          <div style={pill("#252c40", "#b8d1ff")}>🕒 Ends at {endLabel}</div>
          <div style={pill("#252937", "#f2c46d")}>⚠ 0 violations</div>
          <div style={pill("#15281f", "#44d17a")}>● Monitoring Active</div>
        </div>
      </div>

      <div
        style={{
          height: 44,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "0 10px",
          background: "#252a3d",
          borderBottom: "1px solid #32384d",
          flexShrink: 0,
        }}
      >
        <div style={{ fontSize: 13, color: "#98a0b8" }}>Allowed websites:</div>

        {allowedSites.map((site, i) => {
          const label = safeHost(site) || `Tab ${i + 1}`;
          const active = i === activeTab;

          return (
            <button
              key={`${site}-${i}`}
              onClick={() => setActiveTab(i)}
              style={{
                border: active ? "1px solid #4f8ef7" : "1px solid #474e65",
                background: active ? "#193457" : "#2a2f3f",
                color: active ? "#cfe3ff" : "#e8eaf0",
                borderRadius: 8,
                padding: "7px 12px",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Tab {i + 1}: {label}
            </button>
          );
        })}
      </div>

      <div
        ref={browserAreaRef}
        style={{
          flex: 1,
          minHeight: 0,
          background: "#0b0f17",
        }}
      />

      <div
        style={{
          height: 34,
          background: "#1a1d27",
          borderTop: "1px solid #2c3143",
          display: "flex",
          alignItems: "center",
          gap: 18,
          padding: "0 12px",
          color: "#a5acc0",
          fontSize: 13,
          flexShrink: 0,
        }}
      >
        <span>📷 Camera Active</span>
        <span>🌐 Connected</span>
        <span>🔴 Recording</span>
      </div>
    </div>
  );
}

function safeHost(url) {
  try {
    const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    return new URL(normalized).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function pill(bg, color) {
  return {
    background: bg,
    color,
    borderRadius: 10,
    padding: "8px 14px",
    fontSize: 13,
    fontWeight: 600,
  };
}