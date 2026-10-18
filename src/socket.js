import { io } from "socket.io-client";
import { getBackendUrl } from "./utils/api";

export const initSocket = async () => {
  const options = {
    "force new connection": true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000,
    transports: ["websocket", "polling"],
  };
  return io(getBackendUrl(), options);
};
