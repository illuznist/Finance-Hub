import React from "react";
import { Platform } from "react-native";
import {
  KeyboardController,
  KeyboardToolbar,
  useKeyboardState,
} from "react-native-keyboard-controller";

import { usePreferences } from "@/context/PreferencesContext";
import { useColors } from "@/hooks/useColors";

const NUMERIC_KEYBOARD_TYPES = new Set([
  "numeric",
  "number-pad",
  "decimal-pad",
  "numbers-and-punctuation",
  "phone-pad",
  "ascii-capable-number-pad",
]);

type Props = {
  enabled?: boolean;
};

export function NumericKeyboardToolbarDone({ enabled = true }: Props) {
  const colors = useColors();
  const { t } = usePreferences();
  if (Platform.OS !== "ios") return null;

  return (
    <IOSNumericKeyboardToolbar
      colors={colors}
      doneText={t("Done")}
      enabled={enabled}
    />
  );
}

function IOSNumericKeyboardToolbar({
  colors,
  doneText,
  enabled,
}: Props & { colors: ReturnType<typeof useColors>; doneText: string }) {
  const isNumericKeyboard = useKeyboardState(
    (state) => state.isVisible && NUMERIC_KEYBOARD_TYPES.has(state.type),
  );
  const theme = {
    light: {
      primary: colors.primary,
      disabled: colors.mutedForeground,
      background: colors.card,
      ripple: colors.muted,
    },
    dark: {
      primary: colors.primary,
      disabled: colors.mutedForeground,
      background: colors.card,
      ripple: colors.muted,
    },
  };

  return (
    <KeyboardToolbar theme={theme} enabled={enabled && isNumericKeyboard}>
      <KeyboardToolbar.Done
        text={doneText}
        onPress={(event) => {
          event.preventDefault();
          void KeyboardController.dismiss({ keepFocus: true });
        }}
      />
    </KeyboardToolbar>
  );
}
