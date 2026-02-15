import { io } from "socket.io-client";
import { auth } from "@/context/firebase";

let socket: ReturnType<typeof io> | null = null;
let connecting: Promise<ReturnType<typeof io>> | null = null;

export const getSocket = async () => {
  if (socket?.connected) return socket;
  if (connecting) return connecting;

  connecting = new Promise(async (resolve, reject) => {
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error("Missing auth token");
      }

      const url = process.env.NEXT_PUBLIC_BACKEND_URL;
      if (!url) {
        throw new Error("Missing backend url");
      }

      const nextSocket = io(url, {
        transports: ["websocket"],
        auth: { token },
      });

      socket = nextSocket;
      resolve(nextSocket);
    } catch (error) {
      socket = null;
      reject(error);
    } finally {
      connecting = null;
    }
  });

  return connecting;
};

export const closeSocket = () => {
  if (socket) {
    socket.disconnect();
  }
  socket = null;
};
