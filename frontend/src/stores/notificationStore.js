/**
 * Notification Store
 * Manages real-time notifications via WebSocket and state
 */

import { create } from 'zustand'
import { io } from 'socket.io-client'
import api from '../services/api'

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://192.168.0.200:11001'

export const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,
  socket: null,
  isConnected: false,
  isLoading: false,

  /**
   * Initialize WebSocket connection
   */
  connect: (token) => {
    const existingSocket = get().socket
    if (existingSocket?.connected) return

    try {
      const socket = io(SOCKET_URL, {
        auth: { token },
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
        transports: ['websocket', 'polling']
      })

      socket.on('connect', () => {
        set({ isConnected: true })
        console.log('WebSocket connected')
      })

      socket.on('disconnect', (reason) => {
        set({ isConnected: false })
        console.log('WebSocket disconnected:', reason)
      })

      socket.on('connect_error', (error) => {
        console.warn('WebSocket connection error:', error.message)
      })

      socket.on('notification', (notification) => {
        // Add new notification to the top
        set(state => ({
          notifications: [notification, ...state.notifications].slice(0, 50), // Keep max 50
          unreadCount: state.unreadCount + 1
        }))
      })

      socket.on('notificationMarked', ({ id }) => {
        set(state => ({
          notifications: state.notifications.map(n =>
            n.id === id ? { ...n, leida: true } : n
          )
        }))
      })

      set({ socket })
    } catch (error) {
      console.error('Failed to initialize WebSocket:', error)
    }
  },

  /**
   * Disconnect WebSocket
   */
  disconnect: () => {
    const { socket } = get()
    if (socket) {
      socket.disconnect()
      set({ socket: null, isConnected: false })
    }
  },

  /**
   * Load notifications from API
   */
  loadNotifications: async () => {
    set({ isLoading: true })
    try {
      const response = await api.get('/notificaciones')
      set({
        notifications: response.data.notificaciones || [],
        unreadCount: response.data.unreadCount || 0
      })
    } catch (error) {
      console.error('Error loading notifications:', error)
    } finally {
      set({ isLoading: false })
    }
  },

  /**
   * Mark notification as read
   */
  markAsRead: async (id) => {
    try {
      await api.put(`/notificaciones/${id}/leer`)
      set(state => ({
        notifications: state.notifications.map(n =>
          n.id === id ? { ...n, leida: true, leida_en: new Date().toISOString() } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1)
      }))

      // Notify server via WebSocket if connected
      const { socket } = get()
      if (socket?.connected) {
        socket.emit('markNotificationRead', id)
      }
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  },

  /**
   * Mark all notifications as read
   */
  markAllAsRead: async () => {
    try {
      await api.put('/notificaciones/leer-todas')
      set(state => ({
        notifications: state.notifications.map(n => ({
          ...n,
          leida: true,
          leida_en: n.leida_en || new Date().toISOString()
        })),
        unreadCount: 0
      }))
    } catch (error) {
      console.error('Error marking all notifications as read:', error)
    }
  },

  /**
   * Delete a notification
   */
  deleteNotification: async (id) => {
    try {
      await api.delete(`/notificaciones/${id}`)
      set(state => ({
        notifications: state.notifications.filter(n => n.id !== id),
        unreadCount: state.notifications.find(n => n.id === id && !n.leida)
          ? state.unreadCount - 1
          : state.unreadCount
      }))
    } catch (error) {
      console.error('Error deleting notification:', error)
    }
  },

  /**
   * Clear all notifications from state
   */
  clear: () => {
    set({ notifications: [], unreadCount: 0 })
  }
}))

export default useNotificationStore
