/**
 * NotificationSystem - Toast notification manager
 */

import { AlertCircle, AlertTriangle, CheckCircle, Info, X } from "lucide-react";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import styles from "./NotificationSystem.module.css";

export type NotificationType = "success" | "error" | "info" | "warning";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  duration?: number;
  timestamp: number;
}

interface NotificationContextValue {
  notifications: Notification[];
  addNotification: (
    type: NotificationType,
    title: string,
    message?: string,
    duration?: number
  ) => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }
  return context;
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback(
    (type: NotificationType, title: string, message?: string, duration = 5000) => {
      const notification: Notification = {
        id: `${Date.now()}-${Math.random()}`,
        type,
        title,
        ...(message !== undefined && { message }),
        duration,
        timestamp: Date.now(),
      };

      setNotifications((prev) => [...prev, notification]);

      if (duration > 0) {
        setTimeout(() => {
          removeNotification(notification.id);
        }, duration);
      }
    },
    []
  );

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  return (
    <NotificationContext.Provider
      value={{ notifications, addNotification, removeNotification, clearAll }}
    >
      {children}
      <NotificationContainer
        notifications={notifications}
        onRemove={removeNotification}
      />
    </NotificationContext.Provider>
  );
}

interface NotificationContainerProps {
  notifications: Notification[];
  onRemove: (id: string) => void;
}

function NotificationContainer({ notifications, onRemove }: NotificationContainerProps) {
  return (
    <div className={styles.container}>
      {notifications.map((notification) => (
        <NotificationItem key={notification.id} notification={notification} onRemove={onRemove} />
      ))}
    </div>
  );
}

interface NotificationItemProps {
  notification: Notification;
  onRemove: (id: string) => void;
}

function NotificationItem({ notification, onRemove }: NotificationItemProps) {
  const [isExiting, setIsExiting] = useState(false);

  const handleRemove = () => {
    setIsExiting(true);
    setTimeout(() => {
      onRemove(notification.id);
    }, 300);
  };

  useEffect(() => {
    // Auto-remove after duration
    if (notification.duration && notification.duration > 0) {
      const timer = setTimeout(() => {
        handleRemove();
      }, notification.duration);

      return () => clearTimeout(timer);
    }
  }, [notification.duration]);

  const colors = {
    success: {
      bg: "rgba(100, 200, 150, 0.15)",
      border: "rgba(100, 200, 150, 0.4)",
      text: "#64c896",
      icon: CheckCircle,
    },
    error: {
      bg: "rgba(255, 107, 107, 0.15)",
      border: "rgba(255, 107, 107, 0.4)",
      text: "#ff6b6b",
      icon: AlertCircle,
    },
    warning: {
      bg: "rgba(255, 165, 0, 0.15)",
      border: "rgba(255, 165, 0, 0.4)",
      text: "#ffa500",
      icon: AlertTriangle,
    },
    info: {
      bg: "rgba(100, 149, 237, 0.15)",
      border: "rgba(100, 149, 237, 0.4)",
      text: "#6495ed",
      icon: Info,
    },
  };

  const style = colors[notification.type];
  const Icon = style.icon;

  return (
    <div
      className={styles.notification}
      style={{
        background: style.bg,
        border: `1px solid ${style.border}`,
        boxShadow: `0 4px 12px rgba(0, 0, 0, 0.3), 0 0 20px ${style.border}`,
        animation: isExiting ? "slideOut 0.3s ease-out forwards" : "slideIn 0.3s ease-out forwards",
        transform: isExiting ? "translateX(120%)" : "translateX(0)",
        opacity: isExiting ? 0 : 1,
      }}
    >
      <div className={styles.contentWrapper}>
        <Icon size={20} style={{ color: style.text }} className={styles.icon} />

        <div className={styles.textContent}>
          <div
            className={styles.title}
            style={{
              color: style.text,
              marginBottom: notification.message ? 4 : 0,
            }}
          >
            {notification.title}
          </div>
          {notification.message && <div className={styles.message}>{notification.message}</div>}
        </div>

        <button
          onClick={handleRemove}
          className={styles.closeButton}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(230, 241, 255, 0.1)";
            e.currentTarget.style.color = "#e6f1ff";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "rgba(230, 241, 255, 0.6)";
          }}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
