import { create } from 'zustand'

// Note: no localStorage — use in-memory only
const useAuthStore = create((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,

  setAuth: (user, accessToken, refreshToken) =>
    set({ user, accessToken, refreshToken }),

  clearAuth: () =>
    set({ user: null, accessToken: null, refreshToken: null }),

  updateToken: (accessToken) => set({ accessToken })
}))

export default useAuthStore