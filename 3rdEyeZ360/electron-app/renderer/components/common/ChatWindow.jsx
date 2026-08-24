import React, { useEffect, useMemo, useRef, useState } from "react";

import useAuthStore from "../../store/authStore";
import useSocket from "../../hooks/useSocket";
import useExamChat from "../../hooks/useExamChat";

function pick(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return null;
}

function formatTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function ChatWindow({
  examId,
  assessmentId = null,
  candidateId = null,
  selectedUserId = null,
  selectedUserName = null,
  currentUser: currentUserProp = null,
  token: tokenProp = null,
  conversationType = "PRIVATE",
  allowConversationSwitch = true,
  title = null,
  embedded = true,
  theme = null,
}) {
  const storeUser = useAuthStore((state) => state.user);
  const storeToken = useAuthStore((state) => state.accessToken);
  const currentUser = currentUserProp || storeUser || {};
  const accessToken = tokenProp || storeToken;
  const socket = useSocket(accessToken);

  const effectiveCandidateId = pick(
    candidateId,
    selectedUserId,
    currentUser?.role === "Candidate"
      ? currentUser?.userid || currentUser?.user_id
      : null
  );
  const initialConversationType = String(
    conversationType || "PRIVATE"
  ).toUpperCase();
  const [activeConversationType, setActiveConversationType] = useState(
    initialConversationType
  );
  const effectiveType = activeConversationType;
  const currentUserId = pick(currentUser?.userid, currentUser?.user_id);

  const [input, setInput] = useState("");
  const [open, setOpen] = useState(Boolean(embedded));
  const [unread, setUnread] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [actionMenuId, setActionMenuId] = useState(null);
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);
  const messageRefs = useRef({});
  const previousCountRef = useRef(0);

  const palette = useMemo(() => ({
    background: theme?.panelBg || theme?.surfaceSolid || "#0f1220",
    surface: theme?.surfaceGlass || "rgba(255,255,255,0.05)",
    surfaceHover: theme?.surfaceGlassHover || "rgba(255,255,255,0.08)",
    border: theme?.border || "rgba(255,255,255,0.09)",
    borderStrong: theme?.borderStrong || "rgba(255,255,255,0.16)",
    text: theme?.textPrimary || "#ffffff",
    secondary: theme?.textSecondary || "#d5daea",
    muted: theme?.textMuted || "#98a0ba",
    accent: theme?.accent || "#7c8cff",
    accentSoft: theme?.accentSoft || "rgba(124,140,255,0.14)",
    accentGradient:
      theme?.accentGradient ||
      "linear-gradient(135deg, #5b8cff 0%, #a065ff 55%, #ff6ec7 100%)",
    danger: theme?.danger || "#ff8686",
    dangerBg: theme?.dangerBg || "rgba(239,106,106,0.14)",
    input: theme?.inputBg || "rgba(255,255,255,0.06)",
  }), [theme]);

  const {
    messages,
    loading,
    sending,
    editing,
    deletingMessageId,
    selectedFiles,
    uploading,
    uploadProgress,
    error,
    replyTarget,
    editingMessage,
    beginReply,
    clearReplyTarget,
    beginEdit,
    cancelEdit,
    editMessage,
    deleteMessage,
    addFiles,
    removeFile,
    clearFiles,
    uploadAttachments,
    openAttachment,
    clearError,
    reload,
    sendMessage,
  } = useExamChat({
    socket,
    accessToken,
    examId,
    assessmentId,
    candidateId: effectiveCandidateId,
    conversationType: effectiveType,
    enabled:
      Boolean(open && examId) &&
      (effectiveType === "GENERAL" || Boolean(effectiveCandidateId)),
  });

  useEffect(() => {
    setActiveConversationType(initialConversationType);
  }, [initialConversationType]);

  useEffect(() => {
    setInput("");
    setDeleteTarget(null);
    setActionMenuId(null);
    clearReplyTarget();
    cancelEdit();
    clearFiles();
    clearError();
  }, [effectiveType]);

  useEffect(() => {
    if (open) {
      setUnread(0);
      previousCountRef.current = messages.length;
      return;
    }
    if (messages.length > previousCountRef.current) {
      setUnread((value) => value + messages.length - previousCountRef.current);
    }
    previousCountRef.current = messages.length;
  }, [open, messages.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, open]);

  const heading =
    title ||
    (effectiveType === "GENERAL"
      ? "Common chat"
      : currentUser?.role === "Candidate"
      ? "Chat with examiner"
      : `Chat with ${selectedUserName || effectiveCandidateId || "candidate"}`);

  useEffect(() => {
    if (editingMessage) setInput(editingMessage.message || "");
  }, [editingMessage]);

  const submit = async () => {
    const text = input.trim();

    if (editingMessage) {
      if (!text) return;
      if (await editMessage(text)) setInput("");
      return;
    }

    if (!text && selectedFiles.length === 0) return;

    try {
      const attachments = selectedFiles.length
        ? await uploadAttachments(selectedFiles)
        : [];

      if (await sendMessage(text, attachments)) {
        setInput("");
        clearFiles();
      }
    } catch {
      // Upload errors are displayed by the hook.
    }
  };

  const stopEditing = () => {
    cancelEdit();
    setInput("");
  };

  const scrollToMessage = (messageId) => {
    const node = messageRefs.current[messageId];
    if (!node) return;
    node.scrollIntoView({ behavior: "smooth", block: "center" });
    node.animate(
      [
        { boxShadow: `0 0 0 0 ${palette.accentSoft}` },
        { boxShadow: `0 0 0 4px ${palette.accentSoft}` },
        { boxShadow: `0 0 0 0 ${palette.accentSoft}` },
      ],
      { duration: 900 }
    );
  };

  const panel = (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: embedded ? 0 : 390,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: palette.background,
        color: palette.text,
        border: embedded ? "none" : `1px solid ${palette.borderStrong}`,
        borderRadius: embedded ? 0 : 16,
        boxShadow: embedded ? "none" : "0 18px 50px rgba(0,0,0,0.35)",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div
        style={{
          minHeight: 48,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "7px 10px",
          borderBottom: `1px solid ${palette.border}`,
          flexShrink: 0,
          background: palette.surface,
        }}
      >
        <span
          title={socket?.connected ? "Connected" : "Reconnecting"}
          aria-label={socket?.connected ? "Connected" : "Reconnecting"}
          style={{
            width: 9,
            height: 9,
            borderRadius: "50%",
            flexShrink: 0,
            background: socket?.connected ? "#3ecf8e" : palette.muted,
            boxShadow: socket?.connected
              ? "0 0 8px rgba(62,207,142,0.7)"
              : "none",
          }}
        />

        <div
          style={{
            minWidth: 0,
            flex: 1,
            color: palette.text,
            fontSize: 11.5,
            fontWeight: 800,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {heading}
        </div>

        {allowConversationSwitch ? (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: 2,
              borderRadius: 9,
              border: `1px solid ${palette.border}`,
              background: palette.background,
              flexShrink: 0,
            }}
          >
            {[
              { type: "PRIVATE", label: "Private" },
              { type: "GENERAL", label: "Common" },
            ].map((option) => {
              const active = effectiveType === option.type;
              const privateUnavailable =
                option.type === "PRIVATE" && !effectiveCandidateId;

              return (
                <button
                  key={option.type}
                  type="button"
                  disabled={privateUnavailable}
                  onClick={() => {
                    if (!privateUnavailable) {
                      setActionMenuId(null);
                      setActiveConversationType(option.type);
                    }
                  }}
                  style={{
                    minHeight: 25,
                    padding: "0 8px",
                    borderRadius: 7,
                    border: "none",
                    background: active ? palette.accentSoft : "transparent",
                    color: active ? palette.accent : palette.muted,
                    fontSize: 9,
                    fontWeight: 800,
                    cursor: privateUnavailable ? "not-allowed" : "pointer",
                    opacity: privateUnavailable ? 0.4 : 1,
                  }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        ) : null}

        <button
          type="button"
          onClick={reload}
          title="Reload messages"
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            border: `1px solid ${palette.border}`,
            background: palette.background,
            color: palette.secondary,
            cursor: loading ? "wait" : "pointer",
            flexShrink: 0,
          }}
        >
          ↻
        </button>

        {!embedded ? (
          <button
            type="button"
            onClick={() => setOpen(false)}
            title="Close chat"
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              border: `1px solid ${palette.border}`,
              background: palette.background,
              color: palette.secondary,
              cursor: "pointer",
              fontSize: 17,
              flexShrink: 0,
            }}
          >
            ×
          </button>
        ) : null}
      </div>

      {error ? (
        <button
          type="button"
          onClick={clearError}
          style={{
            margin: "10px 12px 0",
            padding: "8px 10px",
            borderRadius: 10,
            border: `1px solid ${palette.danger}55`,
            background: palette.dangerBg,
            color: palette.danger,
            fontSize: 11.5,
            textAlign: "left",
            cursor: "pointer",
          }}
        >
          {error}
        </button>
      ) : null}

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: 12,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {loading && messages.length === 0 ? (
          <div style={{ margin: "auto", color: palette.muted, fontSize: 12 }}>
            Loading messages...
          </div>
        ) : messages.length === 0 ? (
          <div
            style={{
              margin: "auto",
              maxWidth: 240,
              textAlign: "center",
              color: palette.muted,
              fontSize: 12,
              lineHeight: 1.55,
            }}
          >
            No messages yet. Use this chat for assessment-related communication.
          </div>
        ) : (
          messages.map((message, index) => {
            const ownMessage =
              currentUserId && String(message.senderid) === String(currentUserId);
            const id = message.messageid || message.clientmessageid || `${index}`;

            return (
              <div
                key={id}
                ref={(node) => {
                  if (message.messageid) messageRefs.current[message.messageid] = node;
                }}
                style={{
                  alignSelf: ownMessage ? "flex-end" : "flex-start",
                  maxWidth: "86%",
                }}
              >
                {!ownMessage ? (
                  <div style={{ margin: "0 4px 4px", color: palette.muted, fontSize: 9.5, fontWeight: 700 }}>
                    {message.sendername || message.senderrole}
                  </div>
                ) : null}

                <div
                  style={{
                    padding: "8px 10px",
                    borderRadius: ownMessage
                      ? "12px 12px 4px 12px"
                      : "12px 12px 12px 4px",
                    background: ownMessage ? palette.accentGradient : palette.surface,
                    color: ownMessage ? "#fff" : palette.text,
                    border: ownMessage ? "none" : `1px solid ${palette.border}`,
                  }}
                >
                  {message.replyto ? (
                    <button
                      type="button"
                      onClick={() => scrollToMessage(message.replyto.messageid)}
                      style={{
                        display: "block",
                        width: "100%",
                        margin: "0 0 7px",
                        padding: "6px 8px",
                        border: "none",
                        borderLeft: `3px solid ${ownMessage ? "rgba(255,255,255,0.8)" : palette.accent}`,
                        borderRadius: 6,
                        background: ownMessage ? "rgba(0,0,0,0.16)" : palette.accentSoft,
                        color: ownMessage ? "#fff" : palette.secondary,
                        textAlign: "left",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ fontSize: 9.5, fontWeight: 800, marginBottom: 2 }}>
                        {message.replyto.sendername}
                      </div>
                      <div
                        style={{
                          fontSize: 10.5,
                          opacity: 0.86,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {message.replyto.messagepreview}
                      </div>
                    </button>
                  ) : null}

                  <div style={{ fontSize: 12, lineHeight: 1.5, wordBreak: "break-word", whiteSpace: "pre-wrap" }}>
                    {message.isdeleted ? (
  <span
    style={{
      fontStyle: "italic",
      opacity: 0.72,
    }}
  >
    This message was deleted.
  </span>
) : (
  message.message
)}
                  </div>

                  {!message.isdeleted &&
                  Array.isArray(message.attachments) &&
                  message.attachments.length > 0 ? (
                    <div
                      style={{
                        marginTop: message.message ? 8 : 0,
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      {message.attachments.map((attachment) => (
                        <button
                          key={attachment.attachmentid}
                          type="button"
                          onClick={() => openAttachment(attachment)}
                          style={{
                            width: "100%",
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "8px 9px",
                            borderRadius: 9,
                            border: `1px solid ${
                              ownMessage
                                ? "rgba(255,255,255,0.24)"
                                : palette.border
                            }`,
                            background: ownMessage
                              ? "rgba(0,0,0,0.14)"
                              : palette.surfaceHover,
                            color: ownMessage ? "#fff" : palette.text,
                            cursor: "pointer",
                            textAlign: "left",
                          }}
                        >
                          <span style={{ fontSize: 16, flexShrink: 0 }}>
                            {String(
                              attachment.contenttype || ""
                            ).startsWith("image/")
                              ? "▧"
                              : "▤"}
                          </span>
                          <span style={{ minWidth: 0, flex: 1 }}>
                            <span
                              style={{
                                display: "block",
                                fontSize: 10.5,
                                fontWeight: 800,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {attachment.filename}
                            </span>
                            <span
                              style={{
                                display: "block",
                                marginTop: 2,
                                fontSize: 9,
                                opacity: 0.72,
                              }}
                            >
                              {(Number(attachment.size || 0) / 1024).toFixed(1)} KB
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div
                  style={{
                    margin: "3px 4px 0",
                    display: "flex",
                    justifyContent: ownMessage ? "flex-end" : "flex-start",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span style={{ color: palette.muted, fontSize: 9 }}>
                    {formatTime(message.createdat)}
                    {message.editedat && !message.isdeleted ? " · Edited" : ""}
                  </span>

                  {!message.isdeleted ? (
                    <div style={{ position: "relative", marginLeft: 2 }}>
                      <button
                        type="button"
                        title="Message actions"
                        aria-label="Message actions"
                        onClick={() =>
                          setActionMenuId((current) =>
                            current === id ? null : id
                          )
                        }
                        style={{
                          width: 24,
                          height: 20,
                          padding: 0,
                          borderRadius: 7,
                          border: `1px solid ${palette.border}`,
                          background: palette.surface,
                          color: palette.muted,
                          cursor: "pointer",
                          fontSize: 15,
                          lineHeight: 1,
                        }}
                      >
                        ⋮
                      </button>

                      {actionMenuId === id ? (
                        <div
                          style={{
                            position: "absolute",
                            right: ownMessage ? 0 : "auto",
                            left: ownMessage ? "auto" : 0,
                            bottom: 25,
                            zIndex: 30,
                            minWidth: 112,
                            padding: 5,
                            borderRadius: 10,
                            border: `1px solid ${palette.borderStrong}`,
                            background: palette.background,
                            boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setActionMenuId(null);
                              beginReply(message);
                            }}
                            style={{
                              width: "100%",
                              padding: "7px 9px",
                              border: "none",
                              borderRadius: 7,
                              background: "transparent",
                              color: palette.secondary,
                              textAlign: "left",
                              cursor: "pointer",
                              fontSize: 10.5,
                              fontWeight: 700,
                            }}
                          >
                            Reply
                          </button>

                          {ownMessage ? (
                            <button
                              type="button"
                              onClick={() => {
                                setActionMenuId(null);
                                beginEdit(message);
                              }}
                              style={{
                                width: "100%",
                                padding: "7px 9px",
                                border: "none",
                                borderRadius: 7,
                                background: "transparent",
                                color: palette.secondary,
                                textAlign: "left",
                                cursor: "pointer",
                                fontSize: 10.5,
                                fontWeight: 700,
                              }}
                            >
                              Edit
                            </button>
                          ) : null}

                          {ownMessage ? (
                            <button
                              type="button"
                              disabled={deletingMessageId === message.messageid}
                              onClick={() => {
                                setActionMenuId(null);
                                setDeleteTarget(message);
                              }}
                              style={{
                                width: "100%",
                                padding: "7px 9px",
                                border: "none",
                                borderRadius: 7,
                                background: "transparent",
                                color: palette.danger,
                                textAlign: "left",
                                cursor:
                                  deletingMessageId === message.messageid
                                    ? "wait"
                                    : "pointer",
                                fontSize: 10.5,
                                fontWeight: 700,
                              }}
                            >
                              {deletingMessageId === message.messageid
                                ? "Deleting..."
                                : "Delete"}
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {editingMessage ? (
        <div
          style={{
            margin: "0 12px",
            padding: "8px 10px",
            borderRadius: "9px 9px 0 0",
            border: `1px solid ${palette.border}`,
            borderBottom: "none",
            background: palette.accentSoft,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: palette.accent, fontSize: 9.5, fontWeight: 800 }}>
              Editing message
            </div>
            <div style={{ marginTop: 2, color: palette.secondary, fontSize: 10.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {editingMessage.message}
            </div>
          </div>
          <button type="button" onClick={stopEditing} title="Cancel edit" style={{ border: "none", background: "transparent", color: palette.muted, fontSize: 18, cursor: "pointer" }}>
            ×
          </button>
        </div>
      ) : replyTarget ? (
        <div
          style={{
            margin: "0 12px",
            padding: "8px 10px",
            borderRadius: "9px 9px 0 0",
            border: `1px solid ${palette.border}`,
            borderBottom: "none",
            background: palette.accentSoft,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: palette.accent, fontSize: 9.5, fontWeight: 800 }}>
              Replying to {replyTarget.sendername}
            </div>
            <div
              style={{
                marginTop: 2,
                color: palette.secondary,
                fontSize: 10.5,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {replyTarget.messagepreview}
            </div>
          </div>
          <button
            type="button"
            onClick={clearReplyTarget}
            title="Cancel reply"
            style={{
              border: "none",
              background: "transparent",
              color: palette.muted,
              fontSize: 18,
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>
      ) : null}

      {!editingMessage && selectedFiles.length > 0 ? (
        <div
          style={{
            padding: "8px 12px",
            borderTop: `1px solid ${palette.border}`,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {selectedFiles.map((file, index) => (
            <div
              key={`${file.name}-${file.lastModified}-${index}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "7px 9px",
                borderRadius: 9,
                background: palette.surface,
                border: `1px solid ${palette.border}`,
              }}
            >
              <span style={{ color: palette.accent, fontSize: 14 }}>▤</span>
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  color: palette.secondary,
                  fontSize: 10.5,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {file.name}
              </span>
              <span style={{ color: palette.muted, fontSize: 9 }}>
                {(file.size / 1024).toFixed(1)} KB
              </span>
              <button
                type="button"
                onClick={() => removeFile(index)}
                disabled={uploading}
                style={{
                  border: "none",
                  background: "transparent",
                  color: palette.muted,
                  cursor: uploading ? "not-allowed" : "pointer",
                  fontSize: 16,
                }}
              >
                ×
              </button>
            </div>
          ))}

          {uploading ? (
            <div
              style={{
                height: 4,
                borderRadius: 999,
                background: palette.borderStrong,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${uploadProgress}%`,
                  background: palette.accentGradient,
                  transition: "width 150ms ease",
                }}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      <div
        style={{
          padding: "10px 12px",
          borderTop: replyTarget ? "none" : `1px solid ${palette.border}`,
          display: "flex",
          gap: 8,
          flexShrink: 0,
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.webp,.pdf,.txt,.csv,.docx,.xlsx"
          onChange={(event) => {
            addFiles(event.target.files);
            event.target.value = "";
          }}
          style={{ display: "none" }}
        />
        <button
          type="button"
          title="Add attachments"
          disabled={
            Boolean(editingMessage) ||
            uploading ||
            selectedFiles.length >= 5
          }
          onClick={() => fileInputRef.current?.click()}
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            border: `1px solid ${palette.border}`,
            background: palette.surface,
            color: palette.secondary,
            cursor:
              editingMessage || uploading || selectedFiles.length >= 5
                ? "not-allowed"
                : "pointer",
            fontSize: 18,
            flexShrink: 0,
          }}
        >
          +
        </button>
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          rows={1}
          maxLength={1000}
          placeholder={editingMessage ? "Edit your message..." : replyTarget ? "Write a reply..." : "Type a message..."}
          style={{
            flex: 1,
            minWidth: 0,
            maxHeight: 88,
            resize: "none",
            padding: "9px 11px",
            borderRadius: 10,
            border: `1px solid ${palette.border}`,
            background: palette.input,
            color: palette.text,
            outline: "none",
            fontSize: 12,
            lineHeight: 1.45,
            fontFamily: "inherit",
          }}
        />
        <button
          type="button"
          onClick={submit}
          disabled={(!input.trim() && selectedFiles.length === 0) || sending || editing || uploading || !socket?.connected}
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            border: "none",
            background:
              (!input.trim() && selectedFiles.length === 0) || sending || editing || uploading || !socket?.connected
                ? palette.borderStrong
                : palette.accentGradient,
            color: "#fff",
            cursor:
              (!input.trim() && selectedFiles.length === 0) || sending || editing || uploading || !socket?.connected
                ? "not-allowed"
                : "pointer",
          }}
        >
          {sending || editing || uploading ? "…" : editingMessage ? "✓" : "➤"}
        </button>
      </div>

      {deleteTarget ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="chat-delete-title"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              deletingMessageId !== deleteTarget.messageid
            ) {
              setDeleteTarget(null);
            }
          }}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            background: "rgba(5, 7, 15, 0.72)",
            backdropFilter: "blur(5px)",
          }}
        >
          <div
            onMouseDown={(event) => event.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 340,
              borderRadius: 16,
              border: `1px solid ${palette.borderStrong}`,
              background: palette.background,
              boxShadow: "0 24px 70px rgba(0,0,0,0.48)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "16px 18px",
                borderBottom: `1px solid ${palette.border}`,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 11,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  color: palette.danger,
                  background: palette.dangerBg,
                  border: `1px solid ${palette.danger}44`,
                }}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14H6L5 6" />
                  <path d="M8 6V4h8v2" />
                  <line x1="10" y1="11" x2="10" y2="17" />
                  <line x1="14" y1="11" x2="14" y2="17" />
                </svg>
              </div>

              <div style={{ minWidth: 0, flex: 1 }}>
                <div id="chat-delete-title" style={{ color: palette.text, fontSize: 14, fontWeight: 800 }}>
                  Delete message?
                </div>
                <div style={{ marginTop: 3, color: palette.muted, fontSize: 10.5, lineHeight: 1.4 }}>
                  This action cannot be undone.
                </div>
              </div>

              <button
                type="button"
                title="Close"
                disabled={deletingMessageId === deleteTarget.messageid}
                onClick={() => setDeleteTarget(null)}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 9,
                  border: `1px solid ${palette.border}`,
                  background: palette.surface,
                  color: palette.secondary,
                  cursor:
                    deletingMessageId === deleteTarget.messageid
                      ? "not-allowed"
                      : "pointer",
                  fontSize: 18,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            <div style={{ padding: "16px 18px" }}>
              

              <div
                style={{
                  marginTop: 12,
                  padding: "11px 12px",
                  borderRadius: 11,
                  border: `1px solid ${palette.border}`,
                  borderLeft: `3px solid ${palette.danger}`,
                  background: palette.surface,
                }}
              >
                <div
                  style={{
                    color: palette.muted,
                    fontSize: 9.5,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    marginBottom: 5,
                  }}
                >
                  Message preview
                </div>
                <div
                  style={{
                    color: palette.text,
                    fontSize: 12,
                    lineHeight: 1.5,
                    overflow: "hidden",
                    display: "-webkit-box",
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: "vertical",
                    wordBreak: "break-word",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {deleteTarget.message}
                </div>
              </div>

             
            </div>

            <div
              style={{
                padding: "12px 18px 16px",
                display: "flex",
                justifyContent: "flex-end",
                gap: 9,
                borderTop: `1px solid ${palette.border}`,
              }}
            >
              <button
                type="button"
                disabled={deletingMessageId === deleteTarget.messageid}
                onClick={() => setDeleteTarget(null)}
                style={{
                  minWidth: 82,
                  padding: "9px 14px",
                  borderRadius: 10,
                  border: `1px solid ${palette.borderStrong}`,
                  background: palette.surface,
                  color: palette.secondary,
                  fontSize: 11.5,
                  fontWeight: 800,
                  cursor:
                    deletingMessageId === deleteTarget.messageid
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={deletingMessageId === deleteTarget.messageid}
                onClick={async () => {
                  const deleted = await deleteMessage(deleteTarget.messageid);
                  if (deleted) setDeleteTarget(null);
                }}
                style={{
                  minWidth: 120,
                  padding: "9px 14px",
                  borderRadius: 10,
                  border: `1px solid ${palette.danger}66`,
                  background:
                    deletingMessageId === deleteTarget.messageid
                      ? palette.borderStrong
                      : palette.dangerBg,
                  color:
                    deletingMessageId === deleteTarget.messageid
                      ? palette.muted
                      : palette.danger,
                  fontSize: 11.5,
                  fontWeight: 800,
                  cursor:
                    deletingMessageId === deleteTarget.messageid
                      ? "wait"
                      : "pointer",
                }}
              >
                {deletingMessageId === deleteTarget.messageid
                  ? "Deleting..."
                  : "Delete message"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );

  if (embedded) return panel;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value);
          setUnread(0);
        }}
        title="Open chat"
        style={{
          position: "fixed",
          right: 22,
          bottom: 22,
          zIndex: 9998,
          width: 48,
          height: 48,
          borderRadius: "50%",
          border: `1px solid ${palette.borderStrong}`,
          background: palette.accentGradient,
          color: "#fff",
          cursor: "pointer",
          boxShadow: "0 12px 30px rgba(0,0,0,0.3)",
        }}
      >
        ◯
        {unread > 0 ? (
          <span
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              minWidth: 19,
              height: 19,
              borderRadius: 999,
              background: palette.danger,
              border: `2px solid ${palette.background}`,
              fontSize: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          style={{
            position: "fixed",
            right: 22,
            bottom: 80,
            width: 360,
            height: 480,
            maxHeight: "calc(100vh - 110px)",
            zIndex: 9999,
          }}
        >
          {panel}
        </div>
      ) : null}
    </>
  );
}
