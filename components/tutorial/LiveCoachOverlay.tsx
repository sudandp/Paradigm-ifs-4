import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  Volume2, 
  VolumeX, 
  X, 
  CheckCircle2, 
  Award, 
  Scan, 
  Flame,
  Check,
  ChevronRight,
  ThumbsUp,
  Clock
} from 'lucide-react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { useTutorialStore } from '../../store/tutorialStore';
import { tutorialVoiceService, TutorialLanguage } from '../../services/tutorialVoiceService';
import { useAuthStore } from '../../store/authStore';

export type CoachStepKey = 
  | 'intro'
  | 'punch_in' 
  | 'captured_time'
  | 'duty_mode' 
  | 'site_in' 
  | 'site_out' 
  | 'break_in' 
  | 'break_out' 
  | 'punch_out' 
  | 'completed';

interface LocalizedCoachContent {
  title: string;
  badge: string;
  subtitles: string;
  voice: string;
}

interface CoachStepConfig {
  key: CoachStepKey;
  targetId: string;
  expectedAction: string;
  content: Record<TutorialLanguage, LocalizedCoachContent>;
  autoAdvanceSeconds?: number;
}

const COACH_STEPS: CoachStepConfig[] = [
  {
    key: 'intro',
    targetId: 'tour-main-punch',
    expectedAction: 'tap_punch_in',
    content: {
      en: {
        title: 'Step 1: Daily Shift Start',
        badge: 'Step 1 of 8 • Shift Arrival',
        subtitles: 'Tap the green glowing PUNCH IN orb below to start your shift.',
        voice: "Welcome to Paradigm! Let's walk through how your daily shift works. When you arrive at work, start your shift by tapping the green Punch In orb. Go ahead and tap it now."
      },
      hi: {
        title: 'चरण 1: दैनिक ड्यूटी शुरू',
        badge: 'चरण 1/8 • उपस्थिति दर्ज करें',
        subtitles: 'अपनी शिफ्ट शुरू करने के लिए नीचे हरे रंग के पंच इन बटन पर टैप करें।',
        voice: 'पैराडाइम में आपका स्वागत है! काम पर पहुंचने पर, हरे रंग के पंच इन बटन पर टैप करके अपनी शिफ्ट शुरू करें। इसे अभी टैप करें।'
      },
      ta: {
        title: 'படி 1: பணி தொடக்கம்',
        badge: 'படி 1/8 • வருகை பதிவு',
        subtitles: 'உங்கள் பணியை தொடங்க கீழே உள்ள பச்சை நிற பஞ்ச் இன் பட்டனை தட்டவும்.',
        voice: 'பாராடிக்மிற்கு அன்புடன் வரவேற்கிறோம்! பணிக்கு வந்ததும், பச்சை நிற பஞ்ச் இன் பட்டனை தட்டி உங்கள் பணியை தொடங்குங்கள். இப்போது தட்டவும்.'
      },
      te: {
        title: 'దశ 1: డ్యూటీ ప్రారంభం',
        badge: 'దశ 1/8 • హాజరు నమోదు',
        subtitles: 'మీ షిఫ్ట్ ప్రారంభించడానికి క్రింద ఆకుపచ్చ పంచ్ ఇన్ బటన్‌ను నొక్కండి.',
        voice: 'పారడైమ్‌కు స్వాగతం! విధికి వచ్చినప్పుడు, ఆకుపచ్చ పంచ్ ఇన్ బటన్‌ను నొక్కి మీ షిఫ్ట్‌ను ప్రారంభించండి.'
      },
      kn: {
        title: 'ಹಂತ 1: ಕರ್ತವ್ಯ ಪ್ರಾರಂಭ',
        badge: 'ಹಂತ 1/8 • ಹಾಜರಾತಿ ದಾಖಲು',
        subtitles: 'ನಿಮ್ಮ ಶಿಫ್ಟ್ ಪ್ರಾರಂಭಿಸಲು ಕೆಳಗಿನ ಹಸಿರು ಪಂಚ್ ಇನ್ ಬಟನ್ ಒತ್ತಿರಿ.',
        voice: 'ಪ್ಯಾರಾಡೈಮ್‌ಗೆ ಸುಸ್ವಾಗತ! ಕೆಲಸಕ್ಕೆ ಬಂದಾಗ, ಹಸಿರು ಪಂಚ್ ಇನ್ ಬಟನ್ ಒತ್ತಿ ನಿಮ್ಮ ಶಿಫ್ಟ್ ಪ್ರಾರಂಭಿಸಿ.'
      }
    }
  },
  {
    key: 'captured_time',
    targetId: 'tour-entry-card',
    expectedAction: 'continue_from_captured_time',
    autoAdvanceSeconds: 8,
    content: {
      en: {
        title: 'Step 2: Verified Punch Timestamp',
        badge: 'Step 2 of 8 • Recorded Log',
        subtitles: 'Punch-in verified: Recorded at First Entry at 09:00 AM.',
        voice: 'Your punch-in time is verified and recorded at First Entry at 09:00 AM. You can check your daily logged hours here anytime.'
      },
      hi: {
        title: 'चरण 2: दर्ज पंच समय',
        badge: 'चरण 2/8 • उपस्थिति समय',
        subtitles: 'पंच-इन सत्यापित: फर्स्ट एंट्री में सुबह 9:00 बजे दर्ज हुआ।',
        voice: 'आपका पंच-इन समय सत्यापित हो गया है और फर्स्ट एंट्री में सुबह 9:00 बजे दर्ज है। आप अपने काम के घंटे कभी भी देख सकते हैं।'
      },
      ta: {
        title: 'படி 2: பதிவு செய்யப்பட்ட நேரம்',
        badge: 'படி 2/8 • முதல் பதிவு நேரம்',
        subtitles: 'பஞ்ச்-இன் உறுதி செய்யப்பட்டது: காலை 9:00 மணிக்கு முதல் பதிவில் பதிவானது.',
        voice: 'உங்கள் பஞ்ச்-இன் நேரம் உறுதி செய்யப்பட்டு, காலை 9:00 மணிக்கு முதல் பதிவில் காட்டப்படுகிறது. உங்கள் பணி நேரத்தை எப்போது வேண்டுமானாலும் பார்க்கலாம்.'
      },
      te: {
        title: 'దశ 2: నమోదు చేయబడిన సమయం',
        badge: 'దశ 2/8 • ఎంట్రీ రికార్డ్',
        subtitles: 'పంచ్-ఇన్ ధృవీకరించబడింది: ఫస్ట్ ఎంట్రీలో ఉదయం 9:00 గంటలకు నమోదైంది.',
        voice: 'మీ పంచ్-ఇన్ సమయం ధృవీకరించబడింది మరియు ఫస్ట్ ఎంట్రీలో ఉదయం 9:00 గంటలకు కనిపిస్తుంది. మీ పని వేళలను ఎప్పుడైనా తనిఖీ చేయవచ్చు.'
      },
      kn: {
        title: 'ಹಂತ 2: ದಾಖಲಾದ ಸಮಯ',
        badge: 'ಹಂತ 2/8 • ಪ್ರವೇಶ ಸಮಯ',
        subtitles: 'ಪಂಚ್-ಇನ್ ದೃಢೀಕರಿಸಲಾಗಿದೆ: ಮೊದಲ ಪ್ರವೇಶದಲ್ಲಿ ಬೆಳಗ್ಗೆ 9:00 ಗಂಟೆಗೆ ದಾಖಲಾಗಿದೆ.',
        voice: 'ನಿಮ್ಮ ಪಂಚ್-ಇನ್ ಸಮಯ ದೃಢೀಕರಿಸಲಾಗಿದೆ ಮತ್ತು ಮೊದಲ ಪ್ರವೇಶದಲ್ಲಿ ಬೆಳಗ್ಗೆ 9:00 ಗಂಟೆಗೆ ದಾಖಲಾಗಿದೆ. ನಿಮ್ಮ ಕೆಲಸದ ಸಮಯವನ್ನು ನೀವು ಯಾವಾಗ ಬೇಕಾದರೂ ಪರಿಶೀಲಿಸಬಹುದು.'
      }
    }
  },
  {
    key: 'duty_mode',
    targetId: 'tour-duty-mode',
    expectedAction: 'tap_duty_mode',
    content: {
      en: {
        title: 'Step 3: Duty Mode Selection',
        badge: 'Step 3 of 8 • Regular vs Site Duty',
        subtitles: 'Choose your mode: Tap "Regular Duty" for assigned shift, or "Site Duty" for site relieving / overtime duty.',
        voice: 'Great job! Your shift is now active. If you are doing your regular assigned shift, tap Regular Duty. If you are doing site relieving or overtime duty, tap Site Duty. Tap the one you prefer.'
      },
      hi: {
        title: 'चरण 3: ड्यूटी मोड चुनें',
        badge: 'चरण 3/8 • रेगुलर बनाम साइट ड्यूटी',
        subtitles: 'अपनी पसंद चुनें: सामान्य शिफ्ट के लिए "रेगुलर ड्यूटी" या साइट रिलीविंग/ओवरटाइम के लिए "साइट ड्यूटी" दबाएं।',
        voice: 'शाबाश! आपकी शिफ्ट अब सक्रिय है। यदि आप अपनी नियमित शिफ्ट कर रहे हैं, तो रेगुलर ड्यूटी चुनें। यदि आप साइट रिलीविंग या ओवरटाइम ड्यूटी कर रहे हैं, तो साइट ड्यूटी चुनें। अपनी आवश्यकता के अनुसार टैप करें।'
      },
      ta: {
        title: 'படி 3: பணி முறையை தேர்வு செய்யவும்',
        badge: 'படி 3/8 • வழக்கமான vs சைட் டியூட்டி',
        subtitles: 'வழக்கமான பணிக்கு "ரெகுலர் டியூட்டி" அல்லது சைட் ரிலீவிங்/ஓவர்டைமிற்கு "சைட் டியூட்டி" என்பதைத் தட்டவும்.',
        voice: 'சிறப்பு! உங்கள் பணி தொடங்கியது. நீங்கள் வழக்கமான பணியைச் செய்கிறீர்கள் என்றால் ரெகுலர் டியூட்டி என்பதைத் தட்டவும். சைட் ரிலீவிங் அல்லது ஓவர்டைம் பணி செய்கிறீர்கள் என்றால் சைட் டியூட்டி என்பதைத் தட்டவும். உங்களுக்கு தேவையானதை தேர்வு செய்யுங்கள்.'
      },
      te: {
        title: 'దశ 3: డ్యూటీ మోడ్ ఎంచుకోండి',
        badge: 'దశ 3/8 • రెగ్యులర్ vs సైట్ డ్యూటీ',
        subtitles: 'సాధారణ షిఫ్ట్ కోసం "రెగ్యులర్ డ్యూటీ" లేదా సైట్ రిలీవింగ్/ఓవర్‌టైమ్ కోసం "సైట్ డ్యూటీ" నొక్కండి.',
        voice: 'చాలా బాగుంది! మీ షిఫ్ట్ ప్రారంభమైంది. మీరు మీ సాధారణ షిఫ్ట్ చేస్తున్నట్లయితే రెగ్యులర్ డ్యూటీని ఎంచుకోండి. మీరు సైట్ రిలీవింగ్ లేదా ఓవర్‌టైమ్ డ్యూటీ చేస్తుంటే సైట్ డ్యూటీని ఎంచుకోండి. మీకు కావలసినదాన్ని నొక్కండి.'
      },
      kn: {
        title: 'ಹಂತ 3: ಕರ್ತವ್ಯ ಮೋಡ್ ಆಯ್ಕೆಮಾಡಿ',
        badge: 'ಹಂತ 3/8 • ರೆಗ್ಯುಲರ್ vs ಸೈಟ್ ಡ್ಯೂಟಿ',
        subtitles: 'ನಿಯಮಿತ ಶಿಫ್ಟ್‌ಗಾಗಿ "ರೆಗ್ಯುಲರ್ ಡ್ಯೂಟಿ" ಅಥವಾ ಸೈಟ್ ರಿಲೀವಿಂಗ್/ಓವರ್‌ಟೈಮ್‌ಗಾಗಿ "ಸೈಟ್ ಡ್ಯೂಟಿ" ಒತ್ತಿರಿ.',
        voice: 'ತುಂಬಾ ಒಳ್ಳೆಯದು! ನಿಮ್ಮ ಶಿಫ್ಟ್ ಪ್ರಾರಂಭವಾಗಿದೆ. ನೀವು ನಿಮ್ಮ ನಿಯಮಿತ ಶಿಫ್ಟ್ ಮಾಡುತ್ತಿದ್ದರೆ ರೆಗ್ಯುಲರ್ ಡ್ಯೂಟಿ ಆಯ್ಕೆಮಾಡಿ. ನೀವು ಸೈಟ್ ರಿಲೀವಿಂಗ್ ಅಥವಾ ಓವರ್‌ಟೈಮ್ ಕರ್ತವ್ಯ ಮಾಡುತ್ತಿದ್ದರೆ ಸೈಟ್ ಡ್ಯೂಟಿ ಆಯ್ಕೆಮಾಡಿ. ನಿಮಗೆ ಬೇಕಾದುದನ್ನು ಒತ್ತಿರಿ.'
      }
    }
  },
  {
    key: 'site_in',
    targetId: 'tour-site-action',
    expectedAction: 'tap_site_in',
    content: {
      en: {
        title: 'Step 4: Client Site Arrival',
        badge: 'Step 4 of 8 • Client Check In',
        subtitles: 'Arriving for inspection, meeting, or training? Tap "Check In" to verify GPS arrival.',
        voice: 'When arriving at a client facility for inspection, meeting, or training, tap Check In to log your site arrival. Tap Check In now.'
      },
      hi: {
        title: 'चरण 4: क्लाइंट साइट आगमन',
        badge: 'चरण 4/8 • क्लाइंट चेक इन',
        subtitles: 'साइट इंस्पेक्शन, मीटिंग या ट्रेनिंग के लिए आने पर "चेक इन" पर टैप करें।',
        voice: 'जब आप साइट इंस्पेक्शन, क्लाइंट मीटिंग या ट्रेनिंग के लिए पहुंचे, तो अपना आगमन दर्ज करने के लिए चेक इन पर टैप करें।'
      },
      ta: {
        title: 'படி 4: சைட் வருகை பதிவு',
        badge: 'படி 4/8 • சைட் செக் இன்',
        subtitles: 'சைட் ஆய்வு, மீட்டிங் அல்லது டிரெய்னிங்கிற்கு வரும்போது "செக் இன்" தட்டவும்.',
        voice: 'நீங்கள் சைட் ஆய்வு, மீட்டிங் அல்லது டிரெய்னிங்கிற்கு வரும்போது, உங்கள் வருகையை பதிவு செய்ய செக் இன் பட்டனை தட்டவும்.'
      },
      te: {
        title: 'దశ 4: క్లయింట్ సైట్ రాక',
        badge: 'దశ 4/8 • క్లయింట్ చెక్ ఇన్',
        subtitles: 'సైట్ ఇన్స్పెక్షన్, మీటింగ్ లేదా ట్రైనింగ్ కోసం "చెక్ ఇన్" నొక్కండి.',
        voice: 'మీరు సైట్ ఇన్స్పెక్షన్, మీటింగ్ లేదా ట్రైనింగ్ కోసం క్లయింట్ సైట్‌కు వచ్చినప్పుడు, మీ రాకను నమోదు చేయడానికి చెక్ ఇన్ బటన్ నొక్కండి.'
      },
      kn: {
        title: 'ಹಂತ 4: ಸೈಟ್ ಆಗಮನ',
        badge: 'ಹಂತ 4/8 • ಸೈಟ್ ಚೆಕ್ ಇನ್',
        subtitles: 'ಸೈಟ್ ಇನ್ಸ್ಪೆಕ್ಷನ್, ಮೀಟಿಂಗ್ ಅಥವಾ ಟ್ರೈನಿಂಗ್‌ಗಾಗಿ "ಚೆಕ್ ಇನ್" ಒತ್ತಿರಿ.',
        voice: 'ನೀವು ಸೈಟ್ ಇನ್ಸ್ಪೆಕ್ಷನ್, ಮೀಟಿಂಗ್ ಅಥವಾ ಟ್ರೈನಿಂಗ್‌ಗಾಗಿ ತಲುಪಿದಾಗ, ನಿಮ್ಮ ಆಗಮನ ದಾಖಲಿಸಲು ಚೆಕ್ ಇನ್ ಬಟನ್ ಒತ್ತಿರಿ.'
      }
    }
  },
  {
    key: 'site_out',
    targetId: 'tour-site-action',
    expectedAction: 'tap_site_out',
    content: {
      en: {
        title: 'Step 5: Client Site Departure',
        badge: 'Step 5 of 8 • Client Check Out',
        subtitles: 'Inspection, meeting, or training completed? Tap "Check Out" to complete your visit.',
        voice: 'Excellent! When your site inspection, meeting, or training is finished, tap Check Out to complete the visit.'
      },
      hi: {
        title: 'चरण 5: क्लाइंट साइट प्रस्थान',
        badge: 'चरण 5/8 • क्लाइंट चेक आउट',
        subtitles: 'इंस्पेक्शन, मीटिंग या ट्रेनिंग पूरी होने पर "चेक आउट" पर टैप करें।',
        voice: 'बहुत बढ़िया! जब आपका साइट इंस्पेक्शन, मीटिंग या ट्रेनिंग पूरी हो जाए, तो विजिट समाप्त करने के लिए चेक आउट पर टैप करें।'
      },
      ta: {
        title: 'படி 5: சைட் புறப்பாடு',
        badge: 'படி 5/8 • சைட் செக் அவுட்',
        subtitles: 'ஆய்வு, மீட்டிங் அல்லது டிரெய்னிங் முடிந்ததும் "செக் அவுட்" தட்டவும்.',
        voice: 'அற்புதம்! உங்கள் சைட் ஆய்வு, மீட்டிங் அல்லது டிரெய்னிங் முடிந்ததும், விசிட்டை முடிக்க செக் அவுட் பட்டனை தட்டவும்.'
      },
      te: {
        title: 'దశ 5: క్లయింట్ సైట్ నిష్క్రమణ',
        badge: 'దశ 5/8 • క్లయింట్ check అవుట్',
        subtitles: 'ఇన్స్పెక్షన్, మీటింగ్ లేదా ట్రైనింగ్ పూర్తయిన తర్వాత "చెక్ అవుట్" నొక్కండి.',
        voice: 'అద్భుతం! మీ సైట్ ఇన్స్పెక్షన్, మీటింగ్ లేదా ట్రైనింగ్ పూర్తయిన తర్వాత, విజిట్ ముగించడానికి చెక్ అవుట్ బటన్ నొక్కండి.'
      },
      kn: {
        title: 'ಹಂತ 5: ಸೈಟ್ ನಿರ್ಗಮನ',
        badge: 'ಹಂತ 5/8 • ಸೈಟ್ ಚೆಕ್ ಔಟ್',
        subtitles: 'ಇನ್ಸ್ಪೆಕ್ಷನ್, ಮೀಟಿಂಗ್ ಅಥವಾ ಟ್ರೈನಿಂಗ್ ಮುಗಿದ ನಂತರ "ಚೆಕ್ ಔಟ್" ಒತ್ತಿರಿ.',
        voice: 'ಉತ್ತಮ! ನಿಮ್ಮ ಸೈಟ್ ಇನ್ಸ್ಪೆಕ್ಷನ್, ಮೀಟಿಂಗ್ ಅಥವಾ ಟ್ರೈನಿಂಗ್ ಮುಗಿದ ನಂತರ, ಭೇಟಿ ಪೂರ್ಣಗೊಳಿಸಲು ಚೆಕ್ ಔಟ್ ಒತ್ತಿರಿ.'
      }
    }
  },
  {
    key: 'break_in',
    targetId: 'tour-break-action',
    expectedAction: 'tap_take_break',
    content: {
      en: {
        title: 'Step 6: Meal & Tea Breaks',
        badge: 'Step 6 of 8 • Break Tracking',
        subtitles: 'Taking lunch or tea? Tap "Take Break" to pause your duty timer.',
        voice: 'Need a lunch or tea break? Tap Take Break to pause tracking. Try tapping Take Break now.'
      },
      hi: {
        title: 'चरण 6: भोजन और चाय अवकाश',
        badge: 'चरण 6/8 • ब्रेक ट्रैकिंग',
        subtitles: 'ड्यूटी टाइमर रोकने के लिए "टेक ब्रेक" पर टैप करें।',
        voice: 'लंच या चाय का ब्रेक चाहिए? ट्रैकिंग रोकने के लिए टेक ब्रेक पर टैप करें।'
      },
      ta: {
        title: 'படி 6: மதிய உணவு / டீ இடைவேளை',
        badge: 'படி 6/8 • இடைவேளை கண்காணிப்பு',
        subtitles: 'பணி நேரத்தை நிறுத்தி வைக்க "டேக் பிரேக்" பட்டனை தட்டவும்.',
        voice: 'மதிய உணவு அல்லது டீ இடைவேளை தேவையா? இடைவேளையை தொடங்க டேக் பிரேக் பட்டனை தட்டவும்.'
      },
      te: {
        title: 'దశ 6: భోజనం / టీ విరామం',
        badge: 'దశ 6/8 • బ్రేక్ ట్రాకింగ్',
        subtitles: 'డ్యూటీ టైమర్‌ను పాజ్ చేయడానికి "టేక్ బ్రేక్" నొక్కండి.',
        voice: 'లంచ్ లేదా టీ బ్రేక్ కావాలా? టేక్ బ్రేక్ పై నొక్కండి.'
      },
      kn: {
        title: 'ಹಂತ 6: ಊಟ ಮತ್ತು ಟೀ ವಿರಾಮ',
        badge: 'ಹಂತ 6/8 • ವಿರಾಮ ಟ್ರ್ಯಾಕಿಂಗ್',
        subtitles: 'ಕರ್ತವ್ಯ ಟೈಮರ್ ನಿಲ್ಲಿಸಲು "ಟೇಕ್ ಬ್ರೇಕ್" ಒತ್ತಿರಿ.',
        voice: 'ಊಟ ಅಥವಾ ಟೀ ವಿರಾಮ ಬೇಕೆ? ಟೇಕ್ ಬ್ರೇಕ್ ಬಟನ್ ಟ್ಯಾಪ್ ಮಾಡಿ.'
      }
    }
  },
  {
    key: 'break_out',
    targetId: 'tour-break-action',
    expectedAction: 'tap_resume_work',
    content: {
      en: {
        title: 'Step 7: Resume Active Duty',
        badge: 'Step 7 of 8 • Resume Duty',
        subtitles: 'Break finished? Tap "Resume Work" to return to active tracking.',
        voice: 'Your break timer is now active. When you finish your break, tap Resume Work to continue your shift.'
      },
      hi: {
        title: 'चरण 7: ड्यूटी फिर से शुरू करें',
        badge: 'चरण 7/8 • रिज्यूम ड्यूटी',
        subtitles: 'ब्रेक समाप्त? सक्रिय ट्रैकिंग जारी रखने के लिए "रिज्यूम वर्क" दबाएं।',
        voice: 'आपका ब्रेक टाइमर चालू है। ब्रेक समाप्त होने पर, अपनी शिफ्ट जारी रखने के लिए रिज्यूम वर्क पर टैप करें।'
      },
      ta: {
        title: 'படி 7: பணியை தொடரவும்',
        badge: 'படி 7/8 • மீண்டும் பணி',
        subtitles: 'இடைவேளை முடிந்ததா? பணியைத் தொடர "ரெஸ்யூம் ஒர்க்" தட்டவும்.',
        voice: 'உங்கள் இடைவேளை முடிவடைந்ததும், பணியை தொடர ரெஸ்யூம் ஒர்க் பட்டனை தட்டவும்.'
      },
      te: {
        title: 'దశ 7: డ్యూటీ పునఃప్రారంభం',
        badge: 'దశ 7/8 • రెజ్యూమ్ డ్యూటీ',
        subtitles: 'విరామం ముగిసిందా? డ్యూటీని కొనసాగించడానికి "రెజ్యూమ్ వర్క్" నొక్కండి.',
        voice: 'మీ విరామం పూర్తయినప్పుడు, పనిని కొనసాగించడానికి రెజ్యూమ్ వర్క్ నొక్కండి.'
      },
      kn: {
        title: 'ಹಂತ 7: ಕರ್ತವ್ಯ ಮುಂದುವರಿಸಿ',
        badge: 'ಹಂತ 7/8 • ರೆಸ್ಯೂಮ್ ಡ್ಯೂಟಿ',
        subtitles: 'ವಿರಾಮ ಮುಗಿದಿದೆಯೇ? ಕೆಲಸವನ್ನು ಮುಂದುವರಿಸಲು "ರೆಸ್ಯೂಮ್ ವರ್ಕ್" ಒತ್ತಿರಿ.',
        voice: 'ವಿರಾಮ ಮುಗಿದ ನಂತರ, ಕೆಲಸವನ್ನು ಮುಂದುವರಿಸಲು ರೆಸ್ಯೂಮ್ ವರ್ಕ್ ಒತ್ತಿರಿ.'
      }
    }
  },
  {
    key: 'punch_out',
    targetId: 'tour-main-punch',
    expectedAction: 'tap_punch_out',
    content: {
      en: {
        title: 'Step 8: Shift Checkout',
        badge: 'Step 8 of 8 • Shift Completion',
        subtitles: 'End of workday? Tap the red PUNCH OUT orb to complete your shift.',
        voice: 'Finally, at the end of your workday, tap the red Punch Out orb to finish your shift. Tap it now to complete your practice.'
      },
      hi: {
        title: 'चरण 8: शिफ्ट समाप्ति',
        badge: 'चरण 8/8 • पंच आउट',
        subtitles: 'कार्यदिवस समाप्त? अपनी शिफ्ट पूरी करने के लिए लाल पंच आउट बटन दबाएं।',
        voice: 'अंत में, दिन का काम समाप्त होने पर, अपनी शिफ्ट पूरी करने के लिए लाल पंच आउट बटन पर टैप करें।'
      },
      ta: {
        title: 'படி 8: பணி நிறைவு',
        badge: 'படி 8/8 • பஞ்ச் அவுட்',
        subtitles: 'பணி முடிந்ததும் உங்கள் ஷிப்டை முடிக்க சிவப்பு நிற பஞ்ச் அவுட் பட்டனை தட்டவும்.',
        voice: 'இறுதியாக, பணி முடிந்ததும், உங்கள் ஷிப்டை முடிக்க சிவப்பு நிற பஞ்ச் அவுட் பட்டனை தட்டவும்.'
      },
      te: {
        title: 'దశ 8: షిఫ్ట్ ముగింపు',
        badge: 'దశ 8/8 • పంచ్ అవుట్',
        subtitles: 'పని ముగిసిందా? మీ షిఫ్ట్ పూర్తి చేయడానికి ఎరుపు పంచ్ అవుట్ బటన్ నొక్కండి.',
        voice: 'చివరిగా, రోజు పని పూర్తయినప్పుడు, షిఫ్ట్ ముగించడానికి ఎరుపు పంచ్ అవుట్ బటన్ నొక్కండి.'
      },
      kn: {
        title: 'ಹಂತ 8: ಶಿಫ್ಟ್ ಮುಕ್ತಾಯ',
        badge: 'ಹಂತ 8/8 • ಪಂಚ್ ಔಟ್',
        subtitles: 'ಕೆಲಸ ಮುಗಿದ ನಂತರ ನಿಮ್ಮ ಶಿಫ್ಟ್ ಪೂರ್ಣಗೊಳಿಸಲು ಕೆಂಪು ಪಂಚ್ ಔಟ್ ಬಟನ್ ಒತ್ತಿರಿ.',
        voice: 'ಕೊನೆಯದಾಗಿ, ದಿನದ ಕೆಲಸ ಮುಗಿದ ನಂತರ, ನಿಮ್ಮ ಶಿಫ್ಟ್ ಪೂರ್ಣಗೊಳಿಸಲು ಕೆಂಪು ಪಂಚ್ ಔಟ್ ಬಟನ್ ಒತ್ತಿರಿ.'
      }
    }
  },
  {
    key: 'completed',
    targetId: 'tour-main-punch',
    expectedAction: 'finish',
    content: {
      en: {
        title: 'Certified Employee!',
        badge: 'Certified • Operations Ready',
        subtitles: 'Congratulations! You are officially certified and ready for live duty.',
        voice: 'Outstanding! You have mastered the entire daily attendance workflow. You are officially certified and ready for duty!'
      },
      hi: {
        title: 'प्रमाणित कर्मचारी!',
        badge: 'प्रमाणित • ड्यूटी के लिए तैयार',
        subtitles: 'बधाई हो! आप आधिकारिक रूप से प्रमाणित हैं और लाइव ड्यूटी के लिए तैयार हैं।',
        voice: 'बहुत बढ़िया! आपने पूरी दैनिक उपस्थिति प्रक्रिया सीख ली है। आप आधिकारिक रूप से प्रमाणित और तैयार हैं!'
      },
      ta: {
        title: 'சான்றிதழ் பெற்ற பணியாளர்!',
        badge: 'சான்றிதழ் • பணிக்கு தயார்',
        subtitles: 'வாழ்த்துகள்! நீங்கள் அதிகாரப்பூர்வமாக சான்றிதழ் பெற்று நேரடி பணிக்கு தயாராகிவிட்டீர்கள்.',
        voice: 'அற்புதம்! நீங்கள் முழுமையான பணி செயல்முறையை வெற்றிகரமாக கற்றுக்கொண்டீர்கள். நீங்கள் இப்போது சான்றிதழ் பெற்றுள்ளீர்கள்!'
      },
      te: {
        title: 'సర్టిఫైడ్ ఉద్యోగి!',
        badge: 'సర్టిఫైడ్ • డ్యూటీకి సిద్ధం',
        subtitles: 'అభినందనలు! మీరు అధికారికంగా సర్టిఫై చేయబడ్డారు మరియు లైవ్ డ్యూటీకి సిద్ధంగా ఉన్నారు.',
        voice: 'అద్భుతం! మీరు పూర్తి హాజరు విధానాన్ని విజయవంతంగా నేర్చుకున్నారు. మీరు అధికారికంగా సర్టిఫై అయ్యారు!'
      },
      kn: {
        title: 'ಪ್ರಮಾಣೀಕೃತ ಉದ್ಯೋಗಿ!',
        badge: 'ಪ್ರಮಾಣೀಕೃತ • ಕರ್ತವ್ಯಕ್ಕೆ ಸಿದ್ಧ',
        subtitles: 'ಅಭಿನಂದನೆಗಳು! ನೀವು ಅಧಿಕೃತವಾಗಿ ಪ್ರಮಾಣೀಕೃತರಾಗಿದ್ದೀರಿ ಮತ್ತು ಕರ್ತವ್ಯಕ್ಕೆ ಸಿದ್ಧರಾಗಿದ್ದೀರಿ.',
        voice: 'ಅದ್ಭುತ! ನೀವು ಸಂಪೂರ್ಣ ಹಾಜರಾತಿ ಪ್ರಕ್ರಿಯೆಯನ್ನು ಯಶಸ್ವಿಯಾಗಿ ಕಲಿತಿದ್ದೀರಿ. ನೀವು ಅಧಿಕೃತವಾಗಿ ಪ್ರಮಾಣೀಕೃತರಾಗಿದ್ದೀರಿ!'
      }
    }
  }
];

export const LiveCoachOverlay: React.FC = () => {
  const { 
    isActive, 
    currentStepIndex, 
    skipTutorial, 
    nextStep,
    demoState
  } = useTutorialStore();

  const { user } = useAuthStore();

  const [lang, setLang] = useState<TutorialLanguage>(tutorialVoiceService.getLanguage());
  const [isMuted, setIsMuted] = useState(tutorialVoiceService.getMuted());
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [isScanningHud, setIsScanningHud] = useState(false);
  const [scanType, setScanType] = useState<'in' | 'out'>('in');
  const [toastFeedback, setToastFeedback] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  const stepIndex = Math.min(currentStepIndex, COACH_STEPS.length - 1);
  const currentStep = COACH_STEPS[stepIndex] || COACH_STEPS[0];
  const rawInfo = currentStep.content[lang] || currentStep.content.en;
  const currentCapturedTime = demoState?.firstEntryTime || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  const currentInfo = {
    ...rawInfo,
    subtitles: rawInfo.subtitles.replace(/09:00 AM|9:00 AM|09:00|9:00/g, currentCapturedTime),
    voice: rawInfo.voice.replace(/09:00 AM|9:00 AM|09:00|9:00/g, currentCapturedTime)
  };
  const isCompletedStep = currentStep.key === 'completed';

  const triggerHaptic = async (style: ImpactStyle = ImpactStyle.Medium) => {
    try {
      await Haptics.impact({ style });
    } catch (e) {
      // Ignore
    }
  };

  // Keep target rect synchronized with active DOM element
  const updateTargetRect = useCallback(() => {
    if (!isActive) return;
    if (isCompletedStep) {
      setTargetRect(null);
      return;
    }

    const el = document.getElementById(currentStep.targetId);
    if (el) {
      const rect = el.getBoundingClientRect();
      const inView = rect.top >= 100 && rect.bottom <= window.innerHeight - 80;
      if (!inView) {
        try {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } catch (e) {
          el.scrollIntoView();
        }
        setTimeout(() => { if (el) setTargetRect(el.getBoundingClientRect()); }, 150);
        setTimeout(() => { if (el) setTargetRect(el.getBoundingClientRect()); }, 400);
      } else {
        setTargetRect(rect);
      }
    } else {
      setTargetRect(null);
    }
  }, [isActive, isCompletedStep, currentStep.targetId]);

  useEffect(() => {
    if (!isActive) return;
    updateTargetRect();

    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
      updateTargetRect();
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', updateTargetRect, true);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', updateTargetRect, true);
    };
  }, [isActive, stepIndex, updateTargetRect]);

  // Voice playback on step or language change with smooth spacing
  useEffect(() => {
    if (isActive && !isScanningHud) {
      const timer = setTimeout(() => {
        tutorialVoiceService.playStep(currentStep.key, lang, currentInfo.voice);
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [isActive, stepIndex, lang, isScanningHud, currentStep.key, currentInfo.voice]);

  // Audio-completion aware countdown for informational steps (captured_time)
  useEffect(() => {
    if (!isActive || currentStep.key !== 'captured_time') {
      setCountdown(null);
      return;
    }

    let isSpeechComplete = false;
    let graceCountdown = 4;
    let fallbackTimeoutSeconds = 14;

    // Listen to voice service completion
    tutorialVoiceService.setOnStepEnded((step) => {
      if (step === 'captured_time') {
        isSpeechComplete = true;
        setCountdown(graceCountdown);
      }
    });

    const interval = setInterval(() => {
      if (isSpeechComplete) {
        graceCountdown -= 1;
        setCountdown(graceCountdown > 0 ? graceCountdown : 0);
        if (graceCountdown <= 0) {
          clearInterval(interval);
          nextStep();
        }
      } else {
        fallbackTimeoutSeconds -= 1;
        if (fallbackTimeoutSeconds <= 0) {
          clearInterval(interval);
          nextStep();
        }
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      tutorialVoiceService.setOnStepEnded(null);
    };
  }, [isActive, stepIndex, currentStep.key, nextStep]);

  // Listen to voice state change
  useEffect(() => {
    tutorialVoiceService.setOnSpeakingChange((speaking) => {
      setIsSpeaking(speaking);
    });
    return () => {
      tutorialVoiceService.stop();
    };
  }, []);

  const handleLanguageChange = (newLang: TutorialLanguage) => {
    setLang(newLang);
    tutorialVoiceService.setLanguage(newLang);
    triggerHaptic(ImpactStyle.Light);
  };

  const toggleMute = () => {
    const muted = tutorialVoiceService.toggleMuted();
    setIsMuted(muted);
    triggerHaptic(ImpactStyle.Light);
    if (!muted) {
      tutorialVoiceService.playChime('start');
    }
  };

  // Perform simulated face scanning HUD
  const triggerFaceScanSimulation = (type: 'in' | 'out', nextStepIndex: number) => {
    triggerHaptic(ImpactStyle.Heavy);
    tutorialVoiceService.playChime('start');
    setScanType(type);
    setIsScanningHud(true);

    setTimeout(() => {
      setIsScanningHud(false);
      triggerHaptic(ImpactStyle.Heavy);
      tutorialVoiceService.playChime('success');
      
      if (type === 'in') {
        const actualTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        useTutorialStore.getState().setDemoState({
          isCheckedIn: true,
          siteWorkMode: 'duty',
          isSiteCheckedIn: false,
          isOnBreak: false,
          firstEntryTime: actualTime
        });
        setToastFeedback(`✓ Face & GPS Verified • Shift Punch In (${actualTime})`);
      } else {
        const exitTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        useTutorialStore.getState().setDemoState({
          isCheckedIn: false,
          isOnBreak: false,
          isSiteCheckedIn: false,
          lastExitTime: exitTime
        });
        setToastFeedback(`✓ Shift Checkout Verified • ${exitTime}`);
      }

      // Advance currentStepIndex immediately so the overlay does not linger on previous punch step
      useTutorialStore.setState({ currentStepIndex: nextStepIndex });

      setTimeout(() => {
        setToastFeedback(null);
      }, 1500);
    }, 1300);
  };

  // Handle direct tap on the target element
  const handleAction = (actionKey: string) => {
    triggerHaptic(ImpactStyle.Heavy);

    switch (actionKey) {
      case 'tap_punch_in':
        triggerFaceScanSimulation('in', 1);
        break;

      case 'continue_from_captured_time':
        nextStep();
        break;

      case 'tap_duty_regular':
        tutorialVoiceService.playChime('success');
        useTutorialStore.getState().setDemoState({ siteWorkMode: 'duty' });
        setToastFeedback('✓ Regular Duty Selected (Standard Assigned Shift)');
        setTimeout(() => {
          setToastFeedback(null);
          nextStep();
        }, 1300);
        break;

      case 'tap_duty_site':
      case 'tap_duty_mode':
        tutorialVoiceService.playChime('success');
        useTutorialStore.getState().setDemoState({ siteWorkMode: 'ot' });
        setToastFeedback('✓ Site Relieving / Overtime Duty Selected');
        setTimeout(() => {
          setToastFeedback(null);
          nextStep();
        }, 1300);
        break;

      case 'tap_site_in':
        tutorialVoiceService.playChime('success');
        useTutorialStore.getState().setDemoState({ isSiteCheckedIn: true });
        setToastFeedback('✓ Check In Logged — Manyata Tech Park');
        setTimeout(() => {
          setToastFeedback(null);
          nextStep();
        }, 1300);
        break;

      case 'tap_site_out':
        tutorialVoiceService.playChime('success');
        useTutorialStore.getState().setDemoState({ isSiteCheckedIn: false });
        setToastFeedback('✓ Check Out Logged — Site Visit Completed');
        setTimeout(() => {
          setToastFeedback(null);
          nextStep();
        }, 1300);
        break;

      case 'tap_take_break': {
        tutorialVoiceService.playChime('alert');
        const breakTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        useTutorialStore.getState().setDemoState({ isOnBreak: true, firstBreakInTime: breakTime });
        setToastFeedback('☕ Break Started — Duty Timer Paused');
        setTimeout(() => {
          setToastFeedback(null);
          nextStep();
        }, 1300);
        break;
      }

      case 'tap_resume_work': {
        tutorialVoiceService.playChime('success');
        const resumeTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        useTutorialStore.getState().setDemoState({ isOnBreak: false, isSiteCheckedIn: false, lastBreakOutTime: resumeTime });
        setToastFeedback('✓ Break Ended — Active Duty Resumed');
        setTimeout(() => {
          setToastFeedback(null);
          nextStep();
        }, 1300);
        break;
      }

      case 'tap_punch_out':
        triggerFaceScanSimulation('out', COACH_STEPS.length - 1);
        break;

      case 'finish':
        tutorialVoiceService.playChime('success');
        tutorialVoiceService.stop();
        useTutorialStore.getState().resetDemoState();
        skipTutorial();
        break;

      default:
        nextStep();
        break;
    }
  };

  // Skip handler that auto-applies current stage, shows feedback, stops voice, and moves forward
  const handleSkipStep = () => {
    triggerHaptic(ImpactStyle.Light);
    tutorialVoiceService.stop();

    const getSkipToast = (key: string) => {
      switch (key) {
        case 'intro': return '✓ Auto-applied: Shift Punched In';
        case 'captured_time': return '✓ Verified Punch Timestamp';
        case 'duty_mode': return '✓ Regular Duty Selected';
        case 'site_in': return '✓ Site Arrival Logged';
        case 'site_out': return '✓ Site Visit Completed';
        case 'break_in': return '✓ Break Started (Duty Paused)';
        case 'break_out': return '✓ Break Ended (Duty Resumed)';
        case 'punch_out': return '✓ Shift Checkout Completed';
        default: return null;
      }
    };

    const toast = getSkipToast(currentStep.key);
    if (toast) {
      setToastFeedback(toast);
      setTimeout(() => setToastFeedback(null), 1200);
    }

    nextStep();
  };

  // Listen to custom coach actions from interactive sub-buttons
  useEffect(() => {
    if (!isActive) return;
    const handleCoachCustomEvent = (e: any) => {
      const act = e.detail?.action;
      if (act) {
        handleAction(act);
      }
    };
    window.addEventListener('coach-action', handleCoachCustomEvent);
    return () => {
      window.removeEventListener('coach-action', handleCoachCustomEvent);
    };
  }, [isActive]);

  // Listen to user tap directly on the real target element in DOM
  useEffect(() => {
    if (!isActive || isCompletedStep || currentStep.key === 'duty_mode' || currentStep.key === 'captured_time') return;

    const el = document.getElementById(currentStep.targetId);
    if (!el) return;

    const handleTargetClick = (e: Event) => {
      e.stopPropagation();
      e.preventDefault();
      handleAction(currentStep.expectedAction);
    };

    el.addEventListener('click', handleTargetClick, { capture: true });
    return () => {
      el.removeEventListener('click', handleTargetClick, { capture: true });
    };
  }, [isActive, isCompletedStep, currentStep.targetId, currentStep.expectedAction, currentStep.key, stepIndex]);

  if (!isActive) return null;

  const padding = 10;
  const targetCenterY = targetRect ? targetRect.top + targetRect.height / 2 : windowSize.height / 2;
  const isTargetInBottomHalf = targetCenterY > windowSize.height / 2;
  const isTargetInTopSection = (targetRect && targetRect.top < 300) || currentStep.key === 'captured_time';

  // Dynamic Single-Row Action Label
  const getActionPillText = () => {
    switch (currentStep.key) {
      case 'captured_time': return `CAPTURED TIME: ${currentCapturedTime}`;
      case 'duty_mode': return 'CHOOSE REGULAR OR SITE DUTY';
      case 'site_in': return 'TAP CHECK IN';
      case 'site_out': return 'TAP CHECK OUT';
      case 'break_in': return 'TAP TAKE BREAK';
      case 'break_out': return 'TAP RESUME WORK';
      case 'punch_in':
      case 'intro': return 'TAP PUNCH IN';
      case 'punch_out': return 'TAP PUNCH OUT';
      default: return 'TAP THIS BUTTON';
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] overflow-hidden pointer-events-none select-none font-sans">
      {/* ── Adaptive Top / Bottom Coach Bar & Subtitle Capsule ── */}
      <header className={`z-[100002] pointer-events-auto bg-[#041c12]/95 backdrop-blur-2xl shadow-2xl flex flex-col gap-2.5 max-w-lg mx-auto transition-all duration-300 ${
        isTargetInTopSection 
          ? 'fixed bottom-3 inset-x-3 rounded-3xl border border-emerald-500/40 p-3.5 shadow-emerald-950/90' 
          : 'fixed top-0 inset-x-0 border-b border-emerald-500/30 px-3.5 pt-10 pb-3'
      }`}>
        <div className="flex items-center justify-between">
          {/* Coach Avatar & Step Pill */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center text-emerald-300 shadow-md shadow-emerald-500/20">
              <Sparkles className="w-4 h-4 text-emerald-300 animate-spin-slow" />
            </div>
            <div>
              <span className="text-xs font-black text-white tracking-wide block">
                {currentInfo.badge}
              </span>
              <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                {currentInfo.title}
              </span>
            </div>
          </div>

          {/* Right Controls: Audio Replay, Mute, Exit */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                triggerHaptic(ImpactStyle.Light);
                tutorialVoiceService.playStep(currentStep.key, lang, currentInfo.voice);
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-[11px] font-bold text-emerald-200 active:scale-95 transition-all shadow-sm cursor-pointer"
              title="Replay Voice"
            >
              <Volume2 className={`w-3.5 h-3.5 ${isSpeaking ? 'text-emerald-300 animate-pulse' : 'text-slate-300'}`} />
              <span>{isSpeaking ? '...' : (lang === 'ta' ? 'தமிழ்' : lang === 'te' ? 'తెలుగు' : lang === 'kn' ? 'ಕನ್ನಡ' : lang === 'hi' ? 'हिन्दी' : 'Audio')}</span>
            </button>

            <button
              onClick={toggleMute}
              className="p-1.5 rounded-xl bg-white/5 border border-white/10 text-emerald-300 hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX className="w-3.5 h-3.5 text-slate-400" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-300" />}
            </button>

            <button
              onClick={() => {
                tutorialVoiceService.stop();
                skipTutorial();
              }}
              className="p-1.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 active:scale-95 transition-all ml-0.5 cursor-pointer"
              title="Exit Tour"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 5-Language Selector Ribbon */}
        <div className="grid grid-cols-5 bg-black/60 p-1 rounded-xl border border-emerald-500/30 gap-1">
          {[
            { code: 'en', label: 'EN' },
            { code: 'hi', label: 'हिन्दी' },
            { code: 'ta', label: 'தமிழ்' },
            { code: 'te', label: 'తెలుగు' },
            { code: 'kn', label: 'ಕನ್ನಡ' }
          ].map((l) => (
            <button
              key={l.code}
              onClick={() => handleLanguageChange(l.code as TutorialLanguage)}
              className={`py-1 rounded-lg text-[11px] font-black transition-all text-center truncate px-1 cursor-pointer ${
                lang === l.code
                  ? 'bg-gradient-to-r from-emerald-400 to-teal-400 text-slate-950 font-black shadow-md ring-1 ring-emerald-300'
                  : 'text-slate-300 hover:text-white bg-white/5'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>

        {/* Dynamic Spoken Subtitle Banner with Countdown */}
        <motion.div 
          key={currentStep.key + lang}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-2.5 rounded-xl bg-gradient-to-r from-emerald-950/90 to-[#06241a]/90 border border-emerald-500/40 shadow-inner flex items-center gap-2"
        >
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
          <p className="text-xs text-emerald-100 font-medium leading-snug flex-1">
            {currentInfo.subtitles}
          </p>
          {countdown !== null ? (
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 shrink-0">
              {countdown}s
            </span>
          ) : isSpeaking ? (
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0 animate-pulse">
              🔊 Playing...
            </span>
          ) : null}
        </motion.div>
      </header>

      {/* ── Translucent Backdrop with Cutout Spotlight ── */}
      <svg className="absolute inset-0 w-full h-full pointer-events-auto" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <mask id="coach-spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {targetRect && (
              <rect
                x={Math.max(4, targetRect.left - padding)}
                y={Math.max(4, targetRect.top - padding)}
                width={targetRect.width + padding * 2}
                height={targetRect.height + padding * 2}
                rx={targetRect.width > 120 ? Math.min(36, (targetRect.height + padding * 2) / 2) : 24}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(4, 27, 15, 0.82)"
          mask="url(#coach-spotlight-mask)"
        />
      </svg>

      {/* ── Pulsing Halo & Animated Finger Pointer Directly on Target ── */}
      {targetRect && !isCompletedStep && !toastFeedback && !isScanningHud && (
        <div
          className="fixed pointer-events-none transition-all duration-300 ease-out z-[100000]"
          style={{
            left: Math.max(4, targetRect.left - padding),
            top: Math.max(4, targetRect.top - padding),
            width: targetRect.width + padding * 2,
            height: targetRect.height + padding * 2,
            borderRadius: targetRect.width > 120 ? Math.min(36, (targetRect.height + padding * 2) / 2) : 24
          }}
        >
          {/* Neon Halo */}
          <div className="absolute inset-0 rounded-[inherit] border-2 border-emerald-400 shadow-[0_0_40px_rgba(52,211,153,0.9)] animate-pulse" />
          <div className="absolute -inset-2 rounded-[inherit] border border-emerald-300/40 blur-xs" />

          {/* Captured Time: Informational verified log display (NOT a clickable action) */}
          {currentStep.key === 'captured_time' ? (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`absolute left-1/2 -translate-x-1/2 pointer-events-none z-[100001] flex flex-col items-center gap-1 ${
                isTargetInBottomHalf ? '-top-12' : '-bottom-12'
              }`}
            >
              <div className="px-3.5 py-1.5 rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-300 text-slate-950 text-[11px] font-black uppercase tracking-wider shadow-2xl flex items-center gap-1.5 ring-2 ring-emerald-300 whitespace-nowrap drop-shadow-lg">
                <Check className="w-3.5 h-3.5 stroke-[3] text-slate-950" />
                <span>{getActionPillText()}</span>
              </div>
            </motion.div>
          ) : (
            /* Animated Hand Pointer & Badge directly pointing at the target button */
            <motion.div
              animate={{ 
                y: isTargetInBottomHalf ? [-4, 6, -4] : [4, -6, 4],
              }}
              transition={{ duration: 1.0, repeat: Infinity, ease: "easeInOut" }}
              className={`absolute left-1/2 -translate-x-1/2 pointer-events-none z-[100001] flex flex-col items-center gap-1 ${
                isTargetInBottomHalf ? '-top-16' : '-bottom-16 flex-col-reverse'
              }`}
            >
              {/* 1-Row Instruction Pill */}
              <div className="px-3.5 py-1.5 rounded-full bg-gradient-to-r from-amber-400 via-emerald-400 to-teal-300 text-slate-950 text-[11px] font-black uppercase tracking-wider shadow-2xl flex items-center gap-1.5 ring-2 ring-emerald-300 whitespace-nowrap drop-shadow-lg">
                <span>{getActionPillText()}</span>
              </div>

              {/* Prominent Pointing Hand Symbol */}
              <div className="relative flex items-center justify-center">
                <motion.span 
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
                  className="text-3xl sm:text-4xl filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)] select-none leading-none block"
                >
                  {isTargetInBottomHalf ? '👇' : '👆'}
                </motion.span>
                {/* Tap Pulse Beacon */}
                <div className={`absolute w-3 h-3 rounded-full bg-emerald-400 animate-ping opacity-75 ${
                  isTargetInBottomHalf ? '-bottom-1' : '-top-1'
                }`} />
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* ── Transparent Clickable Hitbox Over Target (Single button targets only, not informational cards) ── */}
      {targetRect && !isCompletedStep && currentStep.key !== 'duty_mode' && currentStep.key !== 'captured_time' && !toastFeedback && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            handleAction(currentStep.expectedAction);
          }}
          className="fixed cursor-pointer z-[100001] active:scale-95 transition-transform pointer-events-auto"
          style={{
            left: Math.max(4, targetRect.left - padding),
            top: Math.max(4, targetRect.top - padding),
            width: targetRect.width + padding * 2,
            height: targetRect.height + padding * 2,
            borderRadius: targetRect.width > 120 ? Math.min(36, (targetRect.height + padding * 2) / 2) : 24
          }}
          title="Tap this button"
        />
      )}

      {/* ── Dual Interactive Hitboxes for Duty Mode Selection (Left: Regular Duty, Right: Site Duty) ── */}
      {targetRect && !isCompletedStep && currentStep.key === 'duty_mode' && (
        <div
          className="fixed z-[100001] flex pointer-events-auto"
          style={{
            left: Math.max(4, targetRect.left - padding),
            top: Math.max(4, targetRect.top - padding),
            width: targetRect.width + padding * 2,
            height: targetRect.height + padding * 2,
            borderRadius: 20
          }}
        >
          <div
            onClick={(e) => {
              e.stopPropagation();
              handleAction('tap_duty_regular');
            }}
            className="w-1/2 h-full cursor-pointer active:scale-95 transition-transform flex items-center justify-center"
            title="Select Regular Duty"
          />
          <div
            onClick={(e) => {
              e.stopPropagation();
              handleAction('tap_duty_site');
            }}
            className="w-1/2 h-full cursor-pointer active:scale-95 transition-transform flex items-center justify-center"
            title="Select Site Duty"
          />
        </div>
      )}

      {/* ── Floating Skip / Next Step Action (Thumb-friendly Bottom Right) ── */}
      {!isCompletedStep && (
        <div
          className={`fixed inset-x-0 pointer-events-none z-[100003] max-w-lg mx-auto px-5 flex justify-end transition-all duration-300 ${
            isTargetInTopSection ? 'bottom-52 sm:bottom-56' : 'bottom-28'
          }`}
        >
          <motion.button
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.94 }}
            onClick={handleSkipStep}
            className="pointer-events-auto flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-gradient-to-r from-amber-500/25 to-amber-600/30 hover:from-amber-500/35 hover:to-amber-600/40 border border-amber-400/50 text-xs font-bold text-amber-200 shadow-xl shadow-black/60 backdrop-blur-md cursor-pointer ring-1 ring-amber-400/30 hover:ring-amber-400/60 active:scale-95 transition-all"
            title="Skip to Next Step"
          >
            <span>{countdown !== null ? `Next (${countdown}s)` : 'Skip'}</span>
            <ChevronRight className="w-4 h-4 text-amber-300" />
          </motion.button>
        </div>
      )}

      {/* ── Action Toast Feedback Banner ── */}
      <AnimatePresence>
        {toastFeedback && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`fixed left-1/2 -translate-x-1/2 z-[100005] w-[90%] max-w-md p-3 rounded-2xl bg-emerald-400 text-slate-950 font-black text-xs text-center shadow-2xl flex items-center justify-center gap-2 border-2 border-emerald-200 transition-all ${
              isTargetInTopSection ? 'top-20' : 'top-[215px] sm:top-[225px]'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 text-slate-950 shrink-0" />
            <span>{toastFeedback}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Final Certification Modal with 3D Clapping & Thumbs-Up Character ── */}
      {isCompletedStep && (
        <motion.div
          initial={{ opacity: 0, scale: 0.88, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          className="fixed z-[100002] pointer-events-auto inset-x-4 top-1/2 -translate-y-1/2 max-w-md mx-auto"
        >
          <div className="p-6 rounded-3xl bg-gradient-to-br from-[#072f22] via-[#05241b] to-[#03170e] border-2 border-emerald-400 text-center shadow-2xl relative overflow-hidden ring-4 ring-emerald-500/20">
            
            {/* Background Confetti & Sparkles */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="absolute -top-24 -right-24 w-48 h-48 rounded-full bg-gradient-to-br from-emerald-400/20 to-teal-300/0 blur-2xl"
              />
              <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                className="absolute -bottom-24 -left-24 w-48 h-48 rounded-full bg-gradient-to-tr from-amber-400/20 to-emerald-300/0 blur-2xl"
              />
            </div>

            {/* ── Animated 3D Mascot Character (Cheering, Clapping 👏 & Thumbs-Up 👍) ── */}
            <div className="relative mb-3 flex flex-col items-center justify-center">
              <motion.div
                animate={{ 
                  y: [0, -8, 0],
                  rotate: [-2, 2, -2]
                }}
                transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-emerald-400 via-teal-300 to-amber-300 p-1 shadow-xl shadow-emerald-500/30 flex items-center justify-center ring-4 ring-emerald-300/30"
              >
                {/* Character Face / Body */}
                <div className="w-full h-full rounded-[22px] bg-[#05241b] flex flex-col items-center justify-center relative overflow-hidden border border-emerald-300/50">
                  {/* Glowing Character Eyes */}
                  <div className="flex items-center gap-3.5 mb-1.5">
                    <motion.div 
                      animate={{ scaleY: [1, 1, 0.1, 1] }}
                      transition={{ duration: 2.5, repeat: Infinity }}
                      className="w-2.5 h-3 rounded-full bg-emerald-300 shadow-[0_0_8px_#34d399]"
                    />
                    <motion.div 
                      animate={{ scaleY: [1, 1, 0.1, 1] }}
                      transition={{ duration: 2.5, repeat: Infinity }}
                      className="w-2.5 h-3 rounded-full bg-emerald-300 shadow-[0_0_8px_#34d399]"
                    />
                  </div>
                  {/* Happy Smile */}
                  <div className="w-6 h-2.5 rounded-b-full border-b-2 border-amber-300" />

                  {/* Star Badge on Forehead */}
                  <span className="absolute top-1 text-[10px]">⭐</span>
                </div>

                {/* Left Arm: Animated Clapping Hand 👏 */}
                <motion.div
                  animate={{ 
                    x: [-4, 2, -4],
                    rotate: [-15, 10, -15]
                  }}
                  transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute -left-6 top-6 text-2xl filter drop-shadow-md select-none"
                >
                  👏
                </motion.div>

                {/* Right Arm: Animated Thumbs-Up 👍 */}
                <motion.div
                  animate={{ 
                    y: [-2, 4, -2],
                    rotate: [10, -10, 10],
                    scale: [1, 1.15, 1]
                  }}
                  transition={{ duration: 0.7, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute -right-6 top-5 text-2xl filter drop-shadow-md select-none"
                >
                  👍
                </motion.div>
              </motion.div>

              {/* Floating Party Emojis */}
              <div className="flex items-center gap-2 mt-2">
                <span className="text-sm animate-bounce delay-100">🎉</span>
                <span className="text-xs font-black uppercase tracking-widest text-amber-300 bg-amber-400/20 px-2.5 py-0.5 rounded-full border border-amber-400/40">
                  GREAT JOB!
                </span>
                <span className="text-sm animate-bounce delay-200">🏆</span>
              </div>
            </div>

            <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10px] font-black uppercase tracking-widest inline-block mb-1.5">
              Official Paradigm Verification
            </span>

            <h3 className="text-xl font-black text-white tracking-tight">
              {currentInfo.title}
            </h3>

            <p className="text-xs text-emerald-200/90 mt-1.5 leading-relaxed">
              {currentInfo.subtitles}
            </p>

            <div className="my-3.5 p-3 rounded-2xl bg-black/40 border border-emerald-500/20 text-left text-xs space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Employee:</span>
                <span className="text-white font-bold">{user?.name || 'Sudhan M.'}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Role Verified:</span>
                <span className="text-emerald-300 font-bold uppercase">{user?.role || 'Site Staff'}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Attendance Status:</span>
                <span className="text-emerald-400 font-black">Certified 100%</span>
              </div>
            </div>

            {/* Complete and Open Live App CTA */}
            <button
              onClick={() => handleAction('finish')}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-400 via-teal-400 to-amber-300 hover:from-emerald-300 hover:to-amber-200 text-slate-950 font-black text-sm uppercase tracking-wider active:scale-95 shadow-xl shadow-emerald-950/60 transition-all flex items-center justify-center gap-2 cursor-pointer ring-2 ring-emerald-300/40"
            >
              <Check className="w-4 h-4" />
              <span>Complete & Open Live App</span>
            </button>
          </div>
        </motion.div>
      )}

      {/* ── High-Tech Facial Biometric HUD Scanner Modal ── */}
      <AnimatePresence>
        {isScanningHud && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100010] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-white"
          >
            <div className="relative w-64 h-64 rounded-full border-2 border-dashed border-emerald-400/60 flex items-center justify-center overflow-hidden">
              <motion.div
                animate={{ y: [-120, 120, -120] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_15px_#34d399]"
              />
              <Scan className="w-20 h-20 text-emerald-400/50 animate-pulse" />
            </div>
            <div className="mt-6 flex flex-col items-center gap-1.5">
              <span className="text-xs font-black uppercase tracking-[0.25em] text-emerald-400 animate-pulse">
                {scanType === 'in' ? 'Biometric Face Check-in' : 'Biometric Face Check-out'}
              </span>
              <span className="text-[11px] text-slate-400 font-medium">
                Hold still • Scanning facial features & GPS location
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
