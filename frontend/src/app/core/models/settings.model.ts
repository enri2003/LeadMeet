export type PrivacyLevel = 'organization' | 'anyone' | 'verified';
export type Theme = 'dark-lead' | 'light-lead';
export type CaptionLang = 'es' | 'en' | 'pt' | 'fr';

export interface UserSettings {
  id?: string;
  userId?: string;

  // Audio & Video
  micDeviceId: string | null;
  audioOutId: string | null;
  noiseCancel: boolean;
  faceLink: boolean;

  // Privacy
  privacyLevel: PrivacyLevel;
  hidePresence: boolean;

  // Interface
  fontSize: number;
  theme: Theme;
  captions: boolean;
  captionLang: CaptionLang;
}

export const DEFAULT_SETTINGS: UserSettings = {
  micDeviceId: null,
  audioOutId: null,
  noiseCancel: false,
  faceLink: false,
  privacyLevel: 'organization',
  hidePresence: false,
  fontSize: 16,
  theme: 'dark-lead',
  captions: false,
  captionLang: 'es',
};

export const FONT_LABELS: Record<number, string> = {
  12: 'Pequeño',
  14: 'Compacto',
  16: 'Estándar',
  18: 'Grande',
  20: 'Muy grande',
  24: 'Máximo',
};
