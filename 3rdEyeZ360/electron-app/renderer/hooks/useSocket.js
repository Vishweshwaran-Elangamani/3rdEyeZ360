import { useEffect, useState } from "react";
import { io } from "socket.io-client";

const SOCKET_URL = "http://localhost:3000";

let socketInstance = null;
let activeToken = null;
let subscriberCount = 0;

function createSocket(token) {
  return io(SOCKET_URL, {
    auth: { token },
    transports: ["websocket"],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000,
    forceNew: false,
  });
}

function attachBaseLogs(socket) {
  if (!socket || socket.__baseLogsAttached) return;

  socket.__baseLogsAttached = true;

  socket.on("connect", () => {
    console.log("[socket] connected", socket.id);
  });

  socket.on("disconnect", (reason) => {
    console.log("[socket] disconnected", reason);
  });

  socket.on("connect_error", (error) => {
    console.log("[socket] connect_error", error?.message || error);
  });
}

export function getSocket() {
  return socketInstance;
}

export function disconnectSocket(force = false) {
  if (!socketInstance) {
    activeToken = null;
    subscriberCount = 0;
    return;
  }

  if (!force && subscriberCount > 0) return;

  try {
    socketInstance.removeAllListeners();
  } catch (error) {
    console.log("[socket] removeAllListeners failed", error);
  }

  try {
    socketInstance.disconnect();
  } catch (error) {
    console.log("[socket] disconnect cleanup failed", error);
  }

  socketInstance = null;
  activeToken = null;
  subscriberCount = 0;
}

export function useSocket(token) {
  const [socket, setSocket] = useState(() => socketInstance);

  useEffect(() => {
    subscriberCount += 1;

    return () => {
      subscriberCount = Math.max(0, subscriberCount - 1);
    };
  }, []);

  useEffect(() => {
    if (!token) {
      disconnectSocket(true);
      setSocket(null);
      return;
    }

    const tokenChanged = activeToken !== token;

    if (!socketInstance || tokenChanged) {
      if (socketInstance) {
        try {
          socketInstance.disconnect();
        } catch (error) {
          console.log("[socket] reset failed", error);
        }
      }

      activeToken = token;
      socketInstance = createSocket(token);
      attachBaseLogs(socketInstance);
    } else if (!socketInstance.connected) {
      try {
        socketInstance.auth = { token };
        socketInstance.connect();
      } catch (error) {
        console.log("[socket] reconnect failed", error);
      }
    }

    setSocket(socketInstance);
  }, [token]);

  return socket;
}

export default useSocket;