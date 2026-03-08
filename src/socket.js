import { io } from "socket.io-client";

export const initSocket = async () => {
  const options = {
    "force new connection": true,
    reconnectionAttempts: "Infinity",
    timeout: 5000,
    transports: ["websocket"],
    upgrade: false,
  };
  const backendUrl = process.env.REACT_APP_BACKEND_URL || window.location.origin;
  return io(backendUrl, options);
};
