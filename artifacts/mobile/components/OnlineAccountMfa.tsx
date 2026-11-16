import { Feather } from "@expo/vector-icons";
import { useGetAccountAccess } from "@workspace/api-client-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SvgXml } from "react-native-svg";

import { TYPOGRAPHY } from "@/constants/typography";
import { useOnlineAccount } from "@/context/OnlineAccountContext";
import { usePreferences } from "@/context/PreferencesContext";
import { useColors } from "@/hooks/useColors";
import { supabaseClient } from "@/lib/supabase";
import {
  classifyTotpAssurance,
  isVerifiedTotpFactor,
  normalizeTotpCode,
} from "@/security/totpPolicy";

type MfaFactor = {
  id: string;
  factor_type: string;
  status: string;
  friendly_name?: string;
};

type GateState = "checking" | "ready" | "choose-factor" | "challenge" | "challenge-required" | "stale" | "unsupported" | "error";
type LoginChallenge = { factorId: string; challengeId: string };
type SetupDraft = { factorId: string; challengeId: string; secret: string; qrCode: string };

const MFA_REQUEST_FAILED = Symbol("mfa-request-failed");

export function OnlineAccountSecuritySection({ deferChallenge = false }: { deferChallenge?: boolean }) {
  const colors = useColors();
  const { t, isRTL } = usePreferences();
  const online = useOnlineAccount();
  const userId = online.user?.id;
  const [gate, setGate] = useState<GateState>("checking");
  const [factors, setFactors] = useState<MfaFactor[]>([]);
  const [loginChallenge, setLoginChallenge] = useState<LoginChallenge | null>(null);
  const [deferredFactorId, setDeferredFactorId] = useState<string | null>(null);
  const [factorListUnavailable, setFactorListUnavailable] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const assessmentId = useRef(0);

  const access = useGetAccountAccess({
    query: {
      enabled: Boolean(userId) && gate === "ready",
      queryKey: ["/api/account/access", userId ?? "signed-out"],
      retry: false,
      staleTime: 60_000,
    },
  });

  const assessMfa = useCallback(async () => {
    const requestId = ++assessmentId.current;
    setGate("checking");
    setLoginChallenge(null);
    setDeferredFactorId(null);
    setCode("");
    setErrorKey(null);
    setFactorListUnavailable(false);

    const client = supabaseClient;
    if (!client || !userId) {
      setGate("error");
      setErrorKey("Could not check MFA. Check your connection and Supabase MFA settings, then retry.");
      return;
    }

    try {
      const assuranceResult = await client.auth.mfa.getAuthenticatorAssuranceLevel();
      if (requestId !== assessmentId.current) return;
      if (assuranceResult.error || !assuranceResult.data) throw MFA_REQUEST_FAILED;

      const decision = classifyTotpAssurance(
        assuranceResult.data.currentLevel,
        assuranceResult.data.nextLevel,
      );
      if (decision === "ready") {
        const factorResult = await client.auth.mfa.listFactors();
        if (requestId !== assessmentId.current) return;
        if (factorResult.error || !factorResult.data) {
          setFactors([]);
          setFactorListUnavailable(true);
        } else {
          setFactors(factorResult.data.all as MfaFactor[]);
        }
        setGate("ready");
        return;
      }
      if (decision === "stale") {
        setGate("stale");
        return;
      }
      if (decision === "unsupported") {
        setGate("unsupported");
        return;
      }

      const factorResult = await client.auth.mfa.listFactors();
      if (requestId !== assessmentId.current) return;
      if (factorResult.error || !factorResult.data) throw MFA_REQUEST_FAILED;
      const availableFactors = factorResult.data.all as MfaFactor[];
      setFactors(availableFactors);

      const verifiedTotpFactors = availableFactors.filter(isVerifiedTotpFactor);
      if (verifiedTotpFactors.length === 0) {
        setGate("unsupported");
        return;
      }
      if (verifiedTotpFactors.length > 1) {
        setGate("choose-factor");
        return;
      }

      if (deferChallenge) {
        setDeferredFactorId(verifiedTotpFactors[0].id);
        setGate("challenge-required");
        return;
      }

      const { data: challenge, error: challengeError } = await client.auth.mfa.challenge({
        factorId: verifiedTotpFactors[0].id,
      });
      if (requestId !== assessmentId.current) return;
      if (challengeError || !challenge) throw MFA_REQUEST_FAILED;
      setLoginChallenge({ factorId: verifiedTotpFactors[0].id, challengeId: challenge.id });
      setGate("challenge");
    } catch {
      if (requestId !== assessmentId.current) return;
      setGate("error");
      setErrorKey("Could not check MFA. Check your connection and Supabase MFA settings, then retry.");
    }
  }, [deferChallenge, userId]);

  useEffect(() => {
    void assessMfa();
    return () => {
      assessmentId.current += 1;
    };
  }, [assessMfa]);

  async function startLoginChallenge(factorId: string) {
    const requestId = ++assessmentId.current;
    const client = supabaseClient;
    setBusy(true);
    setGate("checking");
    setErrorKey(null);
    setCode("");
    try {
      if (!client) throw MFA_REQUEST_FAILED;
      const { data: challenge, error: challengeError } = await client.auth.mfa.challenge({ factorId });
      if (requestId !== assessmentId.current) return;
      if (challengeError || !challenge) throw MFA_REQUEST_FAILED;
      setLoginChallenge({ factorId, challengeId: challenge.id });
      setGate("challenge");
    } catch {
      if (requestId === assessmentId.current) {
        setGate("error");
        setErrorKey("Could not check MFA. Check your connection and Supabase MFA settings, then retry.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function verifyLoginCode() {
    const currentCode = normalizeTotpCode(code);
    if (!loginChallenge || currentCode.length !== 6) {
      setErrorKey("Enter the 6-digit code from your authenticator app.");
      return;
    }

    const client = supabaseClient;
    if (!client) {
      setGate("error");
      setErrorKey("Could not check MFA. Check your connection and Supabase MFA settings, then retry.");
      return;
    }

    setBusy(true);
    setErrorKey(null);
    try {
      await verifyFactorCode(loginChallenge.factorId, loginChallenge.challengeId, currentCode);
      setLoginChallenge(null);
      setCode("");
      await assessMfa();
    } catch {
      setCode("");
      setErrorKey("The code could not be verified. Check it and try again.");
    } finally {
      setBusy(false);
    }
  }

  const inputStyle = [
    styles.input,
    { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground },
  ];

  return (
    <View style={styles.container}>
      {gate === "checking" ? (
        <GateMessage
          icon="shield"
          title={t("Checking authenticator status…")}
          body={t("Your online account is protected by MFA.")}
          colors={colors}
          loading
        />
      ) : gate === "challenge-required" ? (
        <View style={[styles.gateCard, { backgroundColor: colors.input, borderColor: colors.border }]}>
          <GateHeading title={t("Two-step verification required")} colors={colors} />
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            {t("Your session needs verification before authenticator management.")}
          </Text>
          <MfaButton
            testID="online-mfa-start-deferred-challenge"
            label={t("Start two-step verification")}
            onPress={() => {
              if (deferredFactorId) void startLoginChallenge(deferredFactorId);
            }}
            disabled={busy || !deferredFactorId}
            variant="primary"
          />
        </View>
      ) : gate === "challenge" ? (
        <View style={[styles.gateCard, { backgroundColor: colors.input, borderColor: colors.border }]}>
          <GateHeading title={t("Two-step verification")} colors={colors} />
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            {t("Enter the 6-digit code from your authenticator app.")}
          </Text>
          <TextInput
            accessibilityLabel={t("Authenticator code")}
            testID="online-mfa-sign-in-code"
            value={code}
            onChangeText={(value) => setCode(normalizeTotpCode(value))}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="••••••"
            placeholderTextColor={colors.mutedForeground}
            style={[...inputStyle, styles.codeInput]}
          />
          {errorKey ? <Text accessibilityRole="alert" style={[styles.message, { color: colors.destructive }]}>{t(errorKey)}</Text> : null}
          <MfaButton
            testID="online-mfa-sign-in-verify"
            label={t(busy ? "Please wait…" : "Verify code")}
            onPress={() => void verifyLoginCode()}
            disabled={busy}
            loading={busy}
            variant="primary"
          />
          {loginChallenge ? (
            <MfaButton
              label={t("Request a new code")}
              onPress={() => void startLoginChallenge(loginChallenge.factorId)}
              disabled={busy}
            />
          ) : null}
        </View>
      ) : gate === "choose-factor" ? (
        <View style={[styles.gateCard, { backgroundColor: colors.input, borderColor: colors.border }]}>
          <GateHeading title={t("Choose an authenticator")} colors={colors} />
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            {t("Use a verified authenticator to finish signing in.")}
          </Text>
          {factors.filter(isVerifiedTotpFactor).map((factor) => (
            <MfaButton
              key={factor.id}
              testID="online-mfa-select-factor"
              label={factorLabel(factor, t)}
              onPress={() => void startLoginChallenge(factor.id)}
              disabled={busy}
            />
          ))}
        </View>
      ) : gate === "stale" ? (
        <GateMessage
          icon="refresh-cw"
          title={t("Authenticator session needs refresh")}
          body={t("Your MFA setup changed. Sign out and sign in again to refresh your session.")}
          colors={colors}
        />
      ) : gate === "unsupported" ? (
        <GateMessage
          icon="lock"
          title={t("Additional verification required")}
          body={t("This app currently supports TOTP authenticator apps only. No MFA bypass is available.")}
          colors={colors}
        />
      ) : gate === "error" ? (
        <View style={[styles.gateCard, { backgroundColor: colors.input, borderColor: colors.border }]}>
          <GateHeading title={t("Authenticator check unavailable")} colors={colors} />
          {errorKey ? <Text accessibilityRole="alert" style={[styles.body, { color: colors.mutedForeground }]}>{t(errorKey)}</Text> : null}
          <MfaButton label={t("Try again")} onPress={() => void assessMfa()} disabled={busy} variant="primary" />
        </View>
      ) : (
        <>
          <View style={[styles.statusBlock, { borderBottomColor: colors.border }]}>
            <GateHeading title={t("Online access")} colors={colors} />
            <StatusRow label={t("Online account")} value={online.user?.email ?? ""} colors={colors} isRTL={isRTL} />
            <StatusRow
              label={t("Email verification")}
              value={t(online.isVerified ? "Verified" : "Not verified")}
              colors={colors}
              isRTL={isRTL}
            />
            <StatusRow
              label={t("Current online plan")}
              value={
                access.data?.proSource === "super_admin"
                  ? t("Super Admin Pro")
                  : access.data?.proSource === "promotional"
                    ? t("Promotional Pro")
                    : access.data?.proSource === "free"
                      ? t("Free plan")
                      : t("Unavailable")
              }
              colors={colors}
              isRTL={isRTL}
            />
            {!access.data ? (
              <Text style={[styles.body, { color: colors.mutedForeground }]}>
                {access.isLoading ? t("Checking online access…") : t("Online access status is unavailable.")}
              </Text>
            ) : null}
          </View>
          <TotpFactorManagement factors={factors} factorListUnavailable={factorListUnavailable} onRefresh={assessMfa} />
        </>
      )}
    </View>
  );
}

function TotpFactorManagement({
  factors,
  factorListUnavailable,
  onRefresh,
}: {
  factors: MfaFactor[];
  factorListUnavailable: boolean;
  onRefresh: () => Promise<void>;
}) {
  const colors = useColors();
  const { t, isRTL } = usePreferences();
  const [operation, setOperation] = useState<FactorOperation>(null);
  const [code, setCode] = useState("");
  const [showSetupKey, setShowSetupKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const verifiedTotpFactors = factors.filter(isVerifiedTotpFactor);
  const totpFactors = factors.filter((factor) => factor.factor_type === "totp");
  const otherFactors = factors.filter((factor) => factor.factor_type !== "totp");
  const hasIncompleteSetup = totpFactors.some((factor) => factor.status === "unverified");

  async function createEnrollment() {
    const client = supabaseClient;
    if (!client) throw MFA_REQUEST_FAILED;
    const { data, error } = await client.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Authenticator app",
      issuer: "Finance Hub",
    });
    if (error || !data || data.type !== "totp") throw MFA_REQUEST_FAILED;

    const { data: challenge, error: challengeError } = await client.auth.mfa.challenge({ factorId: data.id });
    if (challengeError || !challenge) {
      setErrorKey("Authenticator setup could not be started. Remove the incomplete setup before trying again.");
      await onRefresh();
      return;
    }
    setErrorKey(null);
    setShowSetupKey(false);
    setCode("");
    setOperation({
      kind: "verify-enrollment",
      draft: {
        factorId: data.id,
        challengeId: challenge.id,
        secret: data.totp.secret,
        qrCode: data.totp.qr_code,
      },
    });
  }

  async function beginAddAuthenticator() {
    if (hasIncompleteSetup) {
      setErrorKey("Remove the incomplete setup before starting another enrollment.");
      return;
    }
    setBusy(true);
    setErrorKey(null);
    try {
      if (verifiedTotpFactors.length === 0) {
        await createEnrollment();
      } else if (verifiedTotpFactors.length === 1) {
        await startAddChallenge(verifiedTotpFactors[0].id);
      } else {
        setOperation({ kind: "choose-add-factor" });
      }
    } catch {
      setErrorKey("MFA management could not be completed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function startAddChallenge(factorId: string) {
    const client = supabaseClient;
    if (!client) throw MFA_REQUEST_FAILED;
    const { data, error } = await client.auth.mfa.challenge({ factorId });
    if (error || !data) throw MFA_REQUEST_FAILED;
    setCode("");
    setErrorKey(null);
    setOperation({ kind: "reauth-enrollment", factorId, challengeId: data.id });
  }

  async function startRemoveChallenge(target: MfaFactor) {
    const client = supabaseClient;
    if (!client) {
      setErrorKey("MFA management could not be completed. Try again.");
      return;
    }
    setBusy(true);
    setErrorKey(null);
    try {
      const { data, error } = await client.auth.mfa.challenge({ factorId: target.id });
      if (error || !data) throw MFA_REQUEST_FAILED;
      setCode("");
      setOperation({
        kind: "reauth-removal",
        factorId: target.id,
        challengeId: data.id,
        target,
      });
    } catch {
      setErrorKey("MFA management could not be completed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function requestNewManagerChallenge() {
    const current = operation;
    if (!current || current.kind === "choose-add-factor" || current.kind === "confirm-removal" || current.kind === "confirm-discard") {
      return;
    }
    const factorId = current.kind === "verify-enrollment" ? current.draft.factorId : current.factorId;
    const client = supabaseClient;
    if (!client) {
      setErrorKey("MFA management could not be completed. Try again.");
      return;
    }

    setBusy(true);
    setErrorKey(null);
    setCode("");
    try {
      const { data, error } = await client.auth.mfa.challenge({ factorId });
      if (error || !data) throw MFA_REQUEST_FAILED;
      setOperation((previous) => {
        if (!previous || previous.kind === "choose-add-factor" || previous.kind === "confirm-removal" || previous.kind === "confirm-discard") {
          return previous;
        }
        if (previous.kind === "verify-enrollment") {
          return { ...previous, draft: { ...previous.draft, challengeId: data.id } };
        }
        return { ...previous, challengeId: data.id };
      });
    } catch {
      setErrorKey("MFA management could not be completed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyPendingCode() {
    const current = operation;
    const normalizedCode = normalizeTotpCode(code);
    if (!current || current.kind === "choose-add-factor" || current.kind === "confirm-removal" || current.kind === "confirm-discard") {
      return;
    }
    if (normalizedCode.length !== 6) {
      setErrorKey("Enter the 6-digit code from your authenticator app.");
      return;
    }

    const client = supabaseClient;
    if (!client) {
      setErrorKey("MFA management could not be completed. Try again.");
      return;
    }

    setBusy(true);
    setErrorKey(null);
    try {
      const factorId = current.kind === "verify-enrollment" ? current.draft.factorId : current.factorId;
      const challengeId = current.kind === "verify-enrollment" ? current.draft.challengeId : current.challengeId;
      await verifyFactorCode(factorId, challengeId, normalizedCode);
      setCode("");

      if (current.kind === "verify-enrollment") {
        setOperation(null);
        setShowSetupKey(false);
        await onRefresh();
      } else if (current.kind === "reauth-enrollment") {
        setOperation(null);
        await createEnrollment();
      } else {
        setOperation({ kind: "confirm-removal", target: current.target });
      }
    } catch {
      setCode("");
      setErrorKey("The code could not be verified. Check it and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function removeFactor(target: MfaFactor, incomplete: boolean) {
    const client = supabaseClient;
    if (!client) {
      setErrorKey("MFA management could not be completed. Try again.");
      return;
    }
    setBusy(true);
    setErrorKey(null);
    try {
      const { error } = await client.auth.mfa.unenroll({ factorId: target.id });
      if (error) throw MFA_REQUEST_FAILED;
      setOperation(null);
      setCode("");
      setShowSetupKey(false);
      if (!incomplete) {
        await client.auth.refreshSession();
      }
      await onRefresh();
    } catch {
      setErrorKey("MFA management could not be completed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const inputStyle = [
    styles.input,
    { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground },
  ];

  return (
    <View style={[styles.mfaSection, { borderTopColor: colors.border }]}>
      <View style={[styles.sectionTitleRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <Feather name="shield" size={16} color={colors.primary} />
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t("Two-step verification")}</Text>
      </View>
      <Text style={[styles.body, { color: colors.mutedForeground }]}>
        {t("Protect your online account with an authenticator app. Your local PIN and financial records stay separate.")}
      </Text>

      {factorListUnavailable ? (
        <View style={[styles.operationCard, { backgroundColor: colors.input, borderColor: colors.border }]}>
          <Text style={[styles.body, { color: colors.destructive }]}>
            {t("Could not list authenticators. Check your Supabase MFA settings and retry.")}
          </Text>
          <MfaButton label={t("Try again")} onPress={() => void onRefresh()} disabled={busy} />
        </View>
      ) : null}

      {!factorListUnavailable && totpFactors.length === 0 && otherFactors.length === 0 ? (
        <Text style={[styles.body, { color: colors.mutedForeground }]}>{t("No authenticator app is enrolled.")}</Text>
      ) : null}

      {!factorListUnavailable ? totpFactors.map((factor) => (
        <View
          key={factor.id}
          style={[
            styles.factorRow,
            {
              borderColor: colors.border,
              flexDirection: isRTL ? "row-reverse" : "row",
            },
          ]}
        >
          <Feather
            name={factor.status === "verified" ? "shield" : "clock"}
            size={17}
            color={factor.status === "verified" ? colors.success : colors.mutedForeground}
          />
          <View style={styles.factorCopy}>
            <Text numberOfLines={1} style={[styles.factorName, { color: colors.foreground }]}>{factorLabel(factor, t)}</Text>
            <Text style={[styles.bodySmall, { color: colors.mutedForeground }]}>
              {t(factor.status === "verified" ? "Verified authenticator" : "Setup incomplete")}
            </Text>
          </View>
          {factor.status === "verified" ? (
            <MfaButton
              testID="totp-remove-factor"
              label={t("Remove")}
              onPress={() => void startRemoveChallenge(factor)}
              disabled={busy || Boolean(operation)}
              variant="destructive"
            />
          ) : (
            <MfaButton
              testID="totp-discard-incomplete"
              label={t("Remove")}
              onPress={() => setOperation({ kind: "confirm-discard", target: factor })}
              disabled={busy || Boolean(operation)}
              variant="destructive"
            />
          )}
        </View>
      )) : null}

      {!factorListUnavailable && otherFactors.length > 0 ? (
        <View style={styles.otherFactors}>
          {otherFactors.map((factor) => (
            <View
              key={factor.id}
              style={[
                styles.factorRow,
                { borderColor: colors.border, flexDirection: isRTL ? "row-reverse" : "row" },
              ]}
            >
              <Feather name="lock" size={16} color={colors.mutedForeground} />
              <View style={styles.factorCopy}>
                <Text numberOfLines={1} style={[styles.factorName, { color: colors.foreground }]}>{factorTypeLabel(factor, t)}</Text>
                <Text style={[styles.bodySmall, { color: colors.mutedForeground }]}>
                  {t(factor.status === "verified" ? "Verified authenticator" : "Setup incomplete")}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {errorKey ? <Text accessibilityRole="alert" style={[styles.message, { color: colors.destructive }]}>{t(errorKey)}</Text> : null}

      {operation?.kind === "verify-enrollment" ? (
        <View style={[styles.operationCard, { backgroundColor: colors.input, borderColor: colors.border }]}>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            {t("Scan this QR code in your authenticator app, or enter the setup key manually.")}
          </Text>
          <View style={styles.qrFrame} accessibilityRole="image" accessibilityLabel={t("Authenticator setup QR code")}>
            <SvgXml xml={operation.draft.qrCode} width={216} height={216} />
          </View>
          <Text style={[styles.factorName, { color: colors.foreground }]}>{t("Manual setup key")}</Text>
          <Text selectable={showSetupKey} style={[styles.setupKey, { color: colors.foreground }]}>
            {showSetupKey ? operation.draft.secret : "••••••••••••"}
          </Text>
          <MfaButton
            testID="totp-toggle-setup-key"
            label={t(showSetupKey ? "Hide setup key" : "Show setup key")}
            onPress={() => setShowSetupKey((visible) => !visible)}
            disabled={busy}
          />
          <TextInput
            accessibilityLabel={t("Authenticator code")}
            testID="totp-enrollment-code"
            value={code}
            onChangeText={(value) => setCode(normalizeTotpCode(value))}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="••••••"
            placeholderTextColor={colors.mutedForeground}
            style={[...inputStyle, styles.codeInput]}
          />
          <MfaButton
            testID="totp-verify-enrollment"
            label={t(busy ? "Please wait…" : "Verify and enable")}
            onPress={() => void verifyPendingCode()}
            disabled={busy}
            loading={busy}
            variant="primary"
          />
          <MfaButton
            label={t("Request a new code")}
            onPress={() => void requestNewManagerChallenge()}
            disabled={busy}
          />
          <MfaButton
            label={t("Cancel setup")}
            onPress={() => {
              setOperation(null);
              setCode("");
              setShowSetupKey(false);
              void onRefresh();
            }}
            disabled={busy}
          />
        </View>
      ) : null}

      {operation?.kind === "reauth-enrollment" || operation?.kind === "reauth-removal" ? (
        <View style={[styles.operationCard, { backgroundColor: colors.input, borderColor: colors.border }]}>
          <Text style={[styles.factorName, { color: colors.foreground }]}>
            {t(operation.kind === "reauth-enrollment" ? "Verify before adding an authenticator" : "Verify before removing this authenticator")}
          </Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            {t("Enter the 6-digit code from your authenticator app.")}
          </Text>
          <TextInput
            accessibilityLabel={t("Authenticator code")}
            testID="totp-management-code"
            value={code}
            onChangeText={(value) => setCode(normalizeTotpCode(value))}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="••••••"
            placeholderTextColor={colors.mutedForeground}
            style={[...inputStyle, styles.codeInput]}
          />
          <MfaButton
            testID="totp-management-verify"
            label={t(busy ? "Please wait…" : "Verify code")}
            onPress={() => void verifyPendingCode()}
            disabled={busy}
            loading={busy}
            variant="primary"
          />
          <MfaButton
            label={t("Request a new code")}
            onPress={() => void requestNewManagerChallenge()}
            disabled={busy}
          />
          <MfaButton
            label={t("Cancel")}
            onPress={() => { setOperation(null); setCode(""); }}
            disabled={busy}
          />
        </View>
      ) : null}

      {operation?.kind === "choose-add-factor" ? (
        <View style={[styles.operationCard, { backgroundColor: colors.input, borderColor: colors.border }]}>
          <Text style={[styles.factorName, { color: colors.foreground }]}>{t("Choose an authenticator")}</Text>
          {verifiedTotpFactors.map((factor) => (
            <MfaButton
              key={factor.id}
              label={factorLabel(factor, t)}
              onPress={() => {
                setBusy(true);
                void startAddChallenge(factor.id)
                  .catch(() => setErrorKey("MFA management could not be completed. Try again."))
                  .finally(() => setBusy(false));
              }}
              disabled={busy}
            />
          ))}
          <MfaButton label={t("Cancel")} onPress={() => setOperation(null)} disabled={busy} />
        </View>
      ) : null}

      {operation?.kind === "confirm-removal" ? (
        <View style={[styles.operationCard, { backgroundColor: colors.input, borderColor: colors.border }]}>
          <Text style={[styles.factorName, { color: colors.foreground }]}>{t("Remove this authenticator?")}</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            {t("Removing a factor changes the assurance available to this account. Admin access still requires AAL2.")}
          </Text>
          <MfaButton
            testID="totp-confirm-remove"
            label={t(busy ? "Please wait…" : "Confirm removal")}
            onPress={() => void removeFactor(operation.target, false)}
            disabled={busy}
            loading={busy}
            variant="destructive"
          />
          <MfaButton label={t("Keep authenticator")} onPress={() => setOperation(null)} disabled={busy} />
        </View>
      ) : null}

      {operation?.kind === "confirm-discard" ? (
        <View style={[styles.operationCard, { backgroundColor: colors.input, borderColor: colors.border }]}>
          <Text style={[styles.factorName, { color: colors.foreground }]}>{t("Remove incomplete setup?")}</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            {t("This setup is not active. Removing it will discard only this unfinished authenticator.")}
          </Text>
          <MfaButton
            testID="totp-confirm-discard"
            label={t(busy ? "Please wait…" : "Remove incomplete setup")}
            onPress={() => void removeFactor(operation.target, true)}
            disabled={busy}
            loading={busy}
            variant="destructive"
          />
          <MfaButton label={t("Cancel")} onPress={() => setOperation(null)} disabled={busy} />
        </View>
      ) : null}

      {!factorListUnavailable ? (
        <MfaButton
          testID="totp-start-enrollment"
          label={t(verifiedTotpFactors.length > 0 ? "Add another authenticator" : "Set up authenticator")}
          onPress={() => void beginAddAuthenticator()}
          disabled={busy || hasIncompleteSetup || Boolean(operation)}
          loading={busy && !operation}
          variant="primary"
        />
      ) : null}
      {!factorListUnavailable && hasIncompleteSetup ? (
        <Text style={[styles.bodySmall, { color: colors.mutedForeground }]}>
          {t("Remove the incomplete setup before starting another enrollment.")}
        </Text>
      ) : null}

      <View style={[styles.recoveryNote, { borderTopColor: colors.border }]}>
        <Text style={[styles.bodySmall, { color: colors.mutedForeground }]}>
          {t("Add a second authenticator before changing your only one. If you lose all factors, use your verified account-recovery process. This app cannot bypass MFA; your local PIN and finance records remain separate.")}
        </Text>
      </View>
    </View>
  );
}

type FactorOperation =
  | { kind: "verify-enrollment"; draft: SetupDraft }
  | { kind: "reauth-enrollment"; factorId: string; challengeId: string }
  | { kind: "reauth-removal"; factorId: string; challengeId: string; target: MfaFactor }
  | { kind: "confirm-removal"; target: MfaFactor }
  | { kind: "confirm-discard"; target: MfaFactor }
  | { kind: "choose-add-factor" }
  | null;

async function verifyFactorCode(factorId: string, challengeId: string, code: string): Promise<void> {
  const client = supabaseClient;
  if (!client) throw MFA_REQUEST_FAILED;
  const { error } = await client.auth.mfa.verify({ factorId, challengeId, code });
  if (error) throw MFA_REQUEST_FAILED;
  const { data: assurance, error: assuranceError } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assuranceError || assurance?.currentLevel !== "aal2" || assurance.nextLevel === "aal1") {
    throw MFA_REQUEST_FAILED;
  }
}

function factorLabel(factor: MfaFactor, t: (key: string) => string): string {
  if (factor.friendly_name?.trim()) {
    return factor.friendly_name === "Authenticator app" ? t("Authenticator app") : factor.friendly_name;
  }
  return t("Authenticator app");
}

function factorTypeLabel(factor: MfaFactor, t: (key: string) => string): string {
  if (factor.factor_type === "phone") return t("Phone verification");
  if (factor.factor_type === "webauthn") return t("Security key");
  if (factor.factor_type === "recovery_code") return t("Recovery codes");
  return t("Other verification method");
}

function GateMessage({
  icon,
  title,
  body,
  colors,
  loading = false,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  title: string;
  body: string;
  colors: ReturnType<typeof useColors>;
  loading?: boolean;
}) {
  const { isRTL } = usePreferences();
  return (
    <View style={[styles.gateCard, { backgroundColor: colors.input, borderColor: colors.border }]}>
      <View style={[styles.gateTitleRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        {loading ? <ActivityIndicator size="small" color={colors.primary} /> : <Feather name={icon} size={17} color={colors.primary} />}
        <Text style={[styles.factorName, { color: colors.foreground }]}>{title}</Text>
      </View>
      <Text style={[styles.body, { color: colors.mutedForeground }]}>{body}</Text>
    </View>
  );
}

function GateHeading({ title, colors }: { title: string; colors: ReturnType<typeof useColors> }) {
  return <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>;
}

function StatusRow({
  label,
  value,
  colors,
  isRTL,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useColors>;
  isRTL: boolean;
}) {
  return (
    <View style={[styles.statusRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
      <Text style={[styles.body, styles.statusLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.bodyStrong, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

function MfaButton({
  label,
  onPress,
  disabled,
  testID,
  loading = false,
  variant = "default",
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
  testID?: string;
  loading?: boolean;
  variant?: "default" | "primary" | "destructive";
}) {
  const colors = useColors();
  const { isRTL } = usePreferences();
  const backgroundColor = variant === "primary" ? colors.primary : "transparent";
  const textColor = variant === "primary"
    ? colors.primaryForeground
    : variant === "destructive"
      ? colors.destructive
      : colors.foreground;
  const borderColor = variant === "primary" ? colors.primary : variant === "destructive" ? colors.destructive : colors.border;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, busy: loading }}
      testID={testID}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        {
          backgroundColor,
          borderColor,
          opacity: disabled ? 0.6 : 1,
          flexDirection: isRTL ? "row-reverse" : "row",
        },
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={textColor} /> : null}
      <Text style={[styles.buttonText, { color: textColor }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  statusBlock: { gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 12 },
  statusRow: { alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  statusLabel: { flex: 1 },
  body: { fontSize: TYPOGRAPHY.bodySmall, fontFamily: "Inter_400Regular", lineHeight: 19 },
  bodySmall: { fontSize: TYPOGRAPHY.supporting, fontFamily: "Inter_400Regular", lineHeight: 17 },
  bodyStrong: { fontSize: TYPOGRAPHY.bodySmall, fontFamily: "Inter_600SemiBold", textAlign: "auto", flexShrink: 1 },
  message: { fontSize: TYPOGRAPHY.bodySmall, fontFamily: "Inter_500Medium", lineHeight: 20 },
  mfaSection: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 13, gap: 10 },
  sectionTitleRow: { alignItems: "center", gap: 8 },
  sectionTitle: { fontSize: TYPOGRAPHY.cardTitle, fontFamily: "Inter_600SemiBold" },
  factorRow: { minHeight: 54, borderWidth: 1, borderRadius: 12, padding: 10, alignItems: "center", gap: 10 },
  factorCopy: { flex: 1, minWidth: 0, gap: 2 },
  factorName: { fontSize: TYPOGRAPHY.bodySmall, fontFamily: "Inter_600SemiBold" },
  otherFactors: { gap: 8 },
  gateCard: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 10 },
  gateTitleRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  operationCard: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 10 },
  qrFrame: { width: 236, height: 236, maxWidth: "100%", alignSelf: "center", backgroundColor: "#FFFFFF", borderRadius: 12, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  setupKey: { fontSize: 14, fontFamily: "Inter_600SemiBold", letterSpacing: 1.2, textAlign: "center", paddingVertical: 6 },
  input: { width: "100%", minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 10, fontSize: TYPOGRAPHY.body, fontFamily: "Inter_400Regular" },
  codeInput: { fontSize: 19, fontFamily: "Inter_600SemiBold", letterSpacing: 5, textAlign: "center", writingDirection: "ltr" },
  button: { minHeight: 42, borderWidth: 1, borderRadius: 11, paddingHorizontal: 13, paddingVertical: 9, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  buttonText: { fontSize: TYPOGRAPHY.bodySmall, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  recoveryNote: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
});
