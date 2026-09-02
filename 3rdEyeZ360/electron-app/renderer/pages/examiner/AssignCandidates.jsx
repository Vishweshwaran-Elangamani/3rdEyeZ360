import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import axios from "axios";
import useAuthStore from "../../store/authStore";
import useSocket from "../../hooks/useSocket";

const API = "http://localhost:3000";
const THEME_STORAGE_KEY = "3rdeyez360.theme";
const MAX_CANDIDATES_PER_EXAM = 25;

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
    accentGradient:
      "linear-gradient(135deg, #5b8cff 0%, #a065ff 50%, #ff6ec7 100%)",
    accentGradientSoft:
      "linear-gradient(135deg, rgba(91,140,255,0.15) 0%, rgba(160,101,255,0.15) 50%, rgba(255,110,199,0.15) 100%)",
    accentSoft: "rgba(91,140,255,0.12)",
    success: "#3ecf8e",
    successGradient: "linear-gradient(135deg, #3ecf8e 0%, #22a37a 100%)",
    successBg: "rgba(62,207,142,0.12)",
    danger: "#ef6a6a",
    dangerGradient: "linear-gradient(135deg, #ff7a7a 0%, #d94a4a 100%)",
    dangerBg: "rgba(239,106,106,0.12)",
    glowAccent:
      "0 8px 32px rgba(91,140,255,0.28), 0 0 60px rgba(160,101,255,0.15)",
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
    accentGradient:
      "linear-gradient(135deg, #4b60e8 0%, #7c3aed 50%, #e94aa8 100%)",
    accentGradientSoft:
      "linear-gradient(135deg, rgba(75,96,232,0.12) 0%, rgba(124,58,237,0.12) 50%, rgba(233,74,168,0.12) 100%)",
    accentSoft: "rgba(75,96,232,0.10)",
    success: "#0ea564",
    successGradient: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
    successBg: "rgba(14,165,100,0.14)",
    danger: "#dc2626",
    dangerGradient: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
    dangerBg: "rgba(220,38,38,0.12)",
    glowAccent:
      "0 12px 40px rgba(75,96,232,0.25), 0 0 60px rgba(124,58,237,0.15)",
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
      if (
        e.key === THEME_STORAGE_KEY &&
        (e.newValue === "light" || e.newValue === "dark")
      ) {
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
        <span
          key={i}
          style={{
            position: "absolute",
            top: s.top,
            left: s.left,
            width: s.size,
            height: s.size,
            borderRadius: "50%",
            background: "#ffffff",
            opacity: s.o,
            transition: "opacity 0.6s ease",
          }}
        />
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
          transition:
            "left 0.5s cubic-bezier(0.68, -0.4, 0.27, 1.4), background 0.5s ease, box-shadow 0.5s ease",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke={isDark ? "#3d4460" : "#7a4a00"}
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            opacity: isDark ? 1 : 0,
            transform: isDark ? "rotate(0)" : "rotate(-140deg) scale(0.4)",
            transition: "opacity 0.4s ease, transform 0.5s ease",
            position: "absolute",
          }}
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#7a4a00"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            opacity: isDark ? 0 : 1,
            transform: isDark ? "rotate(140deg) scale(0.4)" : "rotate(0)",
            transition: "opacity 0.4s ease, transform 0.5s ease",
            position: "absolute",
          }}
        >
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
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          transform: hover ? "translateX(-2px)" : "translateX(0)",
          transition: "transform 0.25s ease",
        }}
      >
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
          await axios.post(`${API}/api/auth/logout`, {
            refreshtoken: refreshToken,
          });
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
        <span
          style={{
            width: 14,
            height: 14,
            border: `2px solid ${t.textMuted}44`,
            borderTopColor: t.textPrimary,
            borderRadius: "50%",
            animation: "spin 0.7s linear infinite",
          }}
        />
      ) : (
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transform: hover ? "translateX(2px)" : "translateX(0)",
            transition: "transform 0.3s ease",
          }}
        >
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
  const socket = useSocket(accessToken);
  const assignmentRefreshTimerRef = useRef(null);
  const bulkOperationRef = useRef(false);

  const [allCandidates, setAllCandidates] = useState([]);
  const [assigned, setAssigned] = useState([]);
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [nameSortOrder, setNameSortOrder] = useState("ASC");
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [savingCandidateId, setSavingCandidateId] = useState(null);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState([]);
  const [selectedRemovalIds, setSelectedRemovalIds] = useState([]);
  const [bulkAssigning, setBulkAssigning] = useState(false);
  const [bulkRemoving, setBulkRemoving] = useState(false);
  const [showBulkRemoveConfirm, setShowBulkRemoveConfirm] = useState(false);
  const [showBulkAssignConfirm, setShowBulkAssignConfirm] = useState(false);
  const [error, setError] = useState("");

  const [candidateToRemove, setCandidateToRemove] = useState(null);
  const [modalMessage, setModalMessage] = useState("");
  const [modalType, setModalType] = useState("error");

  const examId = exam?.exam_id || exam?.examid || "";
  const assignedCount = assigned.length;
  const assignmentLimitReached = assignedCount >= MAX_CANDIDATES_PER_EXAM;

  const headers = useMemo(
    () => ({
      Authorization: `Bearer ${accessToken}`,
    }),
    [accessToken],
  );

  const closeResultModal = () => {
    setModalMessage("");
    setModalType("error");
  };

  const showResultModal = (message, type = "error") => {
    setModalType(type);
    setModalMessage(message);
  };

  const loadData = useCallback(async ({ silent = false } = {}) => {
    if (!examId) {
      setError("Exam ID is unavailable.");
      return;
    }

    if (!silent) setLoading(true);
    setError("");

    try {
      const [allRes, assignedRes] = await Promise.all([
        axios.get(`${API}/api/users?role=Candidate`, { headers }),

        axios.get(`${API}/api/exams/${examId}/assessments`, { headers }),
      ]);

      const normalizedCandidates = (
        Array.isArray(allRes.data) ? allRes.data : []
      )
        .map((candidate) => ({
          ...candidate,

          user_id: candidate.user_id || candidate.userid || candidate.id || "",

          name:
            candidate.name || candidate.fullname || candidate.full_name || "",

          email: candidate.email || candidate.email_address || "",
        }))
        .filter((candidate) => candidate.user_id);

      const assignedIds = (
        Array.isArray(assignedRes.data) ? assignedRes.data : []
      )
        .map(
          (assessment) =>
            assessment.candidate_id || assessment.candidateid || "",
        )
        .filter(Boolean);

      const uniqueAssignedIds = Array.from(new Set(assignedIds));
      setAllCandidates(normalizedCandidates);
      setAssigned(uniqueAssignedIds);
      setSelectedCandidateIds((previous) =>
        previous.filter(
          (candidateId) =>
            !uniqueAssignedIds.some(
              (assignedId) => String(assignedId) === String(candidateId),
            ),
        ),
      );
      setSelectedRemovalIds((previous) =>
        previous.filter((candidateId) =>
          uniqueAssignedIds.some(
            (assignedId) => String(assignedId) === String(candidateId),
          ),
        ),
      );
    } catch (requestError) {
      console.error("Failed to load candidates/assignments", requestError);

      const requestMessage =
        requestError?.response?.data?.detail ||
        requestError?.message ||
        "Failed to load candidates.";

      setError(requestMessage);
      setAllCandidates([]);
      setAssigned([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [examId, headers]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!socket || !examId) return undefined;

    const matchesExam = (payload) => {
      const payloadExamId = payload?.examid ?? payload?.exam_id;
      return !payloadExamId || String(payloadExamId) === String(examId);
    };

    const refreshAssignments = (payload) => {
      if (!matchesExam(payload) || bulkOperationRef.current) return;

      if (assignmentRefreshTimerRef.current) {
        window.clearTimeout(assignmentRefreshTimerRef.current);
      }

      assignmentRefreshTimerRef.current = window.setTimeout(() => {
        assignmentRefreshTimerRef.current = null;
        void loadData({ silent: true });
      }, 200);
    };

    const refreshAfterReconnect = () => {
      if (!bulkOperationRef.current) void loadData({ silent: true });
    };

    socket.on("connect", refreshAfterReconnect);
    socket.on("assessment_created", refreshAssignments);
    socket.on("assessment_updated", refreshAssignments);
    socket.on("assessment_removed", refreshAssignments);

    return () => {
      socket.off("connect", refreshAfterReconnect);
      socket.off("assessment_created", refreshAssignments);
      socket.off("assessment_updated", refreshAssignments);
      socket.off("assessment_removed", refreshAssignments);
      if (assignmentRefreshTimerRef.current) {
        window.clearTimeout(assignmentRefreshTimerRef.current);
        assignmentRefreshTimerRef.current = null;
      }
    };
  }, [socket, examId, loadData]);

  useEffect(() => {
    if (!candidateToRemove && !modalMessage) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key !== "Escape") {
        return;
      }

      if (savingCandidateId) {
        return;
      }

      if (candidateToRemove) {
        setCandidateToRemove(null);
      }

      if (modalMessage) {
        closeResultModal();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [candidateToRemove, modalMessage, savingCandidateId]);

  const availableSlots = Math.max(
    0,
    MAX_CANDIDATES_PER_EXAM - assignedCount,
  );

  const toggleCandidateSelection = (candidateId) => {
    if (!candidateId || bulkAssigning || bulkRemoving || savingCandidateId) return;
    if (assigned.some((id) => String(id) === String(candidateId))) return;

    setSelectedRemovalIds([]);
    setSelectedCandidateIds((previous) => {
      const selected = previous.some((id) => String(id) === String(candidateId));
      if (selected) {
        return previous.filter((id) => String(id) !== String(candidateId));
      }
      if (previous.length >= availableSlots) {
        showResultModal(
          `Only ${availableSlots} assignment slot(s) remain. A maximum of ${MAX_CANDIDATES_PER_EXAM} candidates can be assigned to an exam.`,
          "error",
        );
        return previous;
      }
      return [...previous, candidateId];
    });
  };

  const toggleRemovalSelection = (candidateId) => {
    if (!candidateId || bulkRemoving || bulkAssigning || savingCandidateId) return;
    if (!assigned.some((id) => String(id) === String(candidateId))) return;
    setSelectedCandidateIds([]);
    setSelectedRemovalIds((previous) =>
      previous.some((id) => String(id) === String(candidateId))
        ? previous.filter((id) => String(id) !== String(candidateId))
        : [...previous, candidateId],
    );
  };

  const removeSelectedCandidates = async () => {
    if (!examId || bulkRemoving || selectedRemovalIds.length === 0) return;
    setBulkRemoving(true);
    bulkOperationRef.current = true;
    setError("");
    try {
      const response = await axios.post(
        `${API}/api/exams/${examId}/remove-candidates`,
        { candidate_ids: selectedRemovalIds },
        { headers },
      );
      const removedIds = response.data?.removed_candidate_ids || [];
      setAssigned((previous) =>
        previous.filter(
          (id) => !removedIds.some((removedId) => String(removedId) === String(id)),
        ),
      );
      setSelectedRemovalIds([]);
      setShowBulkRemoveConfirm(false);
      const emailFailures = response.data?.email_failures?.length || 0;
      const failed = response.data?.failed?.length || 0;
      showResultModal(
        failed || emailFailures
          ? `${removedIds.length} candidate(s) removed. ${failed} removal(s) and ${emailFailures} email(s) need attention.`
          : `${removedIds.length} candidate(s) removed successfully.`,
        failed ? "error" : "success",
      );
      await loadData({ silent: true });
    } catch (requestError) {
      console.error("Bulk candidate removal failed", requestError);
      setShowBulkRemoveConfirm(false);
      showResultModal(
        requestError?.response?.data?.detail ||
          requestError?.message ||
          "Failed to remove selected candidates.",
        "error",
      );
    } finally {
      setBulkRemoving(false);
      window.setTimeout(() => {
        bulkOperationRef.current = false;
      }, 300);
    }
  };

  const assignSelectedCandidates = async () => {
    if (!examId || bulkAssigning || selectedCandidateIds.length === 0) return;
    setBulkAssigning(true);
    bulkOperationRef.current = true;
    setError("");
    try {
      const response = await axios.post(
        `${API}/api/exams/${examId}/assign-candidates`,
        { candidate_ids: selectedCandidateIds },
        { headers },
      );
      const assignedIds = response.data?.assigned_candidate_ids || [];
      setAssigned((previous) => Array.from(new Set([...previous, ...assignedIds])));
      setSelectedCandidateIds([]);
      setShowBulkAssignConfirm(false);
      const emailFailures = response.data?.email_failures?.length || 0;
      showResultModal(
        emailFailures
          ? `${assignedIds.length} candidate(s) assigned. ${emailFailures} assignment email(s) could not be sent.`
          : `${assignedIds.length} candidate(s) assigned successfully.`,
        "success",
      );
      await loadData({ silent: true });
    } catch (requestError) {
      console.error("Bulk candidate assignment failed", requestError);
      setShowBulkAssignConfirm(false);
      showResultModal(
        requestError?.response?.data?.detail ||
          requestError?.message ||
          "Failed to assign selected candidates.",
        "error",
      );
    } finally {
      setBulkAssigning(false);
      window.setTimeout(() => {
        bulkOperationRef.current = false;
      }, 300);
    }
  };

  const assignCandidate = async (candidateId) => {
    if (!candidateId || !examId || savingCandidateId) {
      return;
    }
    if (assignmentLimitReached) {
      showResultModal(
        `A maximum of ${MAX_CANDIDATES_PER_EXAM} candidates can be assigned to an exam.`,
        "error",
      );
      return;
    }

    setSavingCandidateId(candidateId);
    setError("");

    try {
      const response = await axios.post(
        `${API}/api/exams/${examId}/assign`,
        {
          candidate_id: candidateId,
        },
        {
          headers,
        },
      );

      setAssigned((previous) => {
        if (previous.includes(candidateId)) {
          return previous;
        }

        return [...previous, candidateId];
      });

      const assignment = response.data?.assessment || response.data;
      if (assignment?.assessmentid || assignment?.assessment_id) {
        window.dispatchEvent(
          new CustomEvent("assessment-created", { detail: assignment })
        );
      }

      showResultModal("Candidate assigned successfully.", "success");
    } catch (requestError) {
      console.error("Candidate assignment failed", requestError);

      showResultModal(
        requestError?.response?.data?.detail ||
          requestError?.message ||
          "Failed to assign candidate.",
        "error",
      );
    } finally {
      setSavingCandidateId(null);
    }
  };

  const requestCandidateRemoval = (candidate) => {
    if (!candidate?.user_id || savingCandidateId) {
      return;
    }

    setCandidateToRemove(candidate);
  };

  const confirmRemoveCandidate = async () => {
    const candidateId = candidateToRemove?.user_id;

    if (!candidateId || !examId || savingCandidateId) {
      return;
    }

    setSavingCandidateId(candidateId);
    setError("");

    try {
      await axios.delete(
        `${API}/api/exams/${examId}/assign/${encodeURIComponent(candidateId)}`,
        {
          headers,
        },
      );

      setAssigned((previous) =>
        previous.filter(
          (assignedId) => String(assignedId) !== String(candidateId),
        ),
      );

      setCandidateToRemove(null);

      showResultModal("Candidate removed successfully.", "success");
    } catch (requestError) {
      console.error("Candidate removal failed:", {
        status: requestError?.response?.status,
        statusText: requestError?.response?.statusText,
        data: requestError?.response?.data,
        message: requestError?.message,
      });

      const responseData = requestError?.response?.data;

      let errorMessage = "Failed to remove candidate.";

      if (typeof responseData?.detail === "string") {
        errorMessage = responseData.detail;
      } else if (Array.isArray(responseData?.detail)) {
        errorMessage = responseData.detail
          .map((item) => item?.msg || String(item))
          .join(", ");
      } else if (typeof responseData?.message === "string") {
        errorMessage = responseData.message;
      } else if (requestError?.message) {
        errorMessage = requestError.message;
      }

      setCandidateToRemove(null);

      showResultModal(errorMessage, "error");
    } finally {
      setSavingCandidateId(null);
    }
  };

  const handleCandidateAction = (candidate) => {
    const candidateId = candidate?.user_id;

    if (!candidateId) {
      showResultModal("Candidate ID is unavailable.", "error");

      return;
    }

    const isAssigned = assigned.some(
      (assignedId) => String(assignedId) === String(candidateId),
    );

    if (isAssigned) {
      requestCandidateRemoval(candidate);
      return;
    }

    assignCandidate(candidateId);
  };

  const CANDIDATES_PER_PAGE = 10;
  const normalizedSearch = search.trim().toLowerCase();

  const filtered = allCandidates.filter((candidate) => {
    if (!normalizedSearch) return true;

    const candidateName = String(candidate.name || "").toLowerCase();
    const candidateEmail = String(candidate.email || "").toLowerCase();

    return (
      candidateName.includes(normalizedSearch) ||
      candidateEmail.includes(normalizedSearch)
    );
  });

  const sortedCandidates = [...filtered].sort((left, right) => {
    const leftName = String(left.name || left.email || "");
    const rightName = String(right.name || right.email || "");
    const comparison = leftName.localeCompare(rightName, undefined, {
      sensitivity: "base",
      numeric: true,
    });
    return nameSortOrder === "ASC" ? comparison : -comparison;
  });

  const totalPages = Math.max(
    1,
    Math.ceil(sortedCandidates.length / CANDIDATES_PER_PAGE),
  );
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = (safeCurrentPage - 1) * CANDIDATES_PER_PAGE;
  const pageCandidates = sortedCandidates.slice(
    pageStartIndex,
    pageStartIndex + CANDIDATES_PER_PAGE,
  );
  const shownFrom = sortedCandidates.length === 0 ? 0 : pageStartIndex + 1;
  const shownTo = Math.min(
    pageStartIndex + CANDIDATES_PER_PAGE,
    sortedCandidates.length,
  );

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const visibleUnassignedIds = pageCandidates
    .map((candidate) => candidate.user_id)
    .filter(
      (candidateId) =>
        candidateId &&
        !assigned.some((id) => String(id) === String(candidateId)),
    );
  const selectedVisibleCount = visibleUnassignedIds.filter((candidateId) =>
    selectedCandidateIds.some((id) => String(id) === String(candidateId)),
  ).length;
  const allVisibleSelected =
    visibleUnassignedIds.length > 0 &&
    selectedVisibleCount === visibleUnassignedIds.length;
  const visibleAssignedIds = pageCandidates
    .map((candidate) => candidate.user_id)
    .filter(
      (candidateId) =>
        candidateId &&
        assigned.some((id) => String(id) === String(candidateId)),
    );
  const allVisibleAssignedSelected =
    visibleAssignedIds.length > 0 &&
    visibleAssignedIds.every((candidateId) =>
      selectedRemovalIds.some((id) => String(id) === String(candidateId)),
    );
  const selectionMode = selectedRemovalIds.length > 0 ? "REMOVE" : "ASSIGN";
  const selectedActionCount =
    selectionMode === "REMOVE"
      ? selectedRemovalIds.length
      : selectedCandidateIds.length;
  const dynamicVisibleIds =
    selectionMode === "REMOVE" ? visibleAssignedIds : visibleUnassignedIds;
  const allDynamicVisibleSelected =
    dynamicVisibleIds.length > 0 &&
    dynamicVisibleIds.every((candidateId) =>
      (selectionMode === "REMOVE" ? selectedRemovalIds : selectedCandidateIds).some(
        (id) => String(id) === String(candidateId),
      ),
    );

  const toggleSelectAllAssignedVisible = () => {
    if (bulkRemoving || bulkAssigning || savingCandidateId || !visibleAssignedIds.length) return;
    setSelectedRemovalIds((previous) => {
      if (allVisibleAssignedSelected) {
        return previous.filter(
          (id) => !visibleAssignedIds.some((visibleId) => String(visibleId) === String(id)),
        );
      }
      return Array.from(new Set([...previous, ...visibleAssignedIds]));
    });
  };

  const toggleSelectAllVisible = () => {
    if (
      bulkAssigning ||
      bulkRemoving ||
      savingCandidateId ||
      dynamicVisibleIds.length === 0
    ) {
      return;
    }

    if (selectionMode === "REMOVE") {
      setSelectedRemovalIds((previous) => {
        if (allDynamicVisibleSelected) {
          return previous.filter(
            (id) =>
              !dynamicVisibleIds.some(
                (visibleId) => String(visibleId) === String(id),
              ),
          );
        }
        return Array.from(new Set([...previous, ...dynamicVisibleIds]));
      });
      return;
    }

    setSelectedCandidateIds((previous) => {
      if (allDynamicVisibleSelected) {
        return previous.filter(
          (id) =>
            !dynamicVisibleIds.some(
              (visibleId) => String(visibleId) === String(id),
            ),
        );
      }
      const retained = previous.filter(
        (id) =>
          !dynamicVisibleIds.some(
            (visibleId) => String(visibleId) === String(id),
          ),
      );
      const room = Math.max(0, availableSlots - retained.length);
      return [...retained, ...dynamicVisibleIds.slice(0, room)];
    });
  };

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: t.canvas,
        backgroundImage: t.canvasTint,
        color: t.textPrimary,
        fontFamily:
          "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        transition: "background 0.7s ease, color 0.6s ease",
        position: "relative",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes cardEnter {
          from {
            opacity: 0;
            transform: translateY(12px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideInRow {
          from {
            opacity: 0;
            transform: translateX(-8px);
          }

          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes modalEnter {
          from {
            opacity: 0;
            transform: translateY(12px) scale(0.97);
          }

          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes overlayEnter {
          from {
            opacity: 0;
          }

          to {
            opacity: 1;
          }
        }

        @keyframes gradientShift {
          0%, 100% {
            background-position: 0% 50%;
          }

          50% {
            background-position: 100% 50%;
          }
        }

        @keyframes floatBlob {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }

          33% {
            transform: translate(24px, -18px) scale(1.05);
          }

          66% {
            transform: translate(-18px, 20px) scale(0.96);
          }
        }

        ::-webkit-scrollbar {
          width: 9px;
          height: 9px;
        }

        ::-webkit-scrollbar-track {
          background: transparent;
        }

        ::-webkit-scrollbar-thumb {
          background: ${t.borderStrong};
          border-radius: 999px;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: ${t.accent};
        }

        .brand-gradient {
          background: ${t.accentGradient};
          background-size: 200% 200%;
          animation: gradientShift 8s ease infinite;
        }

        button,
        a,
        input {
          transition:
            background-color 0.2s ease,
            border-color 0.2s ease,
            color 0.2s ease,
            box-shadow 0.2s ease,
            transform 0.2s ease,
            opacity 0.2s ease;
        }
      `}</style>

      <div
        style={{
          position: "absolute",
          top: "-10%",
          left: "-8%",
          width: 460,
          height: 460,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${t.accent}22 0%, transparent 65%)`,
          filter: "blur(50px)",
          animation: "floatBlob 24s ease-in-out infinite",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "absolute",
          bottom: "-14%",
          right: "-10%",
          width: 540,
          height: 540,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${t.accent3}18 0%, transparent 65%)`,
          filter: "blur(60px)",
          animation: "floatBlob 30s ease-in-out infinite",
          pointerEvents: "none",
        }}
      />

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

        <div
          style={{
            width: 1,
            height: 24,
            background: t.border,
          }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            lineHeight: 1.2,
            gap: 4,
          }}
        >
          <span
            style={{
              fontWeight: 700,
              fontSize: 15,
              color: t.textPrimary,
              fontFamily: "'Space Grotesk', sans-serif",
              letterSpacing: -0.2,
              lineHeight: 1,
            }}
          >
            Assign Candidates
          </span>

          <span
            style={{
              fontSize: 10.5,
              color: t.textMuted,
              letterSpacing: 0.6,
              fontWeight: 600,
              lineHeight: 1,
            }}
          >
            {exam?.name || "Exam"}
          </span>
        </div>

        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
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
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            {assignedCount} / {MAX_CANDIDATES_PER_EXAM} assigned
          </div>

          <ThemeToggle theme={theme} onToggle={toggleTheme} />

          <LogoutButton theme={theme} />
        </div>
      </header>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "28px 24px 40px",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div
          style={{
            maxWidth: 720,
            margin: "0 auto",
            animation: "cardEnter 0.5s ease",
          }}
        >
          <div
            style={{
              position: "sticky",
              top: -28,
              zIndex: 30,
              margin: "-28px -8px 14px",
              padding: "28px 8px 12px",
              background: t.canvas,
              backgroundImage: t.canvasTint,
              borderBottom: `1px solid ${t.border}`,
              boxShadow:
                t.name === "light"
                  ? "0 10px 26px rgba(20,28,60,0.08)"
                  : "0 12px 28px rgba(0,0,0,0.34)",
              backdropFilter: "blur(18px)",
              WebkitBackdropFilter: "blur(18px)",
            }}
          >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) minmax(190px, 220px)",
              gap: 10,
              marginBottom: 20,
            }}
          >
            <div style={{ position: "relative" }}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke={searchFocused ? t.accent : t.textMuted}
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                position: "absolute",
                left: 14,
                top: "50%",
                transform: "translateY(-50%)",
                transition: "stroke 0.25s ease",
                pointerEvents: "none",
              }}
            >
              <circle cx="11" cy="11" r="8" />

              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>

            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setCurrentPage(1);
              }}
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
              }}
            />
            </div>

            <div
              role="group"
              aria-label="Sort candidates by name"
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                alignItems: "center",
                gap: 4,
                padding: 4,
                borderRadius: 12,
                border: `1px solid ${t.border}`,
                background: t.inputBg,
                boxShadow:
                  t.name === "light"
                    ? "0 4px 14px rgba(20,28,60,0.05)"
                    : "inset 0 1px 0 rgba(255,255,255,0.025)",
              }}
            >
              {[
                { value: "ASC", label: "A to Z", icon: "↑" },
                { value: "DESC", label: "Z to A", icon: "↓" },
              ].map((option) => {
                const active = nameSortOrder === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={active}
                    title={`Sort names ${option.label}`}
                    onClick={() => {
                      setNameSortOrder(option.value);
                      setCurrentPage(1);
                    }}
                    style={{
                      minHeight: 36,
                      padding: "0 10px",
                      borderRadius: 9,
                      border: active
                        ? `1px solid ${t.borderAccent}`
                        : "1px solid transparent",
                      background: active ? t.accentGradient : "transparent",
                      color: active ? "#ffffff" : t.textMuted,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      fontFamily: "'Inter', sans-serif",
                      fontSize: 11.5,
                      fontWeight: 750,
                      cursor: "pointer",
                      boxShadow: active ? t.glowAccent : "none",
                      transition:
                        "background 0.2s ease, color 0.2s ease, border-color 0.2s ease, transform 0.2s ease",
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{ fontSize: 13, lineHeight: 1 }}
                    >
                      {option.icon}
                    </span>
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>


          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 0,
              padding: "11px 12px",
              borderRadius: 12,
              background:
                selectionMode === "REMOVE" ? t.dangerBg : t.surfaceGlass,
              border: `1px solid ${
                selectionMode === "REMOVE" ? `${t.danger}44` : t.border
              }`,
              transition: "background 0.2s ease, border-color 0.2s ease",
            }}
          >
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 9,
                color: t.textSecondary,
                fontSize: 12.5,
                fontWeight: 650,
                cursor: dynamicVisibleIds.length ? "pointer" : "not-allowed",
              }}
            >
              <input
                type="checkbox"
                checked={allDynamicVisibleSelected}
                disabled={
                  dynamicVisibleIds.length === 0 ||
                  bulkAssigning ||
                  bulkRemoving ||
                  Boolean(savingCandidateId) ||
                  (selectionMode === "ASSIGN" && availableSlots === 0)
                }
                onChange={toggleSelectAllVisible}
                style={{
                  width: 17,
                  height: 17,
                  accentColor:
                    selectionMode === "REMOVE" ? t.danger : t.accent,
                  cursor: "pointer",
                }}
              />
              {selectionMode === "REMOVE"
                ? "Select assigned on this page"
                : "Select unassigned on this page"}
            </label>

            <span style={{ color: t.textMuted, fontSize: 11.5 }}>
              {selectionMode === "REMOVE"
                ? `${selectedRemovalIds.length} selected for removal`
                : `${selectedCandidateIds.length} selected · ${availableSlots} slot(s) available`}
            </span>

            <button
              type="button"
              onClick={() => {
                if (selectionMode === "REMOVE") {
                  setShowBulkRemoveConfirm(true);
                } else {
                  setShowBulkAssignConfirm(true);
                }
              }}
              disabled={
                bulkAssigning ||
                bulkRemoving ||
                selectedActionCount === 0
              }
              style={{
                marginLeft: "auto",
                minWidth: 158,
                padding: "9px 15px",
                borderRadius: 10,
                border:
                  selectionMode === "REMOVE"
                    ? `1px solid ${t.danger}55`
                    : "1px solid transparent",
                background:
                  selectionMode === "REMOVE" ? t.dangerBg : t.accentGradient,
                color:
                  selectionMode === "REMOVE" ? t.danger : "#ffffff",
                fontSize: 12.5,
                fontWeight: 750,
                cursor:
                  bulkAssigning || bulkRemoving || selectedActionCount === 0
                    ? "not-allowed"
                    : "pointer",
                opacity:
                  bulkAssigning || bulkRemoving || selectedActionCount === 0
                    ? 0.45
                    : 1,
                boxShadow:
                  selectionMode === "ASSIGN" && selectedActionCount > 0
                    ? t.glowAccent
                    : "none",
              }}
            >
              {selectionMode === "REMOVE"
                ? `Remove Selected (${selectedRemovalIds.length})`
                : bulkAssigning
                  ? `Assigning ${selectedCandidateIds.length}...`
                  : `Assign Selected (${selectedCandidateIds.length})`}
            </button>
          </div>
          </div>

          {loading ? (
            <div
              style={{
                textAlign: "center",
                color: t.textMuted,
                padding: 40,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 14,
              }}
            >
              <span
                style={{
                  width: 26,
                  height: 26,
                  border: `3px solid ${t.border}`,
                  borderTopColor: t.accent,
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                }}
              />
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
              <span>{error}</span>
            </div>
          ) : sortedCandidates.length === 0 ? (
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
              <div
                style={{
                  color: t.textPrimary,
                  fontWeight: 700,
                  marginBottom: 4,
                  fontSize: 15,
                }}
              >
                No candidates found
              </div>

              <div>Try a different search term.</div>
            </div>
          ) : (
            <>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              {pageCandidates.map((candidate, index) => {
                const candidateId = candidate.user_id;

                const isAssigned = assigned.some(
                  (assignedId) => String(assignedId) === String(candidateId),
                );

                const isSaving =
                  String(savingCandidateId) === String(candidateId);

                return (
                  <div
                    key={candidateId}
                    style={{
                      background: t.cardSurface,
                      backdropFilter: "blur(20px)",
                      WebkitBackdropFilter: "blur(20px)",
                      border: `1px solid ${
                        isAssigned ? `${t.success}66` : t.border
                      }`,
                      borderRadius: 14,
                      padding: "14px 18px",
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      boxShadow:
                        t.name === "light"
                          ? "0 4px 14px rgba(20,28,60,0.06)"
                          : "none",
                      animation: `slideInRow 0.35s cubic-bezier(0.2, 0.8, 0.2, 1) ${
                        index * 0.03
                      }s both`,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={
                        isAssigned
                          ? selectedRemovalIds.some(
                              (id) => String(id) === String(candidateId),
                            )
                          : selectedCandidateIds.some(
                              (id) => String(id) === String(candidateId),
                            )
                      }
                      disabled={
                        bulkAssigning ||
                        bulkRemoving ||
                        Boolean(savingCandidateId) ||
                        (!isAssigned &&
                          !selectedCandidateIds.some(
                            (id) => String(id) === String(candidateId),
                          ) &&
                          selectedCandidateIds.length >= availableSlots)
                      }
                      onChange={() =>
                        isAssigned
                          ? toggleRemovalSelection(candidateId)
                          : toggleCandidateSelection(candidateId)
                      }
                      title={isAssigned ? "Select for removal" : "Select for assignment"}
                      style={{
                        width: 18,
                        height: 18,
                        flexShrink: 0,
                        accentColor: isAssigned ? t.success : t.accent,
                        cursor: isAssigned ? "default" : "pointer",
                      }}
                    />
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: "50%",
                        background: isAssigned
                          ? t.successGradient
                          : t.accentGradient,
                        backgroundSize: "200% 200%",
                        animation: "gradientShift 6s ease infinite",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        color: "#ffffff",
                        fontSize: 14,
                        fontWeight: 700,
                      }}
                    >
                      {isAssigned ? (
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#ffffff"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        (candidate.name || "?").charAt(0).toUpperCase()
                      )}
                    </div>

                    <div
                      style={{
                        flex: 1,
                        minWidth: 0,
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: 14,
                          color: t.textPrimary,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {candidate.name || "Unnamed candidate"}
                      </div>

                      <div
                        style={{
                          fontSize: 12,
                          color: t.textMuted,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          fontFamily: "'JetBrains Mono', monospace",
                        }}
                      >
                        {candidate.email || "No email"}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCandidateAction(candidate)}
                      disabled={
                        Boolean(savingCandidateId) ||
                        (!isAssigned && assignmentLimitReached)
                      }
                      title={
                        !isAssigned && assignmentLimitReached
                          ? `Maximum ${MAX_CANDIDATES_PER_EXAM} candidates already assigned`
                          : undefined
                      }
                      style={{
                        padding: "9px 18px",
                        fontSize: 13,
                        fontWeight: 700,
                        minWidth: 96,
                        borderRadius: 10,
                        cursor:
                          savingCandidateId
                            ? "wait"
                            : !isAssigned && assignmentLimitReached
                              ? "not-allowed"
                              : "pointer",
                        fontFamily: "'Inter', sans-serif",
                        letterSpacing: 0.2,
                        border: isAssigned ? `1px solid ${t.danger}55` : "none",
                        background: isAssigned ? t.dangerBg : t.accentGradient,
                        color: isAssigned ? t.danger : "#ffffff",
                        boxShadow: isAssigned ? "none" : t.glowAccent,
                        opacity:
                          savingCandidateId && !isSaving
                            ? 0.45
                            : !isAssigned && assignmentLimitReached
                              ? 0.5
                              : 1,
                      }}
                    >
                      {isSaving
                        ? isAssigned
                          ? "Removing..."
                          : "Assigning..."
                        : isAssigned
                          ? "Remove"
                          : assignmentLimitReached
                            ? "Limit reached"
                            : "Assign"}
                    </button>
                  </div>
                );
              })}
            </div>

            <div
              style={{
                position: "sticky",
                bottom: -40,
                zIndex: 28,
                margin: "16px -8px -40px",
                padding: "12px 12px 40px",
                display: "flex",
                alignItems: "center",
                gap: 8,
                borderRadius: "12px 12px 0 0",
                border: `1px solid ${t.border}`,
                borderBottom: "none",
                background: t.surface,
                backgroundImage: t.canvasTint,
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                boxShadow:
                  t.name === "light"
                    ? "0 -10px 26px rgba(20,28,60,0.08)"
                    : "0 -12px 28px rgba(0,0,0,0.34)",
              }}
            >
              <span
                style={{
                  marginRight: "auto",
                  color: t.textMuted,
                  fontSize: 11.5,
                  fontWeight: 600,
                }}
              >
                Showing {shownFrom}-{shownTo} of {sortedCandidates.length} candidates
              </span>

              <button
                type="button"
                disabled={bulkAssigning || bulkRemoving || safeCurrentPage <= 1}
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                style={{
                  minWidth: 76,
                  padding: "7px 10px",
                  borderRadius: 9,
                  border: `1px solid ${t.borderStrong}`,
                  background: t.surfaceGlass,
                  color: t.textSecondary,
                  fontSize: 11.5,
                  fontWeight: 650,
                  cursor: safeCurrentPage <= 1 ? "not-allowed" : "pointer",
                  opacity: safeCurrentPage <= 1 ? 0.4 : 1,
                }}
              >
                Previous
              </button>

              {Array.from({ length: totalPages }, (_, index) => index + 1)
                .filter(
                  (page) =>
                    totalPages <= 7 ||
                    page === 1 ||
                    page === totalPages ||
                    Math.abs(page - safeCurrentPage) <= 1,
                )
                .map((page, index, pages) => (
                  <React.Fragment key={page}>
                    {index > 0 && page - pages[index - 1] > 1 ? (
                      <span style={{ color: t.textMuted, fontSize: 12 }}>...</span>
                    ) : null}
                    <button
                      type="button"
                      disabled={bulkAssigning || bulkRemoving}
                      onClick={() => setCurrentPage(page)}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 9,
                        border: `1px solid ${
                          page === safeCurrentPage ? t.borderAccent : t.border
                        }`,
                        background:
                          page === safeCurrentPage ? t.accentGradient : t.surfaceGlass,
                        color: page === safeCurrentPage ? "#ffffff" : t.textSecondary,
                        fontSize: 11.5,
                        fontWeight: 750,
                        cursor: "pointer",
                      }}
                    >
                      {page}
                    </button>
                  </React.Fragment>
                ))}

              <button
                type="button"
                disabled={bulkAssigning || bulkRemoving || safeCurrentPage >= totalPages}
                onClick={() =>
                  setCurrentPage((page) => Math.min(totalPages, page + 1))
                }
                style={{
                  minWidth: 62,
                  padding: "7px 10px",
                  borderRadius: 9,
                  border: `1px solid ${t.borderStrong}`,
                  background: t.surfaceGlass,
                  color: t.textSecondary,
                  fontSize: 11.5,
                  fontWeight: 650,
                  cursor: safeCurrentPage >= totalPages ? "not-allowed" : "pointer",
                  opacity: safeCurrentPage >= totalPages ? 0.4 : 1,
                }}
              >
                Next
              </button>
            </div>
            </>
          )}
        </div>
      </div>

      {showBulkAssignConfirm ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="bulk-assign-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !bulkAssigning) {
              setShowBulkAssignConfirm(false);
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            background: "rgba(2, 5, 12, 0.78)",
            backdropFilter: "blur(5px)",
            WebkitBackdropFilter: "blur(5px)",
            animation: "overlayEnter 0.2s ease",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 450,
              background: t.surfaceElevated,
              border: `1px solid ${t.borderAccent}`,
              borderRadius: 16,
              boxShadow: "0 24px 70px rgba(0,0,0,0.55)",
              overflow: "hidden",
              animation: "modalEnter 0.22s ease",
            }}
          >
            <div style={{ padding: "22px 22px 14px" }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 16,
                  background: t.accentSoft,
                  border: `1px solid ${t.borderAccent}`,
                  color: t.accent,
                }}
              >
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <line x1="19" y1="8" x2="19" y2="14" />
                  <line x1="22" y1="11" x2="16" y2="11" />
                </svg>
              </div>
              <h3 id="bulk-assign-title" style={{ margin: 0, color: t.textPrimary, fontSize: 18, fontWeight: 700 }}>
                Assign {selectedCandidateIds.length} candidate(s)?
              </h3>
              <p style={{ margin: "10px 0 0", color: t.textSecondary, fontSize: 13, lineHeight: 1.65 }}>
                The selected candidates will receive access to <strong style={{ color: t.textPrimary }}>{exam?.name || "this exam"}</strong>. Assignment notification emails will also be sent.
              </p>
              <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: 10, background: t.accentSoft, border: `1px solid ${t.borderAccent}`, color: t.textSecondary, fontSize: 11.5 }}>
                {assignedCount} currently assigned · {selectedCandidateIds.length} selected · {availableSlots} slot(s) available
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 22px 22px" }}>
              <button
                type="button"
                disabled={bulkAssigning}
                onClick={() => setShowBulkAssignConfirm(false)}
                style={{ padding: "9px 16px", borderRadius: 9, border: `1px solid ${t.borderStrong}`, background: t.surfaceGlass, color: t.textSecondary, fontSize: 13, fontWeight: 600, cursor: bulkAssigning ? "not-allowed" : "pointer", opacity: bulkAssigning ? 0.5 : 1 }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={bulkAssigning}
                onClick={assignSelectedCandidates}
                style={{ minWidth: 155, border: "none", borderRadius: 9, padding: "9px 16px", background: t.accentGradient, color: "#ffffff", fontSize: 13, fontWeight: 700, cursor: bulkAssigning ? "wait" : "pointer", opacity: bulkAssigning ? 0.65 : 1, boxShadow: t.glowAccent }}
              >
                {bulkAssigning ? "Assigning..." : "Assign Candidates"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showBulkRemoveConfirm ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="bulk-remove-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !bulkRemoving) {
              setShowBulkRemoveConfirm(false);
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            background: "rgba(2, 5, 12, 0.78)",
            backdropFilter: "blur(5px)",
            WebkitBackdropFilter: "blur(5px)",
            animation: "overlayEnter 0.2s ease",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 450,
              background: t.surfaceElevated,
              border: `1px solid ${t.danger}55`,
              borderRadius: 16,
              boxShadow: "0 24px 70px rgba(0,0,0,0.55)",
              overflow: "hidden",
              animation: "modalEnter 0.22s ease",
            }}
          >
            <div style={{ padding: "22px 22px 14px" }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 16,
                  background: t.dangerBg,
                  border: `1px solid ${t.danger}44`,
                  color: t.danger,
                  fontSize: 22,
                  fontWeight: 800,
                }}
              >
                !
              </div>
              <h3 id="bulk-remove-title" style={{ margin: 0, color: t.textPrimary, fontSize: 18, fontWeight: 700 }}>
                Remove {selectedRemovalIds.length} assigned candidate(s)?
              </h3>
              <p style={{ margin: "10px 0 0", color: t.textSecondary, fontSize: 13, lineHeight: 1.65 }}>
                The selected candidates will lose access to <strong style={{ color: t.textPrimary }}>{exam?.name || "this exam"}</strong>. This action removes their assignment records.
              </p>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 22px 22px" }}>
              <button
                type="button"
                disabled={bulkRemoving}
                onClick={() => setShowBulkRemoveConfirm(false)}
                style={{ padding: "9px 16px", borderRadius: 9, border: `1px solid ${t.borderStrong}`, background: t.surfaceGlass, color: t.textSecondary, fontSize: 13, fontWeight: 600, cursor: bulkRemoving ? "not-allowed" : "pointer" }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={bulkRemoving}
                onClick={removeSelectedCandidates}
                style={{ minWidth: 150, border: `1px solid ${t.danger}88`, borderRadius: 9, padding: "9px 16px", background: t.dangerGradient, color: "#ffffff", fontSize: 13, fontWeight: 700, cursor: bulkRemoving ? "wait" : "pointer", opacity: bulkRemoving ? 0.65 : 1 }}
              >
                {bulkRemoving ? "Removing..." : "Remove Candidates"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {candidateToRemove ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="remove-candidate-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !savingCandidateId) {
              setCandidateToRemove(null);
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            background: "rgba(2, 5, 12, 0.78)",
            backdropFilter: "blur(5px)",
            WebkitBackdropFilter: "blur(5px)",
            animation: "overlayEnter 0.2s ease",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 430,
              background: t.surfaceElevated,
              border: `1px solid ${t.borderStrong}`,
              borderRadius: 16,
              boxShadow: "0 24px 70px rgba(0,0,0,0.55)",
              overflow: "hidden",
              animation: "modalEnter 0.22s ease",
            }}
          >
            <div
              style={{
                padding: "22px 22px 12px",
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 16,
                  background: t.dangerBg,
                  border: `1px solid ${t.danger}44`,
                  color: t.danger,
                  fontSize: 22,
                  fontWeight: 800,
                }}
              >
                !
              </div>

              <h3
                id="remove-candidate-title"
                style={{
                  margin: 0,
                  color: t.textPrimary,
                  fontSize: 18,
                  fontWeight: 700,
                }}
              >
                Remove assigned candidate?
              </h3>

              <p
                style={{
                  margin: "10px 0 0",
                  color: t.textSecondary,
                  fontSize: 13,
                  lineHeight: 1.65,
                }}
              >
                <strong
                  style={{
                    color: t.textPrimary,
                  }}
                >
                  {candidateToRemove.name ||
                    candidateToRemove.email ||
                    "This candidate"}
                </strong>{" "}
                will be removed from{" "}
                <strong
                  style={{
                    color: t.textPrimary,
                  }}
                >
                  {exam?.name || "this exam"}
                </strong>
                .
              </p>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
                padding: "14px 22px 22px",
              }}
            >
              <button
                type="button"
                disabled={Boolean(savingCandidateId)}
                onClick={() => setCandidateToRemove(null)}
                style={{
                  padding: "9px 16px",
                  borderRadius: 9,
                  border: `1px solid ${t.borderStrong}`,
                  background: t.surfaceGlass,
                  color: t.textSecondary,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: savingCandidateId ? "not-allowed" : "pointer",
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={Boolean(savingCandidateId)}
                onClick={confirmRemoveCandidate}
                style={{
                  minWidth: 118,
                  border: `1px solid ${t.danger}88`,
                  borderRadius: 9,
                  padding: "9px 16px",
                  background: t.dangerGradient,
                  color: "#ffffff",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: savingCandidateId ? "not-allowed" : "pointer",
                  opacity: savingCandidateId ? 0.65 : 1,
                }}
              >
                {savingCandidateId ? "Removing..." : "Remove"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {modalMessage ? (
        <div
          role="dialog"
          aria-modal="true"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeResultModal();
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1001,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            background: "rgba(2, 5, 12, 0.78)",
            backdropFilter: "blur(5px)",
            WebkitBackdropFilter: "blur(5px)",
            animation: "overlayEnter 0.2s ease",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 400,
              padding: 22,
              background: t.surfaceElevated,
              border: `1px solid ${
                modalType === "success" ? `${t.success}88` : `${t.danger}88`
              }`,
              borderRadius: 16,
              boxShadow: "0 24px 70px rgba(0,0,0,0.55)",
              animation: "modalEnter 0.22s ease",
            }}
          >
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 14,
                background: modalType === "success" ? t.successBg : t.dangerBg,
                color: modalType === "success" ? t.success : t.danger,
                fontSize: 20,
                fontWeight: 800,
              }}
            >
              {modalType === "success" ? "✓" : "!"}
            </div>

            <div
              style={{
                fontSize: 17,
                fontWeight: 700,
                color: t.textPrimary,
              }}
            >
              {modalType === "success" ? "Success" : "Unable to continue"}
            </div>

            <div
              style={{
                marginTop: 10,
                color: t.textSecondary,
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              {modalMessage}
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: 20,
              }}
            >
              <button
                type="button"
                onClick={closeResultModal}
                style={{
                  padding: "9px 20px",
                  border: "none",
                  borderRadius: 9,
                  background:
                    modalType === "success"
                      ? t.successGradient
                      : t.accentGradient,
                  color: "#ffffff",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
