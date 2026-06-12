import { useEffect, useRef } from 'react'
import { io } from 'socket.io-client'

let socketInstance = null

export function getSocket() {
  return socketInstance
}

export function useSocket(token) {
  const socketRef = useRef(null)

  useEffect(() => {
    if (!token) return
    if (socketInstance) {
      socketRef.current = socketInstance
      return
    }

    socketInstance = io('http://localhost:3000', {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5
    })

    socketInstance.on('connect', () => console.log('🔌 Socket connected'))
    socketInstance.on('disconnect', () => console.log('🔌 Socket disconnected'))

    socketRef.current = socketInstance

    return () => {
      // Don't disconnect on component unmount — keep alive
    }
  }, [token])

  return socketRef.current
}