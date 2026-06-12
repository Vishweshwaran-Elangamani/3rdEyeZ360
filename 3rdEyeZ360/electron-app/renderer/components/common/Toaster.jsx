import React from 'react'

const levelStyles = {
  info:    { background: '#1a2a3a', border: '1px solid #4f8ef7', icon: '💡' },
  warning: { background: '#2a2010', border: '1px solid #f5a623', icon: '⚠️' },
  error:   { background: '#2a1010', border: '1px solid #f75f5f', icon: '🚨' },
  success: { background: '#0f2a1a', border: '1px solid #34c97a', icon: '✅' }
}

export default function Toaster({ toasts, onRemove }) {
  return (
    <div style={{
      position: 'fixed', bottom: 60, right: 20,
      zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 10,
      maxWidth: 380, pointerEvents: 'none'
    }}>
      {toasts.map(toast => {
        const style = levelStyles[toast.level] || levelStyles.info
        return (
          <div key={toast.id} style={{
            ...style,
            borderRadius: 10,
            padding: '12px 16px',
            color: '#e8eaf0',
            fontSize: 13,
            lineHeight: 1.5,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            pointerEvents: 'all',
            animation: 'slideIn 0.3s ease',
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)'
          }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>{style.icon}</span>
            <span style={{ flex: 1 }}>{toast.message}</span>
            <button onClick={() => onRemove(toast.id)} style={{
              background: 'transparent', color: '#8b90a0',
              fontSize: 16, cursor: 'pointer', flexShrink: 0, padding: 0
            }}>×</button>
          </div>
        )
      })}
    </div>
  )
}