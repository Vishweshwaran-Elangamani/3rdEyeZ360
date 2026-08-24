import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";

const API = "http://localhost:3000";

function messageKey(message) {
  return (
    message?.messageid ||
    message?.message_id ||
    message?.clientmessageid ||
    message?.client_message_id ||
    `${message?.senderid || message?.sender_id || "unknown"}:${message?.createdat || message?.created_at || "unknown"}:${message?.message || ""}`
  );
}

function normalizeReply(reply) {
  if (!reply) return null;
  return {
    messageid: reply.messageid || reply.message_id || null,
    sendername: reply.sendername || reply.sender_name || "Unknown",
    senderrole: reply.senderrole || reply.sender_role || "Candidate",
    messagepreview: String(
      reply.messagepreview || reply.message_preview || "Message unavailable"
    ),
  };
}

function normalizeMessage(message) {
  if (!message) return null;
  return {
    ...message,
    messageid: message.messageid || message.message_id || null,
    clientmessageid: message.clientmessageid || message.client_message_id || null,
    conversationid: message.conversationid || message.conversation_id || null,
    conversationtype: String(
      message.conversationtype || message.conversation_type || ""
    ).toUpperCase(),
    examid: message.examid || message.exam_id || null,
    assessmentid: message.assessmentid || message.assessment_id || null,
    candidateid: message.candidateid || message.candidate_id || null,
    examinerid: message.examinerid || message.examiner_id || null,
    senderid: message.senderid || message.sender_id || null,
    sendername:
      message.sendername || message.sender_name || message.senderemail ||
      message.sender_email || "Unknown",
    senderrole: message.senderrole || message.sender_role || "Unknown",
    message: String(message.message || ""),
    replyto: normalizeReply(message.replyto || message.reply_to),
    createdat: message.createdat || message.created_at || null,
    editedat: message.editedat || message.edited_at || null,
    editedby: message.editedby || message.edited_by || null,
    isdeleted: Boolean(message.isdeleted || message.is_deleted),
    deletedat: message.deletedat || message.deleted_at || null,
    deletedby: message.deletedby || message.deleted_by || null,
    attachments: Array.isArray(message.attachments) ? message.attachments : [],
  };
}

function appendUnique(messages, incoming) {
  const normalized = normalizeMessage(incoming);
  if (!normalized) return messages;
  const key = messageKey(normalized);
  const index = messages.findIndex((message) => messageKey(message) === key);
  if (index < 0) return [...messages, normalized];
  const next = [...messages];
  next[index] = { ...next[index], ...normalized };
  return next;
}

export default function useExamChat({
  socket,
  accessToken,
  examId,
  assessmentId = null,
  candidateId = null,
  conversationType = "PRIVATE",
  enabled = true,
  historyLimit = 50,
}) {
  const normalizedType = String(conversationType || "PRIVATE").toUpperCase();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [replyTarget, setReplyTarget] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editing, setEditing] = useState(false);
  const [deletingMessageId, setDeletingMessageId] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const mountedRef = useRef(true);
  const latestConversationRef = useRef({
    examId,
    candidateId,
    normalizedType,
  });

  useEffect(() => {
    latestConversationRef.current = {
      examId,
      candidateId,
      normalizedType,
    };
  }, [examId, candidateId, normalizedType]);

  const roomPayload = useMemo(() => ({
    examid: examId,
    assessmentid: assessmentId || undefined,
    candidateid: normalizedType === "PRIVATE" ? candidateId || undefined : undefined,
    conversationtype: normalizedType,
  }), [examId, assessmentId, candidateId, normalizedType]);

  const historyUrl = useMemo(() => {
    if (!examId) return null;
    if (normalizedType === "GENERAL") {
      return `${API}/api/chat/exams/${encodeURIComponent(examId)}/general?limit=${historyLimit}`;
    }
    if (!candidateId) return null;
    const query = new URLSearchParams({ limit: String(historyLimit) });
    if (assessmentId) query.set("assessment_id", String(assessmentId));
    return `${API}/api/chat/exams/${encodeURIComponent(examId)}/candidates/${encodeURIComponent(candidateId)}?${query.toString()}`;
  }, [examId, candidateId, assessmentId, normalizedType, historyLimit]);

  const loadHistory = useCallback(async () => {
    if (!enabled || !accessToken || !historyUrl) {
      setMessages([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await axios.get(historyUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const rows = Array.isArray(response.data)
        ? response.data
        : Array.isArray(response.data?.messages) ? response.data.messages : [];
      if (mountedRef.current) setMessages(rows.map(normalizeMessage).filter(Boolean));
    } catch (requestError) {
      if (mountedRef.current) {
        setError(requestError?.response?.data?.detail || requestError?.message || "Unable to load chat history.");
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [enabled, accessToken, historyUrl]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    setMessages([]);
    setReplyTarget(null);
    setEditingMessage(null);
    setError("");
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (!enabled || !socket || !examId) return undefined;
    if (normalizedType === "PRIVATE" && !candidateId) return undefined;

    let disposed = false;
    let retryTimer = null;

    const sameConversation = (message) => {
      const current = latestConversationRef.current;
      if (!message || String(message.examid) !== String(current.examId)) {
        return false;
      }
      if (message.conversationtype !== current.normalizedType) return false;
      if (
        current.normalizedType === "PRIVATE" &&
        String(message.candidateid) !== String(current.candidateId)
      ) {
        return false;
      }
      return true;
    };

    const joinRoom = (attempt = 0) => {
      if (disposed || !socket.connected) return;

      socket.timeout(5000).emit(
        "chat_join",
        roomPayload,
        (timeoutError, result) => {
          if (disposed) return;
          if (!timeoutError && result?.success !== false) {
            if (mountedRef.current) setError("");
            return;
          }

          if (attempt < 4) {
            window.clearTimeout(retryTimer);
            retryTimer = window.setTimeout(
              () => joinRoom(attempt + 1),
              500 * (attempt + 1),
            );
            return;
          }

          if (mountedRef.current) {
            setError(
              result?.error ||
                timeoutError?.message ||
                "Unable to join the chat room.",
            );
          }
        },
      );
    };

    const onMessageCreated = (incoming) => {
      const message = normalizeMessage(incoming);
      if (!sameConversation(message)) return;
      setMessages((previous) => appendUnique(previous, message));
    };

    const onMessageEdited = (incoming) => {
      const message = normalizeMessage(incoming);
      if (!message?.messageid || !sameConversation(message)) return;
      setMessages((previous) =>
        previous.map((item) =>
          String(item.messageid) === String(message.messageid)
            ? { ...item, ...message }
            : item,
        ),
      );
    };

    const onMessageDeleted = (incoming) => {
      const message = normalizeMessage(incoming);
      if (!message?.messageid || !sameConversation(message)) return;
      setMessages((previous) =>
        previous.map((item) =>
          String(item.messageid) === String(message.messageid)
            ? { ...item, ...message }
            : item,
        ),
      );
      setEditingMessage((current) =>
        String(current?.messageid) === String(message.messageid)
          ? null
          : current,
      );
    };

    const onChatError = (payload) => {
      if (mountedRef.current) {
        setError(payload?.error || "Chat connection failed.");
      }
    };

    // Register listeners before joining so no delivery can be missed between
    // the room acknowledgement and listener registration.
    socket.on("connect", joinRoom);
    socket.on("chat_message_created", onMessageCreated);
    socket.on("chat_message_edited", onMessageEdited);
    socket.on("chat_message_deleted", onMessageDeleted);
    socket.on("chat_error", onChatError);

    if (socket.connected) joinRoom();

    return () => {
      disposed = true;
      window.clearTimeout(retryTimer);
      socket.off("connect", joinRoom);
      socket.off("chat_message_created", onMessageCreated);
      socket.off("chat_message_edited", onMessageEdited);
      socket.off("chat_message_deleted", onMessageDeleted);
      socket.off("chat_error", onChatError);

      // Deliberately do not emit chat_leave here. React StrictMode can run an
      // older effect cleanup after a newer chat_join, removing the active SID
      // from the room. Event filtering isolates the active conversation and
      // Socket.IO clears room membership when the socket disconnects.
    };
  }, [enabled, socket, examId, candidateId, normalizedType, roomPayload]);

  const beginReply = useCallback((message) => {
    const normalized = normalizeMessage(message);
    if (!normalized?.messageid) return;
    setReplyTarget({
      messageid: normalized.messageid,
      sendername: normalized.sendername || "Unknown",
      senderrole: normalized.senderrole || "Candidate",
      messagepreview: " ".concat(normalized.message || "").trim().replace(/\s+/g, " ").slice(0, 240),
    });
  }, []);

  const clearReplyTarget = useCallback(() => setReplyTarget(null), []);

  const beginEdit = useCallback((message) => {
    const normalized = normalizeMessage(message);
    if (!normalized?.messageid) return;
    setReplyTarget(null);
    setEditingMessage(normalized);
  }, []);

  const cancelEdit = useCallback(() => setEditingMessage(null), []);

  const editMessage = useCallback(async (value) => {
    const cleaned = String(value || "").trim();
    if (!editingMessage?.messageid || !cleaned || editing) return false;
    if (!socket?.connected) {
      setError("Chat is disconnected. Please try again after it reconnects.");
      return false;
    }
    setEditing(true);
    setError("");
    try {
      const result = await new Promise((resolve) => {
        socket.timeout(10000).emit(
          "chat_edit_message",
          { messageid: editingMessage.messageid, message: cleaned },
          (timeoutError, response) => resolve(
            timeoutError
              ? { success: false, error: "Message edit timed out." }
              : response || { success: false, error: "No response." }
          )
        );
      });
      if (result?.success === false) throw new Error(result.error || "Unable to edit message.");
      if (mountedRef.current) setEditingMessage(null);
      return true;
    } catch (editError) {
      if (mountedRef.current) setError(editError?.message || "Unable to edit message.");
      return false;
    } finally {
      if (mountedRef.current) setEditing(false);
    }
  }, [socket, editingMessage, editing]);

  const deleteMessage = useCallback(async (messageId) => {
    if (!messageId || deletingMessageId) return false;
    if (!socket?.connected) {
      setError("Chat is disconnected. Please try again after it reconnects.");
      return false;
    }
    setDeletingMessageId(messageId);
    setError("");
    try {
      const result = await new Promise((resolve) => {
        socket.timeout(10000).emit(
          "chat_delete_message",
          { messageid: messageId },
          (timeoutError, response) => resolve(
            timeoutError
              ? { success: false, error: "Message delete timed out." }
              : response || { success: false, error: "No response." }
          )
        );
      });
      if (result?.success === false) throw new Error(result.error || "Unable to delete message.");
      return true;
    } catch (deleteError) {
      if (mountedRef.current) setError(deleteError?.message || "Unable to delete message.");
      return false;
    } finally {
      if (mountedRef.current) setDeletingMessageId(null);
    }
  }, [socket, deletingMessageId]);

  const addFiles = useCallback((incomingFiles) => {
    const incoming = Array.from(incomingFiles || []);
    const allowedExtensions = /\.(jpe?g|png|webp|pdf|txt|csv|docx|xlsx)$/i;
    const accepted = incoming.filter((file) => {
      if (file.size > 10 * 1024 * 1024) {
        setError(`${file.name} exceeds 10 MB.`);
        return false;
      }
      if (!allowedExtensions.test(file.name)) {
        setError(`${file.name} is not a supported attachment type.`);
        return false;
      }
      return true;
    });
    setSelectedFiles((current) => {
      const merged = [...current, ...accepted];
      if (merged.length > 5) setError("A message can contain at most 5 attachments.");
      return merged.slice(0, 5);
    });
  }, []);

  const removeFile = useCallback((index) => {
    setSelectedFiles((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }, []);

  const clearFiles = useCallback(() => {
    setSelectedFiles([]);
    setUploadProgress(0);
  }, []);

  const uploadAttachments = useCallback(async (files = selectedFiles) => {
    if (!files.length) return [];
    const formData = new FormData();
    formData.append("exam_id", examId);
    formData.append("conversation_type", normalizedType);
    if (candidateId) formData.append("candidate_id", candidateId);
    if (assessmentId) formData.append("assessment_id", assessmentId);
    files.forEach((file) => formData.append("files", file));

    setUploading(true);
    setUploadProgress(0);
    try {
      const response = await axios.post(`${API}/api/chat/attachments`, formData, {
        headers: { Authorization: `Bearer ${accessToken}` },
        onUploadProgress: (event) => {
          if (event.total) setUploadProgress(Math.round((event.loaded * 100) / event.total));
        },
      });
      return Array.isArray(response.data?.attachments) ? response.data.attachments : [];
    } catch (uploadError) {
      setError(uploadError?.response?.data?.detail || uploadError?.message || "Unable to upload attachments.");
      throw uploadError;
    } finally {
      setUploading(false);
    }
  }, [selectedFiles, examId, normalizedType, candidateId, assessmentId, accessToken]);

  const openAttachment = useCallback(async (attachment) => {
    try {
      const response = await axios.get(
        `${API}${attachment.downloadurl}`,
        { headers: { Authorization: `Bearer ${accessToken}` }, responseType: "blob" }
      );
      const url = URL.createObjectURL(response.data);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (downloadError) {
      setError(downloadError?.response?.data?.detail || downloadError?.message || "Unable to open attachment.");
    }
  }, [accessToken]);

  const sendMessage = useCallback(async (value, attachments = []) => {
    const cleaned = String(value || "").trim();
    if ((!cleaned && attachments.length === 0) || sending) return false;
    if (!socket?.connected) {
      setError("Chat is disconnected. Please try again after it reconnects.");
      return false;
    }
    if (!examId || (normalizedType === "PRIVATE" && !candidateId)) {
      setError("Conversation information is unavailable.");
      return false;
    }

    setSending(true);
    setError("");
    const clientMessageId = globalThis.crypto?.randomUUID?.() ||
      `CHAT-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const payload = {
      examid: examId,
      assessmentid: assessmentId || undefined,
      candidateid: normalizedType === "PRIVATE" ? candidateId : undefined,
      conversationtype: normalizedType,
      message: cleaned,
      clientmessageid: clientMessageId,
      replyto: replyTarget || undefined,
      attachments,
    };

    try {
      const result = await new Promise((resolve) => {
        socket.timeout(10000).emit("chat_send_message", payload, (timeoutError, response) => {
          resolve(timeoutError
            ? { success: false, error: "Chat send timed out." }
            : response || { success: false, error: "No response." });
        });
      });
      if (result?.success === false) throw new Error(result.error || "Unable to send message.");
      if (mountedRef.current) setReplyTarget(null);
      return true;
    } catch (sendError) {
      if (mountedRef.current) setError(sendError?.message || "Unable to send message.");
      return false;
    } finally {
      if (mountedRef.current) setSending(false);
    }
  }, [socket, examId, assessmentId, candidateId, normalizedType, sending, replyTarget]);

  return {
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
    clearError: () => setError(""),
    reload: loadHistory,
    sendMessage,
  };
}
