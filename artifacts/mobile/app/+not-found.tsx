import { Link, Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import { TYPOGRAPHY } from "@/constants/typography";
import { usePreferences } from "@/context/PreferencesContext";

export default function NotFoundScreen() {
  const colors = useColors();
  const { t } = usePreferences();

  return (
    <>
      <Stack.Screen options={{ title: t("Oops!") }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>
          {t("This screen doesn't exist.")}
        </Text>

        <Link href="/" style={styles.link}>
          <Text style={[styles.linkText, { color: colors.primary }]}>
            {t("Go to home screen!")}
          </Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  title: {
    fontSize: TYPOGRAPHY.pageTitle,
    fontWeight: "bold",
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
  linkText: {
    fontSize: TYPOGRAPHY.body,
  },
});
