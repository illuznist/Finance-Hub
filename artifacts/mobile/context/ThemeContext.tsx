import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { useColorScheme } from "react-native";

export type ThemeMode = "system" | "light" | "dark";

const THEME_KEY = "@finance_theme_v1";

interface ThemeContextValue {
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
  resolvedScheme: "light" | "dark";
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: "system",
  setMode: () => {},
  resolvedScheme: "dark",
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme() ?? "dark";
  const [mode, setModeState] = useState<ThemeMode>("system");

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((v) => {
      if (v === "light" || v === "dark" || v === "system") setModeState(v);
    });
  }, []);

  const resolvedScheme: "light" | "dark" = mode === "system" ? system : mode;

  async function setMode(m: ThemeMode) {
    setModeState(m);
    await AsyncStorage.setItem(THEME_KEY, m);
  }

  return (
    <ThemeContext.Provider value={{ mode, setMode, resolvedScheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
