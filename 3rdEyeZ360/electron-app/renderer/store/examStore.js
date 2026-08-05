import { create } from "zustand";
import { persist, createJSONStorage, devtools } from "zustand/middleware";

const STORAGE_KEY = "exam-storage";

const createSafeStorage = () => {
  const memory = new Map();

  return {
    getItem: (name) => {
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          return window.localStorage.getItem(name);
        }
      } catch (e) {
        console.warn("examStore localStorage getItem failed, using memory storage", e);
      }
      return memory.has(name) ? memory.get(name) : null;
    },
    setItem: (name, value) => {
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.setItem(name, value);
          return;
        }
      } catch (e) {
        console.warn("examStore localStorage setItem failed, using memory storage", e);
      }
      memory.set(name, value);
    },
    removeItem: (name) => {
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.removeItem(name);
        }
      } catch (e) {
        console.warn("examStore localStorage removeItem failed, using memory storage", e);
      }
      memory.delete(name);
    },
  };
};

const safeStorage = createJSONStorage(createSafeStorage);

const initialState = {
  currentExam: null,
  currentAssessment: null,
  examStatus: null,
  warningCounts: {},
  violationCount: 0,
  isLocked: false,
  waitingSessionId: null,
};

const useExamStore = create(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        hydrate: () => get(),

        setExam: (exam) =>
          set((state) => ({
            currentExam: typeof exam === "function" ? exam(state.currentExam) : exam ?? null,
          })),

        setAssessment: (assessment) =>
          set((state) => ({
            currentAssessment:
              typeof assessment === "function"
                ? assessment(state.currentAssessment)
                : assessment ?? null,
          })),

        setCurrentExam: (exam) =>
          set({
            currentExam: exam ?? null,
          }),

        setCurrentAssessment: (assessment) =>
          set({
            currentAssessment: assessment ?? null,
          }),

        setExamStatus: (status) =>
          set({
            examStatus: status ?? null,
          }),

        addWarning: (detail) =>
          set((state) => ({
            warningCounts: {
              ...state.warningCounts,
              [detail]: (state.warningCounts[detail] || 0) + 1,
            },
          })),

        incrementViolation: () =>
          set((state) => ({
            violationCount: state.violationCount + 1,
          })),

        setLocked: (val) =>
          set({
            isLocked: !!val,
          }),
        setWaitingSessionId: (sessionId) =>
          set({
            waitingSessionId: sessionId || null,
          }),
        clearWaitingSession: () =>
          set({
            waitingSessionId: null,
          }),

        clearExam: () => {
          try {
            safeStorage?.removeItem?.(STORAGE_KEY);
          } catch (e) {
            console.warn("Failed to clear exam storage", e);
          }

          set({
            ...initialState,
          });
        },

        resetExam: () => {
          try {
            safeStorage?.removeItem?.(STORAGE_KEY);
          } catch (e) {
            console.warn("Failed to reset exam storage", e);
          }

          set({
            ...initialState,
          });
        },

        reset: () => {
          try {
            safeStorage?.removeItem?.(STORAGE_KEY);
          } catch (e) {
            console.warn("Failed to reset exam storage", e);
          }

          set({
            ...initialState,
          });
        },

        _debugState: () => get(),
      }),
      {
        name: STORAGE_KEY,
        storage: safeStorage,
        partialize: (state) => ({
          currentExam: state.currentExam,
          currentAssessment: state.currentAssessment,
          examStatus: state.examStatus,
          warningCounts: state.warningCounts,
          violationCount: state.violationCount,
          isLocked: state.isLocked,
          waitingSessionId: state.waitingSessionId,
        }),
      }
    ),
    { name: "exam-store" }
  )
);

export default useExamStore;
