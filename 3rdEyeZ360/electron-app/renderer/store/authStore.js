import { create } from "zustand";
import { persist, createJSONStorage, devtools } from "zustand/middleware";

const STORAGE_KEY = "auth-storage";

const createSafeStorage = () => {
  const memory = new Map();

  return {
    getItem: (name) => {
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          return window.localStorage.getItem(name);
        }
      } catch (e) {
        console.warn("authStore localStorage getItem failed, using memory storage", e);
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
        console.warn("authStore localStorage setItem failed, using memory storage", e);
      }
      memory.set(name, value);
    },
    removeItem: (name) => {
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.removeItem(name);
        }
      } catch (e) {
        console.warn("authStore localStorage removeItem failed, using memory storage", e);
      }
      memory.delete(name);
    },
  };
};

const safeStorage = createJSONStorage(createSafeStorage);

const initialState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  hasHydrated: false,
};

const useAuthStore = create(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        hydrate: () => {
          set({ hasHydrated: true });
        },

        setAuth: (payloadOrUser, accessTokenArg, refreshTokenArg) => {
          let user = null;
          let accessToken = null;
          let refreshToken = null;

          if (accessTokenArg !== undefined || refreshTokenArg !== undefined) {
            user = payloadOrUser ?? null;
            accessToken = accessTokenArg ?? null;
            refreshToken = refreshTokenArg ?? null;
          } else {
            const payload = payloadOrUser ?? {};
            user = payload.user ?? null;
            accessToken = payload.accessToken ?? payload.access_token ?? null;
            refreshToken = payload.refreshToken ?? payload.refresh_token ?? null;
          }

          set({
            user,
            accessToken,
            refreshToken,
            hasHydrated: true,
          });
        },

        setUser: (user) =>
          set({
            user: user ?? null,
            hasHydrated: true,
          }),

        setTokens: (tokens) =>
          set({
            accessToken: tokens?.accessToken ?? tokens?.access_token ?? null,
            refreshToken: tokens?.refreshToken ?? tokens?.refresh_token ?? null,
            hasHydrated: true,
          }),

        clearAuth: () => {
          try {
            safeStorage?.removeItem?.(STORAGE_KEY);
          } catch (e) {
            console.warn("Failed to clear auth storage", e);
          }

          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            hasHydrated: true,
          });
        },

        setHasHydrated: (value = true) =>
          set({
            hasHydrated: !!value,
          }),

        _debugState: () => get(),
      }),
      {
        name: STORAGE_KEY,
        storage: safeStorage,
        partialize: (state) => ({
          user: state.user,
          accessToken: state.accessToken,
          refreshToken: state.refreshToken,
        }),
        onRehydrateStorage: () => (state, error) => {
          if (error) {
            console.error("Auth store hydration failed", error);
            try {
              safeStorage?.removeItem?.(STORAGE_KEY);
            } catch (e) {
              console.error("Failed to clear corrupted auth storage", e);
            }
          }
          state?.setHasHydrated(true);
        },
      }
    ),
    { name: "auth-store" }
  )
);

export default useAuthStore;