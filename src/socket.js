import { io } from "socket.io-client";

export const initSocket = async () => {
  const options = {
    "force new connection": true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000,
    transports: ["websocket", "polling"],
  };
  const backendUrl = process.env.REACT_APP_BACKEND_URL || window.location.origin;
  return io(backendUrl, options);
};
