import { useState, useCallback } from 'react'

let toastId = 0

export function useToaster() {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, level = 'info', duration = 5000) => {
    const id = ++toastId
    setToasts(prev => [...prev, { id, message, level }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, duration)
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return { toasts, addToast, removeToast }
}