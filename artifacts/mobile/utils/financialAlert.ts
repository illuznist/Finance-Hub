import { Alert as NativeAlert, Platform } from "react-native";

/** Native Alert is a no-op on React Native Web; financial confirmations must still run. */
export const financialAlert: Pick<typeof NativeAlert, "alert"> = {
  alert(title, message, buttons, options) {
    if (Platform.OS !== "web") return NativeAlert.alert(title, message, buttons, options);
    if (typeof window === "undefined") throw new Error("Confirmation requires an interactive browser.");
    const actions = buttons?.filter(b => b.style !== "cancel") ?? [];
    const text = [title, message].filter(Boolean).join("\n\n");
    if (actions.length > 1) throw new Error("This confirmation requires a single explicit action.");
    if (!buttons || buttons.length < 2) {
      window.alert(text);
      actions[0]?.onPress?.();
    } else if (window.confirm(text)) actions[0]?.onPress?.();
    else buttons.find(b => b.style === "cancel")?.onPress?.();
  },
};
