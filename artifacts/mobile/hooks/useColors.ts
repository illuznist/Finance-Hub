import colors from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";

/**
 * Returns the design tokens for the current color scheme.
 * Reads from ThemeContext (user preference: system/light/dark).
 */
export function useColors() {
  const { resolvedScheme } = useTheme();
  const palette = resolvedScheme === "dark" ? colors.dark : colors.light;
  return { ...palette, radius: colors.radius };
}
