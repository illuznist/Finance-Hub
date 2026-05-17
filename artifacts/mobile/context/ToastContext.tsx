import { Feather } from "@expo/vector-icons";
import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  translateY: Animated.Value;
  opacity: Animated.Value;
}

interface ToastContextValue {
  show: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ show: () => {} });

const CONFIG: Record<ToastType, { bg: string; icon: string }> = {
  success: { bg: "#10B981", icon: "check-circle" },
  error:   { bg: "#EF4444", icon: "x-circle" },
  info:    { bg: "#60A5FA", icon: "info" },
};

function ToastEntry({ item }: { item: ToastItem }) {
  const cfg = CONFIG[item.type];
  return (
    <Animated.View
      style={[
        styles.toast,
        {
          backgroundColor: cfg.bg,
          opacity: item.opacity,
          transform: [{ translateY: item.translateY }],
        },
      ]}
    >
      <Feather name={cfg.icon as any} size={16} color="#fff" />
      <Text style={styles.toastText} numberOfLines={2}>
        {item.message}
      </Text>
    </Animated.View>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const insets = useSafeAreaInsets();
  const idRef = useRef(0);

  const show = useCallback((message: string, type: ToastType = "success") => {
    const id = String(++idRef.current);
    const translateY = new Animated.Value(-20);
    const opacity = new Animated.Value(0);

    setToasts((prev) => [...prev, { id, message, type, translateY, opacity }]);

    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 18,
        stiffness: 200,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -20,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      });
    }, 2500);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      <View style={styles.root}>
        {children}
        <View
          style={[styles.overlay, { top: insets.top + 8 }]}
          pointerEvents="none"
        >
          {toasts.map((t) => (
            <ToastEntry key={t.id} item={t} />
          ))}
        </View>
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  overlay: {
    position: "absolute",
    left: 16,
    right: 16,
    gap: 8,
    zIndex: 9999,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  toastText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: "#fff",
    flex: 1,
    lineHeight: 20,
  },
});
