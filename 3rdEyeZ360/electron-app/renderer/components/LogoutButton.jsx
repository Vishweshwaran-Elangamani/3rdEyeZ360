import React, { useState } from "react";
import axios from "axios";
import useAuthStore from "../store/authStore";
import useExamStore from "../store/examStore";

const API = "http://localhost:3000";
const SCREEN_STORAGE_KEY = "app-screen";

async function cleanupElectronAssessmentSession() {
  const electronAPI = window.electronAPI;

  if (!electronAPI) {
    return;
  }

  const cleanupOperations = [
    {
      name: "stopCapture",
      execute: () => electronAPI.stopCapture?.(),
    },
    {
      name: "closeBrowser",
      execute: () => electronAPI.closeBrowser?.(),
    },
    {
      name: "disableLockdown",
      execute: () => electronAPI.disableLockdown?.(),
    },
    {
      name: "setClosable",
      execute: () => electronAPI.setClosable?.(true),
    },
  ];

  for (const operation of cleanupOperations) {
    try {
      const result = await operation.execute();

      if (result && result.success === false) {
        console.warn(
          `${operation.name} returned an unsuccessful result:`,
          result.error,
        );
      }
    } catch (error) {
      console.warn(`${operation.name} cleanup failed:`, error);
    }
  }
}

function clearPersistedSession() {
  try {
    localStorage.removeItem(SCREEN_STORAGE_KEY);
    localStorage.removeItem("auth-storage");
    localStorage.removeItem("exam-storage");

    sessionStorage.removeItem(SCREEN_STORAGE_KEY);
    sessionStorage.removeItem("auth-storage");
    sessionStorage.removeItem("exam-storage");
  } catch (error) {
    console.warn("Storage cleanup failed:", error);
  }
}

export default function LogoutButton({ onLoggedOut, style = {} }) {
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    if (loading) {
      return;
    }

    setLoading(true);

    const { refreshToken } = useAuthStore.getState();

    try {
      /*
       * Destroy the native Electron assessment session before navigating away
       * from the current React page.
       */
      await cleanupElectronAssessmentSession();

      if (refreshToken) {
        try {
          await axios.post(`${API}/api/auth/logout`, {
            refreshtoken: refreshToken,
          });
        } catch (error) {
          console.warn(
            "Logout API failed. The local session will still be cleared.",
            error,
          );
        }
      }
    } finally {
      /*
       * Reset assessment state first. Clearing authentication can cause the
       * application root to rerender immediately, so no previous exam must
       * remain in memory at that point.
       */
      useExamStore.getState().reset?.();
      useAuthStore.getState().clearAuth?.();

      clearPersistedSession();

      try {
        await onLoggedOut?.();
      } catch (error) {
        console.error("Logout navigation failed:", error);
      }

      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="btn"
      style={{
        padding: "10px 16px",
        borderRadius: 10,
        border: "1px solid #3a4057",
        background: "#1a1d27",
        color: "#e8eaf0",
        cursor: loading ? "wait" : "pointer",
        fontSize: 13,
        fontWeight: 600,
        opacity: loading ? 0.65 : 1,
        ...style,
      }}
    >
      {loading ? "Signing out..." : "Logout"}
    </button>
  );
}
