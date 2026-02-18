import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '../services/api'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: true,

      // Initialize auth state
      initialize: async () => {
        const token = get().token
        if (!token) {
          set({ isLoading: false })
          return
        }

        try {
          const response = await api.get('/auth/me')
          set({
            user: response.data.user,
            isAuthenticated: true,
            isLoading: false
          })
        } catch (error) {
          // Token invalid, clear state
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false
          })
        }
      },

      // Login
      login: async (email, password) => {
        const response = await api.post('/auth/login', { email, password })
        const { token, user } = response.data

        set({
          token,
          user,
          isAuthenticated: true,
          isLoading: false
        })

        return user
      },

      // Logout
      logout: async () => {
        try {
          await api.post('/auth/logout')
        } catch (error) {
          // Ignore errors, just clear local state
        }

        set({
          user: null,
          token: null,
          isAuthenticated: false
        })
      },

      // Refresh token
      refreshToken: async () => {
        try {
          const response = await api.post('/auth/refresh')
          set({ token: response.data.token })
          return true
        } catch (error) {
          get().logout()
          return false
        }
      },

      // Update user data
      updateUser: (userData) => {
        set({ user: { ...get().user, ...userData } })
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ token: state.token })
    }
  )
)

// Initialize on load
useAuthStore.getState().initialize()
