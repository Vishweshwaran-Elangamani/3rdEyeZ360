import React, { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { getSocket } from '../../hooks/useSocket'

const API = 'http://localhost:3000'

export default function ChatWindow({ examId, candidateId, currentUser, token }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const bottomRef = useRef(null)

  useEffect(() => {
    if (!open) return
    axios.get(`${API}/api/chat/${examId}/${candidateId}`,
      { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setMessages(r.data))
    setUnread(0)
  }, [open])

  useEffect(() => {
    const socket = getSocket()
    if (!socket) return
    socket.on('receive_message', (msg) => {
      if (msg.exam_id === examId && msg.candidate_id === candidateId) {
        setMessages(prev => [...prev, msg])
        if (!open) setUnread(prev => prev + 1)
      }
    })
    socket.on('receive_broadcast', (msg) => {
      setMessages(prev => [...prev, {
        message_id: Date.now(), message: `📢 ${msg.message}`,
        sender_role: 'Examiner', is_broadcast: true
      }])
      if (!open) setUnread(prev => prev + 1)
    })
    return () => {
      socket.off('receive_message')
      socket.off('receive_broadcast')
    }
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = () => {
    if (!input.trim()) return
    const socket = getSocket()
    if (socket) {
      socket.emit('send_message', {
        exam_id: examId,
        candidate_id: candidateId,
        sender_id: currentUser.user_id,
        sender_role: currentUser.role,
        message: input.trim()
      })
    }
    setInput('')
  }

  return (
    <>
      {/* Chat toggle button */}
      <button onClick={() => { setOpen(o => !o); setUnread(0) }} style={{
        position: 'fixed', bottom: 60, left: 20, zIndex: 999,
        background: '#1a1d27', border: '1px solid #2e3347',
        borderRadius: '50%', width: 44, height: 44,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20, cursor: 'pointer', color: '#e8eaf0'
      }}>
        💬
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            background: '#f75f5f', color: '#fff',
            borderRadius: '50%', width: 18, height: 18,
            fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>{unread}</span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'fixed', bottom: 110, left: 20, zIndex: 998,
          width: 320, height: 400, background: '#1a1d27',
          border: '1px solid #2e3347', borderRadius: 12,
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
        }}>
          {/* Header */}
          <div style={{
            padding: '12px 16px', borderBottom: '1px solid #2e3347',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>💬 Chat with Examiner</span>
            <button onClick={() => setOpen(false)} style={{
              background: 'none', color: '#8b90a0', fontSize: 18, cursor: 'pointer'
            }}>×</button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {messages.length === 0 && (
              <p style={{ color: '#8b90a0', textAlign: 'center', fontSize: 12, marginTop: 20 }}>
                No messages yet. Ask your examiner if you need help.
              </p>
            )}
            {messages.map((msg, i) => (
              <div key={i} style={{
                alignSelf: msg.sender_id === currentUser.user_id ? 'flex-end' : 'flex-start',
                background: msg.sender_id === currentUser.user_id ? '#1e3a5f' :
                            msg.is_broadcast ? '#2a2010' : '#22263a',
                padding: '8px 12px', borderRadius: 10, maxWidth: '85%',
                fontSize: 12, lineHeight: 1.5, color: '#e8eaf0'
              }}>
                {msg.sender_role !== currentUser.role && (
                  <div style={{ fontSize: 10, color: '#8b90a0', marginBottom: 2 }}>
                    {msg.sender_role}
                  </div>
                )}
                {msg.message}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '8px 12px', borderTop: '1px solid #2e3347', display: 'flex', gap: 8 }}>
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="Type a message..."
              style={{ flex: 1, padding: '7px 10px', fontSize: 12 }}
            />
            <button onClick={send} className="btn btn-primary" style={{ padding: '7px 14px', fontSize: 12 }}>
              Send
            </button>
          </div>
        </div>
      )}
    </>
  )
}