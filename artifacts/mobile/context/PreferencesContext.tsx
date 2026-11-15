import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { I18nManager, Platform } from "react-native";

import {
  type AppLanguage,
  type DisplayCalendar,
  type DisplayPreferences,
  type TranslationValues,
  isRightToLeftLanguage,
  parseDisplayPreferences,
  setActiveDisplayPreferences,
  serializeDisplayPreferences,
  translate,
} from "@/i18n/localization";
import { applyDirectionPreference, getNativeDirectionStatus } from "@/i18n/rtlDirection";

const PREFERENCES_KEY = "finance_display_preferences_v1";

function applyWebDirection(language: AppLanguage) {
  if (Platform.OS !== "web" || typeof document === "undefined") return;
  document.documentElement.lang = language === "ar" ? "ar-SA" : "en";
  document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
}

function prepareNativeDirection(language: AppLanguage): boolean {
  const platform = Platform.OS === "web" ? "web" : "native";
  try {
    applyDirectionPreference(
      language,
      platform,
      I18nManager.isRTL,
      targetIsRTL => {
        I18nManager.allowRTL(targetIsRTL);
        I18nManager.forceRTL(targetIsRTL);
      },
    );
    if (platform === "web") return false;
    return getNativeDirectionStatus(language, "native", I18nManager.isRTL).restartRequired;
  } catch {
    // Keep the selected language and let Settings explain the manual restart.
    return true;
  }
}

interface PreferencesContextValue {
  language: AppLanguage;
  calendar: DisplayCalendar;
  isReady: boolean;
  isRTL: boolean;
  rtlRestartRequired: boolean;
  setLanguage: (language: AppLanguage) => Promise<void>;
  setCalendar: (calendar: DisplayCalendar) => Promise<void>;
  t: (key: string, values?: TranslationValues) => string;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>("en");
  const [calendar, setCalendarState] = useState<DisplayCalendar>("gregorian");
  const [isReady, setIsReady] = useState(false);
  const [rtlRestartRequired, setRtlRestartRequired] = useState(false);
  const preferencesRef = useRef<DisplayPreferences>({ language: "en", calendar: "gregorian" });
  const updateQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(PREFERENCES_KEY).then(async raw => {
      const savedPreferences = parseDisplayPreferences(raw);
      if (!active) return;
      preferencesRef.current = savedPreferences;
      setActiveDisplayPreferences(savedPreferences);
      setLanguageState(savedPreferences.language);
      setCalendarState(savedPreferences.calendar);
      applyWebDirection(savedPreferences.language);
      setRtlRestartRequired(prepareNativeDirection(savedPreferences.language));
      setIsReady(true);
    }).catch(() => {
      if (active) {
        const defaults: DisplayPreferences = { language: "en", calendar: "gregorian" };
        preferencesRef.current = defaults;
        setActiveDisplayPreferences(defaults);
        setLanguageState(defaults.language);
        setCalendarState(defaults.calendar);
        applyWebDirection("en");
        setRtlRestartRequired(prepareNativeDirection("en"));
        setIsReady(true);
      }
    });
    return () => { active = false; };
  }, []);

  const persist = useCallback(async (next: { language: AppLanguage; calendar: DisplayCalendar }) => {
    await AsyncStorage.setItem(PREFERENCES_KEY, serializeDisplayPreferences(next));
  }, []);

  const queuePreferenceUpdate = useCallback((update: Partial<DisplayPreferences>) => {
    const operation = updateQueueRef.current.catch(() => {}).then(async () => {
      const current = preferencesRef.current;
      const next = { ...current, ...update };
      if (next.language === current.language && next.calendar === current.calendar) return;
      await persist(next);
      preferencesRef.current = next;
      setActiveDisplayPreferences(next);
      setLanguageState(next.language);
      setCalendarState(next.calendar);
      applyWebDirection(next.language);
      if (update.language !== undefined) {
        setRtlRestartRequired(prepareNativeDirection(next.language));
      }
    });
    updateQueueRef.current = operation;
    return operation;
  }, [persist]);

  const setLanguage = useCallback(
    (nextLanguage: AppLanguage) => queuePreferenceUpdate({ language: nextLanguage }),
    [queuePreferenceUpdate],
  );

  const setCalendar = useCallback(
    (nextCalendar: DisplayCalendar) => queuePreferenceUpdate({ calendar: nextCalendar }),
    [queuePreferenceUpdate],
  );

  const value = useMemo<PreferencesContextValue>(() => ({
    language,
    calendar,
    isReady,
    isRTL: isRightToLeftLanguage(language),
    rtlRestartRequired,
    setLanguage,
    setCalendar,
    t: (key, values) => translate(key, language, values),
  }), [calendar, isReady, language, rtlRestartRequired, setCalendar, setLanguage]);

  if (!isReady) return null;
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesContextValue {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error("usePreferences must be used inside PreferencesProvider");
  return context;
}
