import AsyncStorage from "@react-native-async-storage/async-storage";
import { reloadAppAsync } from "expo";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { I18nManager, Platform } from "react-native";

import {
  type AppLanguage,
  type DisplayCalendar,
  type TranslationValues,
  isRightToLeftLanguage,
  parseDisplayPreferences,
  setActiveDisplayPreferences,
  serializeDisplayPreferences,
  translate,
} from "@/i18n/localization";

const PREFERENCES_KEY = "finance_display_preferences_v1";

function applyWebDirection(language: AppLanguage) {
  if (Platform.OS !== "web" || typeof document === "undefined") return;
  document.documentElement.lang = language === "ar" ? "ar-SA" : "en";
  document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
}

interface PreferencesContextValue {
  language: AppLanguage;
  calendar: DisplayCalendar;
  isReady: boolean;
  isRTL: boolean;
  setLanguage: (language: AppLanguage) => Promise<void>;
  setCalendar: (calendar: DisplayCalendar) => Promise<void>;
  t: (key: string, values?: TranslationValues) => string;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>("en");
  const [calendar, setCalendarState] = useState<DisplayCalendar>("gregorian");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(PREFERENCES_KEY).then(async raw => {
      let savedLanguage: AppLanguage = "en";
      let savedCalendar: DisplayCalendar = "gregorian";
      ({ language: savedLanguage, calendar: savedCalendar } = parseDisplayPreferences(raw));
      if (!active) return;
      setActiveDisplayPreferences({ language: savedLanguage, calendar: savedCalendar });
      setLanguageState(savedLanguage);
      setCalendarState(savedCalendar);
      applyWebDirection(savedLanguage);
      setIsReady(true);

      if (Platform.OS !== "web" && I18nManager.isRTL !== isRightToLeftLanguage(savedLanguage)) {
        I18nManager.allowRTL(isRightToLeftLanguage(savedLanguage));
        I18nManager.forceRTL(isRightToLeftLanguage(savedLanguage));
        await reloadAppAsync();
      }
    }).catch(() => {
      if (active) {
        setActiveDisplayPreferences({ language: "en", calendar: "gregorian" });
        applyWebDirection("en");
        setIsReady(true);
      }
    });
    return () => { active = false; };
  }, []);

  const persist = useCallback(async (next: { language: AppLanguage; calendar: DisplayCalendar }) => {
    await AsyncStorage.setItem(PREFERENCES_KEY, serializeDisplayPreferences(next));
  }, []);

  const setLanguage = useCallback(async (nextLanguage: AppLanguage) => {
    if (nextLanguage === language) return;
    await persist({ language: nextLanguage, calendar });
    setLanguageState(nextLanguage);
    setActiveDisplayPreferences({ language: nextLanguage, calendar });
    if (Platform.OS === "web") {
      applyWebDirection(nextLanguage);
      return;
    }
    I18nManager.allowRTL(nextLanguage === "ar");
    I18nManager.forceRTL(nextLanguage === "ar");
    await reloadAppAsync();
  }, [calendar, language, persist]);

  const setCalendar = useCallback(async (nextCalendar: DisplayCalendar) => {
    if (nextCalendar === calendar) return;
    await persist({ language, calendar: nextCalendar });
    setCalendarState(nextCalendar);
    setActiveDisplayPreferences({ language, calendar: nextCalendar });
  }, [calendar, language, persist]);

  const value = useMemo<PreferencesContextValue>(() => ({
    language,
    calendar,
    isReady,
    isRTL: isRightToLeftLanguage(language),
    setLanguage,
    setCalendar,
    t: (key, values) => translate(key, language, values),
  }), [calendar, isReady, language, setCalendar, setLanguage]);

  if (!isReady) return null;
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesContextValue {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error("usePreferences must be used inside PreferencesProvider");
  return context;
}
