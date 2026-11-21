/* Locales a menu or layout can serve. Shared by the menu and layout modules so neither imports the other for it. */
export const DEFAULT_LOCALE = "en-IN";
export const MENU_LOCALES: { id: string; label: string }[] = [
  { id: "en-IN", label: "English (India)" },
  { id: "en-GB", label: "English (UK)" },
  { id: "en-US", label: "English (US)" },
  { id: "fr-FR", label: "French (France)" },
  { id: "de-DE", label: "German (Germany)" },
  { id: "es-ES", label: "Spanish (Spain)" },
  { id: "it-IT", label: "Italian (Italy)" },
];
export const localeLabel = (id: string): string => MENU_LOCALES.find((l) => l.id === id)?.label ?? id;
export const isLocale = (id: string): boolean => MENU_LOCALES.some((l) => l.id === id);
