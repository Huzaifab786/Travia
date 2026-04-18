import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AuthContext } from "./AuthProvider";
import { getSocket } from "../../services/socket";

export type AppNotification = {
  id: string;
  userId?: string | null;
  title: string;
  body: string;
  type: string;
  data?: Record<string, any>;
  read: boolean;
  createdAt: string;
};

type NotificationContextType = {
  notifications: AppNotification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
};

const NotificationContext = createContext<NotificationContextType>({
  notifications: [],
  unreadCount: 0,
  markAsRead: () => {},
  markAllAsRead: () => {},
  clearNotifications: () => {},
});

function storageKey(userId: string) {
  return `travia_notifications_${userId}`;
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { token, userId } = useContext(AuthContext);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const persistNotifications = useCallback(
    async (nextNotifications: AppNotification[]) => {
      if (!userId) return;
      await AsyncStorage.setItem(storageKey(userId), JSON.stringify(nextNotifications));
    },
    [userId],
  );

  useEffect(() => {
    let active = true;

    const loadStoredNotifications = async () => {
      if (!userId) {
        setNotifications([]);
        return;
      }

      try {
        const stored = await AsyncStorage.getItem(storageKey(userId));
        if (!active) return;

        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setNotifications(parsed);
            return;
          }
        }
        setNotifications([]);
      } catch {
        if (active) {
          setNotifications([]);
        }
      }
    };

    loadStoredNotifications();

    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!token || !userId) return;

    let cancelled = false;
    let cleanupSocket: (() => void) | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const attach = () => {
      if (cancelled) return;

      const socket = getSocket();
      if (!socket) {
        retryTimer = setTimeout(attach, 400);
        return;
      }

      const handleNotification = (notification: AppNotification) => {
        setNotifications((prev) => {
          const deduped = prev.filter((item) => item.id !== notification.id);
          const next = [notification, ...deduped].slice(0, 100);
          persistNotifications(next).catch(() => {});
          return next;
        });
      };

      socket.on("notification", handleNotification);
      cleanupSocket = () => socket.off("notification", handleNotification);
    };

    attach();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (cleanupSocket) cleanupSocket();
    };
  }, [persistNotifications, token, userId]);

  const markAsRead = useCallback(
    (id: string) => {
      setNotifications((prev) => {
        const next = prev.map((notification) =>
          notification.id === id ? { ...notification, read: true } : notification,
        );
        persistNotifications(next).catch(() => {});
        return next;
      });
    },
    [persistNotifications],
  );

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => {
      const next = prev.map((notification) => ({ ...notification, read: true }));
      persistNotifications(next).catch(() => {});
      return next;
    });
  }, [persistNotifications]);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
    if (userId) {
      AsyncStorage.removeItem(storageKey(userId)).catch(() => {});
    }
  }, [userId]);

  const value = useMemo(
    () => ({
      notifications,
      unreadCount: notifications.filter((notification) => !notification.read).length,
      markAsRead,
      markAllAsRead,
      clearNotifications,
    }),
    [clearNotifications, markAllAsRead, markAsRead, notifications],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
