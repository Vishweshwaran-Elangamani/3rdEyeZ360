import { useState, useEffect, useRef } from 'react'

export function useTimer(durationMinutes, onExpire) {
  const [timeLeft, setTimeLeft] = useState(durationMinutes * 60)
  const intervalRef = useRef(null)

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current)
          if (onExpire) onExpire()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(intervalRef.current)
  }, [])

  const formatted = () => {
    const h = Math.floor(timeLeft / 3600)
    const m = Math.floor((timeLeft % 3600) / 60)
    const s = timeLeft % 60
    if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  }

  return { timeLeft, formatted }
}