/**
 * SARAL i18n Foundation
 * 
 * Supports the Top 5 Indian languages for P5 MVP:
 * 1. Hindi (hi)
 * 2. Tamil (ta)
 * 3. Telugu (te)
 * 4. Kannada (kn)
 * 5. Malayalam (ml)
 * 
 * Note: English (en) is the default fallback.
 */

export type SupportedLanguage = 'en' | 'hi' | 'ta' | 'te' | 'kn' | 'ml';

export const LANGUAGES: Record<SupportedLanguage, { name: string; nativeName: string }> = {
    en: { name: 'English', nativeName: 'English' },
    hi: { name: 'Hindi', nativeName: 'हिन्दी' },
    ta: { name: 'Tamil', nativeName: 'தமிழ்' },
    te: { name: 'Telugu', nativeName: 'తెలుగు' },
    kn: { name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
    ml: { name: 'Malayalam', nativeName: 'മലയാളം' }
};

type Translations = Record<string, string>;

// Mock translations dictionary for P5 MVP
const dictionaries: Record<SupportedLanguage, Translations> = {
    en: {
        'onboarding.welcome': 'Welcome to Paradigm Onboarding',
        'form.next': 'Next',
        'form.submit': 'Submit',
        'form.cancel': 'Cancel'
    },
    hi: {
        'onboarding.welcome': 'पैराडाइम ऑनबोर्डिंग में आपका स्वागत है',
        'form.next': 'अगला',
        'form.submit': 'प्रस्तुत करें',
        'form.cancel': 'रद्द करें'
    },
    ta: {
        'onboarding.welcome': 'Paradigm Onboarding-க்கு நல்வரவு',
        'form.next': 'அடுத்து',
        'form.submit': 'சமர்ப்பி',
        'form.cancel': 'ரத்துசெய்'
    },
    te: {
        'onboarding.welcome': 'పారాడిగ్మ్ ఆన్‌బోర్డింగ్‌కు స్వాగతం',
        'form.next': 'తరువాత',
        'form.submit': 'సమర్పించు',
        'form.cancel': 'రద్దు చేయి'
    },
    kn: {
        'onboarding.welcome': 'ಪ್ಯಾರಾಡಿಗ್ಮ್ ಆನ್‌ಬೋರ್ಡಿಂಗ್‌ಗೆ ಸ್ವಾಗತ',
        'form.next': 'ಮುಂದೆ',
        'form.submit': 'ಸಲ್ಲಿಸಿ',
        'form.cancel': 'ರದ್ದುಮಾಡಿ'
    },
    ml: {
        'onboarding.welcome': 'പാരാഡിഗ്ം ഓൺബോർഡിംഗിലേക്ക് സ്വാഗതം',
        'form.next': 'അടുത്തത്',
        'form.submit': 'സമർപ്പിക്കുക',
        'form.cancel': 'റദ്ദാക്കുക'
    }
};

let currentLanguage: SupportedLanguage = 'en';

export const setLanguage = (lang: SupportedLanguage) => {
    currentLanguage = lang;
    // In a real app, you might trigger a context update or re-render here
};

export const getLanguage = (): SupportedLanguage => currentLanguage;

export const t = (key: string, fallback?: string): string => {
    const translation = dictionaries[currentLanguage]?.[key];
    if (translation) return translation;
    
    // Fallback to English
    const enTranslation = dictionaries['en']?.[key];
    if (enTranslation) return enTranslation;
    
    return fallback || key;
};
