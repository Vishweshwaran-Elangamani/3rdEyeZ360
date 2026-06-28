import { useState, useEffect, useRef, useMemo } from "react";

export function useTimer(durationMinutes, onExpire) {
  const [timeLeft, setTimeLeft] = useState((Number(durationMinutes) || 0) * 60);
  const intervalRef = useRef(null);

  useEffect(() => {
    setTimeLeft((Number(durationMinutes) || 0) * 60);
  }, [durationMinutes]);

  useEffect(() => {
    clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          if (onExpire) onExpire();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(intervalRef.current);
  }, [onExpire]);

  const formatted = useMemo(() => {
    const h = Math.floor(timeLeft / 3600);
    const m = Math.floor((timeLeft % 3600) / 60);
    const s = timeLeft % 60;

    if (h > 0) {
      return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }

    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }, [timeLeft]);

  return { timeLeft, formatted };
}