import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { TYPOGRAPHY } from "@/constants/typography";
import { usePreferences } from "@/context/PreferencesContext";

const BG_TOP = "#0B1529";
const BG_BOTTOM = "#070A12";
const ACCENT = "#60A5FA";
const TEXT = "#F0F6FF";
const MUTED = "#94A3B8";
const CARD = "#0D1420";
const BORDER = "#1A2A45";
const ERROR = "#F87171";
const SUCCESS = "#34D399";

function Field({
  icon,
  placeholder,
  value,
  onChangeText,
  secure,
  showToggle,
  onToggle,
  keyboardType,
  autoCapitalize,
  autoComplete,
}: {
  icon: string;
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  secure?: boolean;
  showToggle?: boolean;
  onToggle?: () => void;
  keyboardType?: "default" | "email-address";
  autoCapitalize?: "none" | "words";
  autoComplete?: string;
}) {
  const { t } = usePreferences();
  return (
    <View style={fieldStyles.wrap}>
      <Feather name={icon as any} size={17} color={MUTED} style={fieldStyles.icon} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={t(placeholder)}
        placeholderTextColor={MUTED}
        secureTextEntry={secure}
        keyboardType={keyboardType ?? "default"}
        autoCapitalize={autoCapitalize ?? "none"}
        autoCorrect={false}
        style={fieldStyles.input}
      />
      {showToggle && onToggle && (
        <Pressable onPress={onToggle} style={fieldStyles.toggle}>
          <Feather name={secure ? "eye" : "eye-off"} size={17} color={MUTED} />
        </Pressable>
      )}
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111E35",
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 54,
    marginBottom: 12,
  },
  icon: { marginEnd: 10 },
  input: {
    flex: 1,
    color: TEXT,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
  },
  toggle: { padding: 4 },
});

interface Props {
  onComplete: () => void;
}

export default function AuthScreen({ onComplete }: Props) {
  const insets = useSafeAreaInsets();
  const auth = useAuth();
  const { t, isRTL } = usePreferences();

  const [mode, setMode] = useState<"login" | "signup">(auth.hasAccount ? "login" : "signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: false }).start();
  }, []);

  function shake() {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 55, useNativeDriver: false }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 55, useNativeDriver: false }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 55, useNativeDriver: false }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 55, useNativeDriver: false }),
    ]).start();
  }

  function setErr(msg: string) {
    setError(t(msg));
    shake();
  }

  async function handleBiometric() {
    setLoading(true);
    const ok = await auth.signInWithBiometric();
    setLoading(false);
    if (ok) {
      onComplete();
    } else {
      setErr("Biometric authentication failed. Use your password instead.");
    }
  }

  async function handleSubmit() {
    setError("");
    if (mode === "signup") {
      if (!name.trim()) return setErr("Please enter your name.");
      if (!email.trim() || !email.includes("@")) return setErr("Please enter a valid email.");
      if (password.length < 6) return setErr("Password must be at least 6 characters.");
      if (password !== confirmPassword) return setErr("Passwords do not match.");
      setLoading(true);
      try {
        await auth.signUp(name.trim(), email.trim(), password);
        onComplete();
      } catch {
        setErr("Failed to create account. Please try again.");
      } finally {
        setLoading(false);
      }
    } else {
      if (!email.trim()) return setErr("Please enter your email.");
      if (!password) return setErr("Please enter your password.");
      setLoading(true);
      const ok = await auth.signIn(email.trim(), password);
      setLoading(false);
      if (ok) {
        onComplete();
      } else {
        setErr("Incorrect email or password.");
      }
    }
  }

  const biometricLabel = auth.biometricType === "face" ? "Face ID" : "Fingerprint";
  const biometricIcon = auth.biometricType === "face" ? "smile" : "aperture";

  return (
    <LinearGradient colors={[BG_TOP, BG_BOTTOM]} style={styles.root}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={{ opacity: fadeAnim }}>
            {/* Logo */}
            <View style={styles.logoRow}>
              <Image
                source={require("../assets/images/icon.png")}
                accessibilityLabel="FinanceApp logo"
                resizeMode="cover"
                style={styles.logoIcon}
              />
              <Text style={styles.logoText}>FinanceApp</Text>
            </View>

            {/* Headline */}
            <Text style={styles.headline}>
              {t(mode === "login" ? "Welcome back" : "Create account")}
            </Text>
            <Text style={styles.sub}>
              {mode === "login"
                ? t("Sign in to access your financial data")
                : t("Your records stay on this device")}
            </Text>

            {/* Mode toggle */}
            <View style={styles.modeToggle}>
              <Pressable
                onPress={() => { setMode("login"); setError(""); }}
                style={[styles.modeTab, mode === "login" && styles.modeTabActive]}
              >
                <Text style={[styles.modeTabText, mode === "login" && styles.modeTabTextActive]}>
                  {t("Sign In")}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => { setMode("signup"); setError(""); }}
                style={[styles.modeTab, mode === "signup" && styles.modeTabActive]}
              >
                <Text style={[styles.modeTabText, mode === "signup" && styles.modeTabTextActive]}>
                  {t("Create Account")}
                </Text>
              </Pressable>
            </View>

            {/* Form */}
            <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
              {mode === "signup" && (
                <Field
                  icon="user"
                  placeholder="Full name"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              )}
              <Field
                icon="mail"
                placeholder="Email address"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
              />
              <Field
                icon="lock"
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secure={showPassword ? false : true}
                showToggle
                onToggle={() => setShowPassword(!showPassword)}
              />
              {mode === "signup" && (
                <Field
                  icon="lock"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secure={showConfirm ? false : true}
                  showToggle
                  onToggle={() => setShowConfirm(!showConfirm)}
                />
              )}

              {error !== "" && (
                <View style={styles.errorRow}>
                  <Feather name="alert-circle" size={15} color={ERROR} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}
            </Animated.View>

            {/* Primary CTA */}
            <Pressable onPress={handleSubmit} disabled={loading} style={styles.primaryBtn}>
              <LinearGradient
                colors={["#3B82F6", "#2563EB"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.primaryBtnInner}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                      <Text style={styles.primaryBtnText}>
                       {t(mode === "login" ? "Sign In" : "Create Account")}
                    </Text>
                    <Feather name={isRTL ? "arrow-left" : "arrow-right"} size={18} color="#fff" />
                  </>
                )}
              </LinearGradient>
            </Pressable>

            {/* Biometric sign-in */}
            {mode === "login" && auth.biometricAvailable && auth.biometricEnabled && Platform.OS !== "web" && (
              <Pressable onPress={handleBiometric} disabled={loading} style={styles.bioBtn}>
                <View style={styles.bioBtnInner}>
                  <Feather name={biometricIcon as any} size={20} color={SUCCESS} />
                  <Text style={styles.bioBtnText}>{t("Sign in with")} {t(biometricLabel)}</Text>
                </View>
              </Pressable>
            )}

            {/* Security note */}
            <View style={styles.securityNote}>
              <Feather name="shield" size={13} color={MUTED} />
              <Text style={styles.securityText}>
                {mode === "signup"
                  ? t("No cloud sync. Backups export only when you choose.")
                  : t("Sign in to access the finance records stored on this device.")}
              </Text>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 28, flexGrow: 1, justifyContent: "center" },

  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 36,
  },
  logoIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    overflow: "hidden",
  },
  logoText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 20,
    color: TEXT,
  },

  headline: {
    fontFamily: "Inter_700Bold",
    fontSize: TYPOGRAPHY.pageTitle,
    color: TEXT,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  sub: {
    fontFamily: "Inter_400Regular",
    fontSize: TYPOGRAPHY.body,
    color: MUTED,
    lineHeight: 22,
    marginBottom: 28,
  },

  modeToggle: {
    flexDirection: "row",
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 4,
    marginBottom: 24,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  modeTabActive: { backgroundColor: ACCENT + "25" },
  modeTabText: {
    fontFamily: "Inter_500Medium",
    fontSize: TYPOGRAPHY.body,
    color: MUTED,
  },
  modeTabTextActive: { color: ACCENT },

  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
    backgroundColor: ERROR + "15",
    borderRadius: 10,
    padding: 12,
  },
  errorText: {
    fontFamily: "Inter_400Regular",
    fontSize: TYPOGRAPHY.bodySmall,
    color: ERROR,
    flex: 1,
  },

  primaryBtn: {
    borderRadius: 16,
    overflow: "hidden",
    marginTop: 4,
    marginBottom: 12,
  },
  primaryBtnInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
  },
  primaryBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: TYPOGRAPHY.body,
    color: "#fff",
  },

  bioBtn: { marginBottom: 12 },
  bioBtnInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: SUCCESS + "14",
  },
  bioBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: TYPOGRAPHY.body,
    color: SUCCESS,
  },

  securityNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    justifyContent: "center",
  },
  securityText: {
    fontFamily: "Inter_400Regular",
    fontSize: TYPOGRAPHY.supporting,
    lineHeight: 18,
    color: MUTED,
    flex: 1,
    textAlign: "center",
  },
});
