import { io, Socket } from "socket.io-client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ENV } from "../config/env";

export const socketUrl = ENV.API_BASE_URL;
let socket: Socket | null = null;

export const initSocket = async () => {
  const token = await AsyncStorage.getItem("travia_token");
  if (!token) return null;

  if (socket) {
    socket.disconnect();
  }

  socket = io(socketUrl, {
    auth: { token },
    transports: ["websocket"],
  });

  socket.on("connect", () => {
    console.log("Socket connected:", socket?.id);
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected");
  });

  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
