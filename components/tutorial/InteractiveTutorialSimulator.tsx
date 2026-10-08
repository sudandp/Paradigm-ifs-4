import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  Volume2, 
  VolumeX, 
  X, 
  CheckCircle2, 
  MapPin, 
  Coffee, 
  ShieldCheck, 
  LogIn, 
  LogOut, 
  Compass, 
  Lock, 
  ArrowRight, 
  RotateCcw,
  Clock,
  Check,
  Scan,
  Radio,
  Award,
  Globe,
  AlertTriangle,
  FileText,
  Send,
  UserCheck
} from 'lucide-react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { useTutorialStore } from '../../store/tutorialStore';
import { tutorialVoiceService, TutorialLanguage } from '../../services/tutorialVoiceService';

type SimStep = 
  | 'intro'
  | 'punch_in' 
  | 'duty_mode' 
  | 'site_in' 
  | 'site_out' 
  | 'break_in' 
  | 'break_out' 
  | 'punch_out' 
  | 'correction'
  | 'completed';

interface LocalizedStepContent {
  title: string;
  subtitle: string;
  instruction: string;
  voice: string;
}

const STEP_CONTENT: Record<SimStep, Record<TutorialLanguage, LocalizedStepContent>> = {
  intro: {
    en: {
      title: 'Paradigm Hands-On Operations Guide',
      subtitle: 'Interactive Onboarding • Guided System Orientation',
      instruction: 'Tap "Start Walkthrough" below to begin the step-by-step interactive guide.',
      voice: 'Welcome to Paradigm! Let\'s walk through how your daily shift works. We will cover Punch In, Site In, Site Out, Breaks, and Punch Out together. Tap Start to begin.'
    },
    hi: {
      title: 'पैराडाइम ऑपरेशन्स गाइड (ऑनबोर्डिंग मोड)',
      subtitle: 'इंटरएक्टिव गाइड • निर्देशित सिस्टम ओरिएंटेशन',
      instruction: 'इंटरएक्टिव वॉकथ्रू शुरू करने के लिए नीचे "शुरू करें" पर टैप करें।',
      voice: 'पैराडाइम में आपका स्वागत है! आइए समझें कि आपकी दैनिक ड्यूटी कैसे काम करती है। हम पंच इन, साइट इन, साइट आउट, ब्रेक और पंच आउट को देखेंगे। शुरू करने के लिए स्टार्ट पर टैप करें।'
    },
    ta: {
      title: 'பாராடிக்ம் நேரடி வழிகாட்டி',
      subtitle: 'நேரடி வழிகாட்டி • கணினி அறிமுகம்',
      instruction: 'நேரடி வழிகாட்டியை தொடங்க கீழே உள்ள "தொடங்கு" பட்டனை தட்டவும்.',
      voice: 'பாராடிக்மிற்கு அன்புடன் வரவேற்கிறோம்! உங்கள் தினசரி பணி எவ்வாறு செயல்படுகிறது என்பதை இப்போது பார்ப்போம். தொடங்க ஸ்டார்ட் பட்டனை அழுத்தவும்.'
    },
    te: {
      title: 'పారడైమ్ ఆపరేషన్స్ గైడ్ (ఆన్‌బోర్డింగ్)',
      subtitle: 'ఇంటరాక్టివ్ గైడ్ • సిస్టమ్ ఓరియంటేషన్',
      instruction: 'ఇంటరాక్టివ్ వాక్‌త్రూ ప్రారంభించడానికి క్రింద "ప్రారంభించండి" పై నొక్కండి.',
      voice: 'పారడైమ్‌కు స్వాగతం! మీ రోజువారీ డ్యూటీ ఎలా పనిచేస్తుందో ఇప్పుడు చూద్దాం. పంచ్ ఇన్, సైట్ ఇన్, సైట్ అవుట్, బ్రేక్స్ మరియు పంచ్ అవుట్ గురించి తెలుసుకుందాం.'
    },
    kn: {
      title: 'ಪ್ಯಾರಾಡೈಮ್ ಕಾರ್ಯಾಚರಣೆ ಮಾರ್ಗದರ್ಶಿ',
      subtitle: 'ಇಂಟರ್ಯಾಕ್ಟಿವ್ ಗೈಡ್ • ಸಿಸ್ಟಮ್ ಪರಿಚಯ',
      instruction: 'ಇಂಟರ್ಯಾಕ್ಟಿವ್ ಮಾರ್ಗದರ್ಶಿ ಪ್ರಾರಂಭಿಸಲು ಕೆಳಗಿನ "ಪ್ರಾರಂಭಿಸಿ" ಟ್ಯಾಪ್ ಮಾಡಿ.',
      voice: 'ಪ್ಯಾರಾಡೈಮ್‌ಗೆ ಸುಸ್ವಾಗತ! ನಿಮ್ಮ ದೈನಂದಿನ ಕರ್ತವ್ಯ ಹೇಗೆ ಕಾರ್ಯನಿರ್ವಹಿಸುತ್ತದೆ ಎಂಬುದನ್ನು ಈಗ ತಿಳಿಯೋಣ. ಪಂಚ್ ಇನ್, ಸೈಟ್ ಇನ್, ಸೈಟ್ ಔಟ್, ಬ್ರೇಕ್ ಮತ್ತು ಪಂಚ್ ಔಟ್ ನೋಡೋಣ.'
    }
  },
  punch_in: {
    en: {
      title: 'Step 1: Shift Start (Punch In)',
      subtitle: 'Touch the green orb to record biometric / facial punch in',
      instruction: 'Tap the green glowing orb below to perform your biometric face & GPS check-in.',
      voice: 'Step one. When you arrive at work, start your shift by tapping the green Punch In orb. Go ahead and tap it now.'
    },
    hi: {
      title: 'चरण 1: ड्यूटी शुरू (पंच इन)',
      subtitle: 'बायोमेट्रिक या फेशियल पंच इन दर्ज करने के लिए हरे बटन को छुएं',
      instruction: 'बायोमेट्रिक फेशियल व जीपीएस पंच इन दर्ज करने के लिए नीचे हरे बटन पर टैप करें।',
      voice: 'पहला चरण। काम पर पहुंचने पर, हरे रंग के पंच इन बटन पर टैप करके अपनी शिफ्ट शुरू करें। इसे अभी टैप करें।'
    },
    ta: {
      title: 'படி 1: பணி தொடக்கம் (பஞ்ச் இன்)',
      subtitle: 'பணி தொடக்கத்தை பதிவு செய்ய பச்சை நிற பட்டனை தொடவும்',
      instruction: 'முக அங்கீகாரம் மற்றும் ஜிபிஎஸ் செக்-இன் செய்ய கீழே உள்ள பச்சை பட்டனை தட்டவும்.',
      voice: 'முதல் படி. பணிக்கு வந்ததும், பச்சை நிற பஞ்ச் இன் பட்டனை தட்டி உங்கள் பணியை தொடங்குங்கள். இப்போது தட்டவும்.'
    },
    te: {
      title: 'దశ 1: షిఫ్ట్ ప్రారంభం (పంచ్ ఇన్)',
      subtitle: 'ఫేసియల్ లేదా జీపీఎస్ చెక్-ఇన్ చేయడానికి ఆకుపచ్చ బటన్‌ను తాకండి',
      instruction: 'బయోమెట్రిక్ ఫేస్ మరియు జీపీఎస్ చెక్-ఇన్ చేయడానికి క్రింద ఉన్న ఆకుపచ్చ బటన్‌ను నొక్కండి.',
      voice: 'మొదటి దశ. విధికి వచ్చినప్పుడు, ఆకుపచ్చ పంచ్ ఇన్ బటన్‌ను నొక్కి మీ షిఫ్ట్‌ను ప్రారంభించండి.'
    },
    kn: {
      title: 'ಹಂತ 1: ಕರ್ತವ್ಯ ಪ್ರಾರಂಭ (ಪಂಚ್ ಇನ್)',
      subtitle: 'ಮುಖ ಗುರುತಿಸುವಿಕೆ ಅಥವಾ ಜಿಪಿಎಸ್ ಮೂಲಕ ಹಾಜರಾತಿ ದಾಖಲಿಸಲು ಹಸಿರು ಬಟನ್ ಒತ್ತಿ',
      instruction: 'ಮುಖ ಗುರುತಿಸುವಿಕೆ ಮೂಲಕ ಪಂಚ್ ಇನ್ ಮಾಡಲು ಕೆಳಗಿನ ಹಸಿರು ಬಟನ್ ಟ್ಯಾಪ್ ಮಾಡಿ.',
      voice: 'ಮೊದಲ ಹಂತ. ಕೆಲಸಕ್ಕೆ ಬಂದಾಗ, ಹಸಿರು ಪಂಚ್ ಇನ್ ಬಟನ್ ಒತ್ತಿ ನಿಮ್ಮ ಶಿಫ್ಟ್ ಪ್ರಾರಂಭಿಸಿ.'
    }
  },
  duty_mode: {
    en: {
      title: 'Step 2: Choose Duty Mode',
      subtitle: 'Select Regular Duty vs Site Duty',
      instruction: 'Tap "Site Duty" below to set your duty mode.',
      voice: 'Great job! Your shift is now active. You can switch between Regular Duty and Site Duty. Try tapping the Site Duty button.'
    },
    hi: {
      title: 'चरण 2: ड्यूटी मोड चुनें',
      subtitle: 'रेगुलर ड्यूटी या साइट ड्यूटी का चयन करें',
      instruction: 'ड्यूटी मोड सेट करने के लिए नीचे "साइट ड्यूटी" पर टैप करें।',
      voice: 'शाबाश! आपकी शिफ्ट अब सक्रिय है। आप रेगुलर ड्यूटी और साइट ड्यूटी के बीच चयन कर सकते हैं। साइट ड्यूटी बटन दबाएं।'
    },
    ta: {
      title: 'படி 2: பணி முறையை தேர்வு செய்யவும்',
      subtitle: 'வழக்கமான பணி அல்லது சைட் டியூட்டி',
      instruction: 'பணி முறையை மாற்ற கீழே உள்ள "சைட் டியூட்டி" பட்டனை தட்டவும்.',
      voice: 'சிறப்பு! உங்கள் பணி தொடங்கியது. நீங்கள் ரெகுலர் டியூட்டி அல்லது சைட் டியூட்டி தேர்வு செய்யலாம். சைட் டியூட்டி பட்டனை அழுத்தவும்.'
    },
    te: {
      title: 'దశ 2: డ్యూటీ మోడ్ ఎంచుకోండి',
      subtitle: 'రెగ్యులర్ డ్యూటీ లేదా సైట్ డ్యూటీ',
      instruction: 'డ్యూటీ మోడ్ మార్చడానికి క్రింద "సైట్ డ్యూటీ" పై నొక్కండి.',
      voice: 'చాలా బాగుంది! మీ షిఫ్ట్ ప్రారంభమైంది. ఇప్పుడు సైట్ డ్యూటీ బటన్‌ను నొక్కండి.'
    },
    kn: {
      title: 'ಹಂತ 2: ಕರ್ತವ್ಯ ಮೋಡ್ ಆಯ್ಕೆಮಾಡಿ',
      subtitle: 'ರೆಗ್ಯುಲರ್ ಡ್ಯೂಟಿ ಅಥವಾ ಸೈಟ್ ಡ್ಯೂಟಿ',
      instruction: 'ಕರ್ತವ್ಯ ಮೋಡ್ ಬದಲಾಯಿಸಲು ಕೆಳಗಿನ "ಸೈಟ್ ಡ್ಯೂಟಿ" ಟ್ಯಾಪ್ ಮಾಡಿ.',
      voice: 'ತುಂಬಾ ಒಳ್ಳೆಯದು! ನಿಮ್ಮ ಶಿಫ್ಟ್ ಪ್ರಾರಂಭವಾಗಿದೆ. ಈಗ ಸೈಟ್ ಡ್ಯೂಟಿ ಬಟನ್ ಒತ್ತಿರಿ.'
    }
  },
  site_in: {
    en: {
      title: 'Step 3: Client Site Arrival (Site In)',
      subtitle: 'Log arrival at a client facility or building',
      instruction: 'Tap "Site In" below to log a client site visit.',
      voice: 'When you arrive at a client property or facility, tap Check In to log your site arrival. Tap Site In now.'
    },
    hi: {
      title: 'चरण 3: क्लाइंट साइट आगमन (साइट इन)',
      subtitle: 'क्लाइंट बिल्डिंग या साइट पर पहुंचने पर दर्ज करें',
      instruction: 'क्लाइंट साइट पर आगमन दर्ज करने के लिए नीचे "साइट इन" पर टैप करें।',
      voice: 'जब आप किसी क्लाइंट बिल्डिंग या साइट पर पहुंचे, तो आगमन दर्ज करने के लिए साइट इन पर टैप करें।'
    },
    ta: {
      title: 'படி 3: சைட் வருகை (சைட் இன்)',
      subtitle: 'கிளையன்ட் கட்டிடத்திற்கு வரும்போது வருகையை பதிவு செய்க',
      instruction: 'கிளையன்ட் வருகையை பதிவு செய்ய கீழே உள்ள "சைட் இன்" பட்டனை தட்டவும்.',
      voice: 'நீங்கள் கிளையன்ட் வளாகத்திற்கு வந்ததும், சைட் இன் பட்டனை தட்டி வருகையை பதிவு செய்யுங்கள்.'
    },
    te: {
      title: 'దశ 3: సైట్ రాక (సైట్ ఇన్)',
      subtitle: 'క్లయింట్ బిల్డింగ్ లేదా సైట్‌కు వచ్చినప్పుడు నమోదు చేయండి',
      instruction: 'క్లయింట్ సైట్ రాకను నమోదు చేయడానికి క్రింద "సైట్ ఇన్" పై నొక్కండి.',
      voice: 'మీరు క్లయింట్ సైట్‌కు చేరుకున్నప్పుడు, సైట్ ఇన్ బటన్‌ను నొక్కి ఎంట్రీని నమోదు చేయండి.'
    },
    kn: {
      title: 'ಹಂತ 3: ಸೈಟ್‌ಗೆ ಆಗಮನ (ಸೈಟ್ ಇನ್)',
      subtitle: 'ಕ್ಲೈಂಟ್ ಸ್ಥಳ ಅಥವಾ ಬಿಲ್ಡಿಂಗ್‌ಗೆ ಬಂದಾಗ ದಾಖಲಿಸಿ',
      instruction: 'ಕ್ಲೈಂಟ್ ಸೈಟ್ ಆಗಮನವನ್ನು ದಾಖಲಿಸಲು ಕೆಳಗಿನ "ಸೈಟ್ ಇನ್" ಟ್ಯಾಪ್ ಮಾಡಿ.',
      voice: 'ನೀವು ಕ್ಲೈಂಟ್ ಸೈಟ್‌ಗೆ ತಲುಪಿದಾಗ, ಸೈಟ್ ಇನ್ ಬಟನ್ ಒತ್ತಿ ನಿಮ್ಮ ಆಗಮನವನ್ನು ದಾಖಲಿಸಿ.'
    }
  },
  site_out: {
    en: {
      title: 'Step 4: Client Site Departure (Site Out)',
      subtitle: 'Log departure when moving to the next property',
      instruction: 'Tap "Site Out" below to complete your client site visit.',
      voice: 'Excellent! You are now checked into the site. When your inspection or work is finished, tap Check Out to complete the visit.'
    },
    hi: {
      title: 'चरण 4: साइट प्रस्थान (साइट आउट)',
      subtitle: 'काम खत्म करके अगली साइट पर जाने से पहले दर्ज करें',
      instruction: 'साइट विजिट समाप्त करने के लिए नीचे "साइट आउट" पर टैप करें।',
      voice: 'बहुत बढ़िया! आप साइट में चेक इन हैं। काम पूरा होने के बाद, विजिट पूरा करने के लिए साइट आउट पर टैप करें।'
    },
    ta: {
      title: 'படி 4: சைட் புறப்பாடு (சைட் அவுட்)',
      subtitle: 'வேலை முடிந்ததும் சைட் புறப்பாட்டை பதிவு செய்க',
      instruction: 'விசிட்டை நிறைவு செய்ய கீழே உள்ள "சைட் அவுட்" பட்டனை தட்டவும்.',
      voice: 'அற்புதம்! உங்கள் ஆய்வு அல்லது வேலை முடிந்ததும், விசிட்டை முடிக்க சைட் அவுட் பட்டனை தட்டவும்.'
    },
    te: {
      title: 'దశ 4: సైట్ నుండి నిష్క్రమణ (సైట్ అవుట్)',
      subtitle: 'పని ముగిసిన తర్వాత సైట్ నుండి నిష్క్రమణను నమోదు చేయండి',
      instruction: 'సైట్ విజిట్ పూర్తి చేయడానికి క్రింద "సైట్ అవుట్" పై నొక్కండి.',
      voice: 'అద్భుతం! పని పూర్తయిన తర్వాత విజిట్ ముగించడానికి సైట్ అవుట్ నొక్కండి.'
    },
    kn: {
      title: 'ಹಂತ 4: ಸೈಟ್ ನಿರ್ಗಮನ (ಸೈಟ್ ಔಟ್)',
      subtitle: 'ಕೆಲಸ ಮುಗಿದ ನಂತರ ಸೈಟ್ ನಿರ್ಗಮನವನ್ನು ದಾಖಲಿಸಿ',
      instruction: 'ಸೈಟ್ ಭೇಟಿಯನ್ನು ಮುಕ್ತಾಯಗೊಳಿಸಲು ಕೆಳಗಿನ "ಸೈಟ್ ಔಟ್" ಟ್ಯಾಪ್ ಮಾಡಿ.',
      voice: 'ಉತ್ತಮ! ಕೆಲಸ ಮುಗಿದ ನಂತರ ಭೇಟಿಯನ್ನು ಪೂರ್ಣಗೊಳಿಸಲು ಸೈಟ್ ಔಟ್ ಒತ್ತಿರಿ.'
    }
  },
  break_in: {
    en: {
      title: 'Step 5: Lunch & Tea Breaks (Take Break)',
      subtitle: 'Pause your duty timer for compliant meal rest',
      instruction: 'Tap "Take Break" below to pause your duty session.',
      voice: 'Need a lunch or tea break? Tap Take Break to pause tracking. Try tapping Take Break now.'
    },
    hi: {
      title: 'चरण 5: भोजन और चाय अवकाश (टेक ब्रेक)',
      subtitle: 'लंच या चाय के समय अपने ड्यूटी टाइमर को रोकें',
      instruction: 'ड्यूटी रोकने के लिए नीचे "टेक ब्रेक" पर टैप करें।',
      voice: 'लंच या चाय का ब्रेक चाहिए? ट्रैकिंग रोकने के लिए टेक ब्रेक पर टैप करें।'
    },
    ta: {
      title: 'படி 5: மதிய உணவு / டீ இடைவேளை (பிரேக்)',
      subtitle: 'இடைவேளையின் போது பணி நேரத்தை நிறுத்தி வைக்கவும்',
      instruction: 'இடைவேளை எடுக்க கீழே உள்ள "டேக் பிரேக்" பட்டனை தட்டவும்.',
      voice: 'மதிய உணவு அல்லது டீ இடைவேளை தேவையா? இடைவேளையை தொடங்க டேக் பிரேக் பட்டனை தட்டவும்.'
    },
    te: {
      title: 'దశ 5: భోజనం మరియు టీ విరామం (టేక్ బ్రేక్)',
      subtitle: 'విరామ సమయంలో పని సమయాన్ని తాత్కాలికంగా ఆపండి',
      instruction: 'విరామం తీసుకోవడానికి క్రింద "టేక్ బ్రేక్" పై నొక్కండి.',
      voice: 'లంచ్ లేదా టీ బ్రేక్ కావాలా? టేక్ బ్రేక్ పై నొక్కండి.'
    },
    kn: {
      title: 'ಹಂತ 5: ಊಟ ಮತ್ತು ಟೀ ವಿರಾಮ (ಟೇಕ್ ಬ್ರೇಕ್)',
      subtitle: 'ವಿರಾಮದ ಸಮಯದಲ್ಲಿ ಕೆಲಸದ ಸಮಯವನ್ನು ನಿಲ್ಲಿಸಿ',
      instruction: 'ವಿರಾಮ ತೆಗೆದುಕೊಳ್ಳಲು ಕೆಳಗಿನ "ಟೇಕ್ ಬ್ರೇಕ್" ಟ್ಯಾಪ್ ಮಾಡಿ.',
      voice: 'ಊಟ ಅಥವಾ ಟೀ ವಿರಾಮ ಬೇಕೆ? ಟೇಕ್ ಬ್ರೇಕ್ ಬಟನ್ ಟ್ಯಾಪ್ ಮಾಡಿ.'
    }
  },
  break_out: {
    en: {
      title: 'Step 6: Return from Break (Resume Work)',
      subtitle: 'Restart active shift tracking when done',
      instruction: 'Tap "Resume Work" below to return from your break.',
      voice: 'Your break timer is now active. When you finish your break, tap Resume Work to continue your shift.'
    },
    hi: {
      title: 'चरण 6: ब्रेक से वापसी (रिज्यूम वर्क)',
      subtitle: 'ब्रेक समाप्त होने पर दोबारा ड्यूटी शुरू करें',
      instruction: 'ब्रेक से वापस ड्यूटी पर लौटने के लिए नीचे "रिज्यूम वर्क" पर टैप करें।',
      voice: 'आपका ब्रेक टाइमर चालू है। ब्रेक समाप्त होने पर, अपनी शिफ्ट जारी रखने के लिए रिज्यूम वर्क पर टैप करें।'
    },
    ta: {
      title: 'படி 6: பணிக்கு திரும்புதல் (ரெஸ்யூம் ஒர்க்)',
      subtitle: 'இடைவேளை முடிந்ததும் பணியை மீண்டும் தொடங்குக',
      instruction: 'மீண்டும் பணிக்கு திரும்ப கீழே உள்ள "ரெஸ்யூம் ஒர்க்" பட்டனை தட்டவும்.',
      voice: 'உங்கள் இடைவேளை முடிவடைந்ததும், பணியை தொடர ரெஸ்யூம் ஒர்க் பட்டனை தட்டவும்.'
    },
    te: {
      title: 'దశ 6: విరామం నుండి తిరుగు ప్రయాణం (రెజ్యూమ్ వర్క్)',
      subtitle: 'విరామం పూర్తయిన తర్వాత మళ్ళీ పనిని కొనసాగించండి',
      instruction: 'పనిని తిరిగి కొనసాగించడానికి క్రింద "రెజ్యూమ్ వర్క్" పై నొక్కండి.',
      voice: 'మీ విరామం పూర్తయినప్పుడు, పనిని కొనసాగించడానికి రెజ్యూమ్ వర్క్ నొక్కండి.'
    },
    kn: {
      title: 'ಹಂತ 6: ವಿರಾಮದಿಂದ ಮರಳುವುದು (ರೆಸ್ಯೂಮ್ ವರ್ಕ್)',
      subtitle: 'ವಿರಾಮ ಮುಗಿದ ನಂತರ ಮತ್ತೆ ಕೆಲಸ ಮುಂದುವರಿಸಿ',
      instruction: 'ಕೆಲಸವನ್ನು ಪುನರಾರಂಭಿಸಲು ಕೆಳಗಿನ "ರೆಸ್ಯೂಮ್ ವರ್ಕ್" ಟ್ಯಾಪ್ ಮಾಡಿ.',
      voice: 'ವಿರಾಮ ಮುಗಿದ ನಂತರ, ಕೆಲಸವನ್ನು ಮುಂದುವರಿಸಲು ರೆಸ್ಯೂಮ್ ವರ್ಕ್ ಒತ್ತಿರಿ.'
    }
  },
  punch_out: {
    en: {
      title: 'Step 6: Shift Completion (Punch Out)',
      subtitle: 'Complete your duty hours at the end of the day',
      instruction: 'Tap the red glowing orb below to complete punching out for the day.',
      voice: 'Finally, at the end of your workday, tap the red Punch Out orb to finish your shift. Tap it now to complete your shift.'
    },
    hi: {
      title: 'चरण 6: ड्यूटी समाप्ति (पंच आउट)',
      subtitle: 'दिन के अंत में अपने काम के घंटे पूरे करके पंच आउट करें',
      instruction: 'दिन की ड्यूटी समाप्त करने के लिए नीचे लाल बटन पर टैप करें।',
      voice: 'अंत में, दिन का काम समाप्त होने पर, अपनी शिफ्ट पूरी करने के लिए लाल पंच आउट बटन पर टैप करें।'
    },
    ta: {
      title: 'படி 6: பணி நிறைவு (பஞ்ச் அவுட்)',
      subtitle: 'நாள் முடிவில் உங்கள் பணி நேரத்தை நிறைவு செய்க',
      instruction: 'பணியை முடிக்க கீழே உள்ள சிவப்பு பஞ்ச் அவுட் பட்டனை தட்டவும்.',
      voice: 'இறுதியாக, பணி முடிந்ததும், உங்கள் ஷிப்டை முடிக்க சிவப்பு நிற பஞ்ச் அவுட் பட்டனை தட்டவும்.'
    },
    te: {
      title: 'దశ 6: షిఫ్ట్ ముగింపు (పంచ్ అవుట్)',
      subtitle: 'రోజు ముగింపులో మీ పని గంటలను పూర్తి చేయండి',
      instruction: 'పనిని పూర్తి చేయడానికి క్రింద ఎరుపు రంగు పంచ్ అవుట్ బటన్‌ను నొక్కండి.',
      voice: 'చివరిగా, రోజు పని పూర్తయినప్పుడు, షిఫ్ట్ ముగించడానికి ఎరుపు పంచ్ అవుట్ బటన్ నొక్కండి.'
    },
    kn: {
      title: 'ಹಂತ 6: ಕರ್ತವ್ಯ ಮುಕ್ತಾಯ (ಪಂಚ್ ಔಟ್)',
      subtitle: 'ದಿನದ ಕೊನೆಯಲ್ಲಿ ನಿಮ್ಮ ಕೆಲಸದ ಸಮಯವನ್ನು ಪೂರ್ಣಗೊಳಿಸಿ',
      instruction: 'ಕರ್ತವ್ಯ ಮುಗಿಸಲು ಕೆಳಗಿನ ಕೆಂಪು ಪಂಚ್ ಔಟ್ ಬಟನ್ ಟ್ಯಾಪ್ ಮಾಡಿ.',
      voice: 'ಕೊನೆಯದಾಗಿ, ದಿನದ ಕೆಲಸ ಮುಗಿದ ನಂತರ, ಶಿಫ್ಟ್ ಪೂರ್ಣಗೊಳಿಸಲು ಕೆಂಪು ಪಂಚ್ ಔಟ್ ಬಟನ್ ಒತ್ತಿರಿ.'
    }
  },
  correction: {
    en: {
      title: 'Step 7: Request Punch (Attendance Correction)',
      subtitle: 'Regularize missed punches to prevent loss of pay',
      instruction: 'If you forgot to punch out, you get 0 duty credit. Submit an Attendance Correction request below to regularize.',
      voice: 'What if you forgot to punch in or punch out? Your attendance will be marked as Missed Punch with zero duty credit. You can fix this by submitting an Attendance Correction request. You are allowed up to 3 corrections per month. Fill the form below and tap submit.'
    },
    hi: {
      title: 'चरण 7: मिस पंच सुधार (रिक्वेस्ट पंच)',
      subtitle: 'वेतन कटौती से बचने के लिए छूटे हुए पंच का अनुरोध करें',
      instruction: 'यदि आप पंच आउट भूल गए, तो 0 ड्यूटी लगती है। सुधार के लिए नीचे अटेंडेंस करेक्शन फॉर्म भरें।',
      voice: 'अगर आप पंच इन या पंच आउट करना भूल जाते हैं, तो आपको उस दिन शून्य ड्यूटी मिलेगी। इसे ठीक करने के लिए आप अटेंडेंस करेक्शन का अनुरोध कर सकते हैं। महीने में अधिकतम 3 करेक्शन की अनुमति है। नीचे फॉर्म भरकर सबमिट करें।'
    },
    ta: {
      title: 'படி 7: விடுபட்ட பஞ்ச் சரிசெய்தல் (ரிக்கவஸ்ட் பஞ்ச்)',
      subtitle: 'சம்பள இழப்பைத் தவிர்க்க விடுபட்ட பஞ்சை சரிசெய்யவும்',
      instruction: 'பஞ்ச் செய்ய மறந்துவிட்டால் பணி நேரம் பதிவாகாது. மேலாளரிடம் சரிசெய்ய கீழே உள்ள படிவத்தை சமர்ப்பிக்கவும்.',
      voice: 'பஞ்ச் இன் அல்லது பஞ்ச் அவுட் செய்ய மறந்துவிட்டால், அந்த நாளுக்கான சம்பள வரவு கிடைக்காது. இதனை சரிசெய்ய அட்டெண்டன்ஸ் கரெக்ஷன் விண்ணப்பிக்க வேண்டும். மாதத்திற்கு அதிகபட்சம் 3 முறை மட்டுமே அனுமதிக்கப்படும்.'
    },
    te: {
      title: 'దశ 7: మిస్ అయిన పంచ్ సవరణ (రిక్వెస్ట్ పంచ్)',
      subtitle: 'జీతం నష్టం రాకుండా మిస్ అయిన పంచ్‌ను క్రమబద్ధీకరించండి',
      instruction: 'మీరు పంచ్ అవుట్ చేయడం మరచిపోతే, 0 డ్యూటీ పడుతుంది. మేనేజర్ ఆమోదం కోసం క్రింద ఫారం సమర్పించండి.',
      voice: 'మీరు పంచ్ ఇన్ లేదా పంచ్ అవుట్ మర్చిపోతే జీతం నష్టం జరుగుతుంది. దీనిని సరిచేయడానికి మీరు అటెండెన్స్ కరెక్షన్ అప్లై చేయవచ్చు. నెలకు గరిష్టంగా 3 సార్లు మాత్రమే అవకాశం ఉంటుంది.'
    },
    kn: {
      title: 'ಹಂತ 7: ಮಿಸ್ ಆದ ಪಂಚ್ ಸರಿಪಡಿಸುವಿಕೆ (ರಿಕ್ವೆಸ್ಟ್ ಪಂಚ್)',
      subtitle: 'ವೇತನ ನಷ್ಟ ತಪ್ಪಿಸಲು ಮಿಸ್ ಆದ ಪಂಚ್ ಅನುಮೋದನೆಗೆ ವಿನಂತಿಸಿ',
      instruction: 'ನೀವು ಪಂಚ್ ಔಟ್ ಮಾಡಲು ಮರೆತರೆ 0 ಡ್ಯೂಟಿ ಬೀಳುತ್ತದೆ. ಸರಿಪಡಿಸಲು ಕೆಳಗಿನ ಅಟೆಂಡೆನ್ಸ್ ಕರೆಕ್ಷನ್ ಫಾರ್ಮ್ ಸಲ್ಲಿಸಿ.',
      voice: 'ನೀವು ಪಂಚ್ ಇನ್ ಅಥವಾ ಪಂಚ್ ಔಟ್ ಮಾಡಲು ಮರೆತರೆ ಆ ದಿನಕ್ಕೆ ಶೂನ್ಯ ಹಾಜರಾತಿ ಬೀಳುತ್ತದೆ. ಇದನ್ನು ಸರಿಪಡಿಸಲು ಅಟೆಂಡೆನ್ಸ್ ಕರೆಕ್ಷನ್ ರಿಕ್ವೆಸ್ಟ್ ಸಲ್ಲಿಸಬೇಕು. ತಿಂಗಳಿಗೆ ಗರಿಷ್ಠ 3 ಬಾರಿ ಮಾತ್ರ ಅವಕಾಶವಿರುತ್ತದೆ.'
    }
  },
  completed: {
    en: {
      title: '🎉 Onboarding Walkthrough Completed!',
      subtitle: 'Attendance & Site Operations Orientation Verified',
      instruction: 'You have completed all operational workflows. Tap "Done & Open Dashboard" to begin.',
      voice: 'Congratulations! You have successfully completed the Paradigm attendance, site visits, and break tracking walkthrough. You are all set for operations.'
    },
    hi: {
      title: '🎉 ऑनबोर्डिंग वॉकथ्रू सफलतापूर्वक पूर्ण!',
      subtitle: 'उपस्थिति व साइट ऑपरेशन्स प्रमाणित',
      instruction: 'आपने सभी ऑपरेशन्स समझ लिए हैं। शुरू करने के लिए नीचे "पूर्ण व डैशबोर्ड खोलें" पर टैप करें।',
      voice: 'बधाई हो! आपने उपस्थिति, साइट विजिट और ब्रेक ट्रैकिंग का सफलतापूर्वक अभ्यास कर लिया है। अब आप तैयार हैं।'
    },
    ta: {
      title: '🎉 வழிகாட்டி வெற்றிகரமாக முடிந்தது!',
      subtitle: 'வருகை மற்றும் சைட் பணிகள் சான்றிதழ் அளிக்கப்பட்டது',
      instruction: 'நீங்கள் அனைத்து பணிகளையும் கற்றுக்கொண்டீர்கள். தொடங்க கீழே தட்டவும்.',
      voice: 'வாழ்த்துகள்! பாராடிக்ம் வருகை பதிவு, சைட் விசிட் மற்றும் பிரேக் கண்காணிப்பை வெற்றிகரமாக கற்றுக்கொண்டீர்கள்.'
    },
    te: {
      title: '🎉 వాక్‌త్రూ విజయవంతంగా పూర్తయింది!',
      subtitle: 'హాజరు మరియు సైట్ విధులు ధృవీకరించబడ్డాయి',
      instruction: 'మీరు అన్ని అంశాలను నేర్చుకున్నారు. ప్రారంభించడానికి క్రింద నొక్కండి.',
      voice: 'అభినందనలు! మీరు పారడైమ్ హాజరు మరియు సైట్ విజిట్ ప్రక్రియను విజయవంతంగా నేర్చుకున్నారు.'
    },
    kn: {
      title: '🎉 ಮಾರ್ಗದರ್ಶಿ ಯಶಸ್ವಿಯಾಗಿ ಪೂರ್ಣಗೊಂಡಿದೆ!',
      subtitle: 'ಹಾಜರಾತಿ ಮತ್ತು ಸೈಟ್ ಕಾರ್ಯಗಳು ಪ್ರಮಾಣೀಕೃತಗೊಂಡಿವೆ',
      instruction: 'ನೀವು ಎಲ್ಲಾ ವಿಷಯಗಳನ್ನು ಕಲಿತಿದ್ದೀರಿ. ಪ್ರಾರಂಭಿಸಲು ಕೆಳಗೆ ಒತ್ತಿರಿ.',
      voice: 'ಅಭಿನಂದನೆಗಳು! ನೀವು ಪ್ಯಾರಾಡೈಮ್ ಹಾಜರಾತಿ ಮತ್ತು ಸೈಟ್ ಭೇಟಿ ಪ್ರಕ್ರಿಯೆಯನ್ನು ಯಶಸ್ವಿಯಾಗಿ ಕಲಿತಿದ್ದೀರಿ.'
    }
  }
};

export const InteractiveTutorialSimulator: React.FC = () => {
  const { isSimulatorOpen, closeSimulator } = useTutorialStore();

  const [step, setStep] = useState<SimStep>('intro');
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [isSiteCheckedIn, setIsSiteCheckedIn] = useState(false);
  const [isOnBreak, setIsOnBreak] = useState(false);
  const [dutyMode, setDutyMode] = useState<'duty' | 'ot'>('duty');
  const [lang, setLang] = useState<TutorialLanguage>(tutorialVoiceService.getLanguage());
  const [isMuted, setIsMuted] = useState(tutorialVoiceService.getMuted());
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [isScanningFace, setIsScanningFace] = useState(false);
  const [scanType, setScanType] = useState<'in' | 'out'>('in');
  const [simPunchInTime, setSimPunchInTime] = useState<string>(() => new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }));
  const [correctionReason, setCorrectionReason] = useState<'network' | 'overtime' | 'device'>('network');
  const [correctionStatus, setCorrectionStatus] = useState<'idle' | 'submitting' | 'submitted' | 'approved'>('idle');

  const mainScrollRef = useRef<HTMLElement>(null);

  // Auto-scroll stage to top on step transition so elements are never cut off
  useEffect(() => {
    mainScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  // Set up voice speech listener
  useEffect(() => {
    tutorialVoiceService.setOnSpeakingChange((speaking) => {
      setIsSpeaking(speaking);
    });
    return () => {
      tutorialVoiceService.stop();
    };
  }, []);

  const triggerHaptic = async (style: ImpactStyle = ImpactStyle.Medium) => {
    try {
      await Haptics.impact({ style });
    } catch (e) {
      // Ignore
    }
  };

  const currentInfo = STEP_CONTENT[step][lang];

  // Speak on step change or language change
  useEffect(() => {
    if (isSimulatorOpen && !isScanningFace) {
      const timer = setTimeout(() => {
        tutorialVoiceService.playStep(step, lang, currentInfo.voice);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [step, lang, isSimulatorOpen, isScanningFace]);

  const handleLanguageChange = (newLang: TutorialLanguage) => {
    setLang(newLang);
    tutorialVoiceService.setLanguage(newLang);
    triggerHaptic(ImpactStyle.Light);
  };

  // Perform simulated face scanning HUD before punch actions
  const startSimulatedFaceScan = (type: 'in' | 'out') => {
    triggerHaptic(ImpactStyle.Heavy);
    tutorialVoiceService.playChime('start');
    setScanType(type);
    setIsScanningFace(true);

    setTimeout(() => {
      setIsScanningFace(false);
      triggerHaptic(ImpactStyle.Heavy);
      tutorialVoiceService.playChime('success');

      if (type === 'in') {
        const nowTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        setSimPunchInTime(nowTime);
        setIsCheckedIn(true);
        setActionFeedback(`✓ Biometric Verified (99.8% Match) • Punch In Successful (${nowTime})`);
        setTimeout(() => {
          setActionFeedback(null);
          setStep('duty_mode');
        }, 1200);
      } else {
        setIsCheckedIn(false);
        setActionFeedback('✓ Biometric Verified • Punch Out Successful (18:00 PM) • 9h Duty Logged');
        setTimeout(() => {
          setActionFeedback(null);
          setStep('correction');
        }, 1200);
      }
    }, 1300);
  };

  // Handle simulation actions
  const handleAction = (actionType: string) => {
    triggerHaptic(ImpactStyle.Heavy);

    switch (actionType) {
      case 'start_sim':
        tutorialVoiceService.playChime('start');
        setStep('punch_in');
        break;

      case 'punch_in':
        if (step !== 'punch_in') return;
        startSimulatedFaceScan('in');
        break;

      case 'set_site_mode':
        if (step !== 'duty_mode') return;
        tutorialVoiceService.playChime('success');
        setDutyMode('ot');
        setActionFeedback('✓ Duty Mode Set to Site Duty (OT Multiplier Active)');
        setTimeout(() => {
          setActionFeedback(null);
          setStep('site_in');
        }, 1200);
        break;

      case 'site_in':
        if (step !== 'site_in') return;
        tutorialVoiceService.playChime('success');
        setIsSiteCheckedIn(true);
        setActionFeedback('✓ Site In Logged — Manyata Tech Park (GPS Geofence Verified)');
        setTimeout(() => {
          setActionFeedback(null);
          setStep('site_out');
        }, 1200);
        break;

      case 'site_out':
        if (step !== 'site_out') return;
        tutorialVoiceService.playChime('success');
        setIsSiteCheckedIn(false);
        setActionFeedback('✓ Site Out Logged — Visit Duration: 1h 15m');
        setTimeout(() => {
          setActionFeedback(null);
          setStep('break_in');
        }, 1200);
        break;

      case 'break_in':
        if (step !== 'break_in') return;
        tutorialVoiceService.playChime('alert');
        setIsOnBreak(true);
        setActionFeedback('☕ Break Started — Duty Timer Paused');
        setTimeout(() => {
          setActionFeedback(null);
          setStep('break_out');
        }, 1200);
        break;

      case 'break_out':
        if (step !== 'break_out') return;
        tutorialVoiceService.playChime('success');
        setIsOnBreak(false);
        setActionFeedback('✓ Break Ended — Active Duty Resumed');
        setTimeout(() => {
          setActionFeedback(null);
          setStep('punch_out');
        }, 1200);
        break;

      case 'punch_out':
        if (step !== 'punch_out') return;
        startSimulatedFaceScan('out');
        break;

      case 'submit_correction':
        if (step !== 'correction' || correctionStatus !== 'idle') return;
        tutorialVoiceService.playChime('alert');
        setCorrectionStatus('submitting');
        setTimeout(() => {
          setCorrectionStatus('submitted');
          tutorialVoiceService.playChime('success');
          setActionFeedback('✓ Attendance Correction Submitted to Reporting Manager');
          setTimeout(() => {
            setCorrectionStatus('approved');
            tutorialVoiceService.playChime('success');
            setActionFeedback('✓ Manager Approved! 1.0 Duty Credit Restored');
          }, 1600);
        }, 1200);
        break;

      case 'correction_continue':
        tutorialVoiceService.playChime('success');
        setStep('completed');
        break;

      case 'finish':
        tutorialVoiceService.playChime('success');
        tutorialVoiceService.stop();
        closeSimulator(true);
        break;

      case 'restart':
        tutorialVoiceService.playChime('start');
        setIsCheckedIn(false);
        setIsSiteCheckedIn(false);
        setIsOnBreak(false);
        setDutyMode('duty');
        setCorrectionStatus('idle');
        setCorrectionReason('network');
        setStep('punch_in');
        break;
    }
  };

  const toggleVoiceMute = () => {
    const muted = tutorialVoiceService.toggleMuted();
    setIsMuted(muted);
    triggerHaptic(ImpactStyle.Light);
    if (!muted) {
      tutorialVoiceService.playChime('start');
    }
  };

  if (!isSimulatorOpen) return null;

  return (
    <div className="fixed inset-0 z-[100000] bg-[#041B0F] text-white flex flex-col justify-between overflow-hidden select-none font-sans">
      {/* ── Top Header: Tier 1 Controls + Tier 2 Language Ribbon ── */}
      <header className="sticky top-0 z-50 bg-[#06241a] border-b border-emerald-500/20 px-4 pt-11 pb-2.5 flex flex-col gap-2.5 shadow-xl">
        {/* Tier 1: Audio Voice Guide Toggle & Exit Lab Button */}
        <div className="flex items-center justify-between">
          <button
            onClick={toggleVoiceMute}
            aria-label={isMuted ? 'Unmute Voice Guide' : 'Mute Voice Guide'}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 active:scale-95 transition-all"
          >
            {isMuted ? (
              <>
                <VolumeX className="w-4 h-4 text-emerald-400/50" />
                <span className="text-[11px] font-bold text-slate-400">Voice Muted</span>
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4 text-emerald-300" />
                <span className="text-[11px] font-bold text-emerald-200">Voice Guide</span>
                <div className="flex items-center gap-0.5 ml-0.5">
                  <span className={`w-1 h-2 rounded-full bg-emerald-400 ${isSpeaking ? 'animate-pulse' : 'opacity-40'}`} />
                  <span className={`w-1 h-3 rounded-full bg-emerald-300 ${isSpeaking ? 'animate-bounce' : 'opacity-40'}`} />
                  <span className={`w-1 h-1.5 rounded-full bg-emerald-400 ${isSpeaking ? 'animate-pulse' : 'opacity-40'}`} />
                </div>
              </>
            )}
          </button>

          <button
            onClick={() => {
              tutorialVoiceService.stop();
              closeSimulator(false);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 active:scale-95 transition-all text-xs font-bold"
          >
            <span className="text-[11px]">Exit Guide</span>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Tier 2: 5-Language Selector Ribbon (Full Width, Large Touch Targets) */}
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
              className={`py-1.5 rounded-lg text-[11px] font-bold transition-all text-center truncate px-1 ${
                lang === l.code
                  ? 'bg-emerald-500 text-white font-black shadow-md ring-1 ring-emerald-300/80 scale-[1.02]'
                  : 'text-slate-300 hover:text-white bg-white/5'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </header>

      {/* ── Subtitle Badge: 100% Safe Simulation Indicator ── */}
      <div className="px-4 pt-2.5 flex items-center justify-between text-[11px] font-medium text-emerald-400/80">
        <div className="flex items-center gap-1.5 bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-500/30">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Interactive Walkthrough • Live Orientation</span>
        </div>
        <div className="flex items-center gap-1 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30 text-[10px] font-black text-emerald-300">
          <Radio className="w-2.5 h-2.5 animate-pulse text-emerald-400" />
          <span>OPERATIONS GUIDE</span>
        </div>
      </div>

      {/* ── Step Instruction Card ── */}
      <div className="px-4 py-2">
        <motion.div
          key={step + lang}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 rounded-2xl bg-gradient-to-r from-emerald-950/80 to-[#0A3D2E]/80 border border-emerald-500/30 shadow-lg relative overflow-hidden"
        >
          <div className="flex items-start gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-white tracking-wide truncate">
                  {currentInfo.title}
                </h2>
                <button
                  onClick={() => {
                    triggerHaptic(ImpactStyle.Light);
                    tutorialVoiceService.playStep(step, lang, currentInfo.voice);
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-[11px] font-bold text-emerald-200 active:scale-95 transition-all shrink-0"
                  title="Play / Replay Voice Guide"
                >
                  <Volume2 className={`w-3.5 h-3.5 ${isSpeaking ? 'text-emerald-300 animate-pulse' : 'text-emerald-400'}`} />
                  <span>
                    {isSpeaking 
                      ? (lang === 'ta' ? 'ஒலிக்கிறது...' : lang === 'te' ? 'ప్లే అవుతోంది...' : lang === 'kn' ? 'ಪ್ಲೇ ಆಗುತ್ತಿದೆ...' : lang === 'hi' ? 'बज रहा है...' : 'Playing...')
                      : (lang === 'ta' ? '🔊 தமிழ்' : lang === 'te' ? '🔊 తెలుగు' : lang === 'kn' ? '🔊 ಕನ್ನಡ' : lang === 'hi' ? '🔊 हिन्दी' : '🔊 Listen')}
                  </span>
                </button>
              </div>
              <p className="text-xs text-emerald-300/85 mt-1 leading-snug">
                {currentInfo.instruction}
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── Action Toast Feedback Banner ── */}
      <AnimatePresence>
        {actionFeedback && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="mx-4 my-1 p-2.5 rounded-xl bg-emerald-500 text-black font-black text-xs text-center shadow-2xl flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 text-black" />
            <span>{actionFeedback}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Simulated GPS Geofence Pill ── */}
      {step !== 'intro' && step !== 'completed' && (
        <div className="flex justify-center px-4 my-1">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/40 border border-emerald-500/20 text-[10px] text-emerald-300/80 font-medium">
            <MapPin className="w-3 h-3 text-emerald-400" />
            <span>Manyata Tech Park • Geofence Verified (GPS Active)</span>
          </div>
        </div>
      )}

      {/* ── Main Interactive Stage ── */}
      <main ref={mainScrollRef} className="flex-1 flex flex-col items-center justify-center px-4 py-3 relative overflow-y-auto">
        {step === 'intro' ? (
          <div className="text-center max-w-sm flex flex-col items-center py-4">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border-2 border-emerald-400/40 flex items-center justify-center mb-4 shadow-2xl">
              <Compass className="w-10 h-10 text-emerald-300" />
            </div>
            <h1 className="text-lg font-black text-white mb-2">
              {lang === 'hi' ? 'करके सीखें: अभ्यास मोड' 
                : lang === 'ta' ? 'செய்து கற்போம்: நேரடி பயிற்சி' 
                : lang === 'te' ? 'చేసి నేర్చుకోండి: ప్రాక్టీస్ మోడ్' 
                : lang === 'kn' ? 'ಮಾಡಿ ಕಲಿಯಿರಿ: ಅಭ್ಯಾಸ ಮೋಡ್' 
                : 'Learn Paradigm by Doing It!'}
            </h1>
            <p className="text-xs text-slate-300 leading-relaxed mb-5">
              {lang === 'hi' 
                ? 'यह इंटरएक्टिव वॉकथ्रू आपको दिखाता है कि उपस्थिति, साइट विजिट और ब्रेक वास्तविक समय में कैसे काम करते हैं।'
                : lang === 'ta'
                ? 'பணி தொடக்கம், சைட் விசிட் மற்றும் பிரேக் எவ்வாறு செயல்படுகிறது என்பதை இந்த நேரடி பயிற்சி மூலம் கற்றுக்கொள்ளுங்கள்.'
                : lang === 'te'
                ? 'హాజరు, సైట్ విజిట్ మరియు బ్రేక్స్ ఎలా పనిచేస్తాయో బటన్లను నొక్కి సులభంగా నేర్చుకోండి.'
                : lang === 'kn'
                ? 'ಹಾಜರಾತಿ, ಸೈಟ್ ಭೇಟಿ ಮತ್ತು ಬ್ರೇಕ್‌ಗಳು ಹೇಗೆ ಕಾರ್ಯನಿರ್ವಹಿಸುತ್ತವೆ ಎಂಬುದನ್ನು ಬಟನ್‌ಗಳನ್ನು ಒತ್ತಿ ಸುಲಭವಾಗಿ ಕಲಿಯಿರಿ.'
                : 'This interactive walkthrough guides you through how attendance, client site visits, and duty breaks operate in real-time.'}
            </p>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => handleAction('start_sim')}
              className="px-6 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-xl shadow-emerald-500/20"
            >
              <span>
                {lang === 'hi' ? 'अभ्यास शुरू करें' 
                  : lang === 'ta' ? 'பயிற்சியை தொடங்கு' 
                  : lang === 'te' ? 'ప్రాక్టీస్ ప్రారంభించండి' 
                  : lang === 'kn' ? 'ಅಭ್ಯಾಸ ಪ್ರಾರಂಭಿಸಿ' 
                  : 'Start Walkthrough'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </motion.button>
          </div>
        ) : step === 'completed' ? (
          <div className="w-full max-w-sm p-5 rounded-3xl bg-gradient-to-b from-[#0A3D2E] to-[#041B0F] border border-emerald-500/30 text-center shadow-2xl">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center mx-auto mb-3">
              <Award className="w-7 h-7 text-emerald-300" />
            </div>
            <h3 className="text-base font-black text-white mb-1">
              {lang === 'hi' ? 'अभ्यास पूर्ण हुआ!' 
                : lang === 'ta' ? 'பயிற்சி முடிந்தது!' 
                : lang === 'te' ? 'ప్రాక్టీస్ పూర్తయింది!' 
                : lang === 'kn' ? 'ತರಬೇತಿ ಪೂರ್ಣಗೊಂಡಿದೆ!' 
                : 'Walkthrough Completed!'}
            </h3>
            <p className="text-xs text-emerald-300/80 mb-4">
              {lang === 'hi' 
                ? 'उपस्थिति और साइट ऑपरेशन्स प्रमाणित' 
                : lang === 'ta' 
                ? 'வருகை மற்றும் சைட் பணிகள் சான்றளிக்கப்பட்டது' 
                : lang === 'te'
                ? 'హాజరు మరియు సైట్ విధులు ధృవీకరించబడ్డాయి'
                : lang === 'kn'
                ? 'ಹಾಜರಾತಿ ಮತ್ತು ಸೈಟ್ ಕಾರ್ಯಗಳು ಪ್ರಮಾಣೀಕೃತಗೊಂಡಿವೆ'
                : 'Attendance & Site Operations Certified'}
            </p>

            {/* Checklist of learned skills */}
            <div className="space-y-1.5 text-left mb-5 text-xs text-slate-300">
              <div className="flex items-center gap-2 p-1.5 rounded-xl bg-black/30 border border-white/5">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Shift Start / Punch In (Biometric & GPS)</span>
              </div>
              <div className="flex items-center gap-2 p-1.5 rounded-xl bg-black/30 border border-white/5">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Duty Mode Selection (Regular vs Site Duty)</span>
              </div>
              <div className="flex items-center gap-2 p-1.5 rounded-xl bg-black/30 border border-white/5">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Client Site Visits (Site In & Site Out)</span>
              </div>
              <div className="flex items-center gap-2 p-1.5 rounded-xl bg-black/30 border border-white/5">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Compliant Breaks (Take Break & Resume Work)</span>
              </div>
              <div className="flex items-center gap-2 p-1.5 rounded-xl bg-black/30 border border-white/5">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Shift Completion (Punch Out)</span>
              </div>
              <div className="flex items-center gap-2 p-1.5 rounded-xl bg-black/30 border border-white/5">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Missed Punch Regularization & Quota Rules</span>
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => handleAction('finish')}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg"
              >
                <span>
                  {lang === 'hi' ? 'पूर्ण और शुरू करें' 
                    : lang === 'ta' ? 'நிறைவு செய்க' 
                    : lang === 'te' ? 'పూర్తి చేయండి' 
                    : lang === 'kn' ? 'ಪೂರ್ಣಗೊಳಿಸಿ' 
                    : 'Done & Open Dashboard'}
                </span>
                <CheckCircle2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleAction('restart')}
                className="w-full py-2 px-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white/70 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>
                  {lang === 'hi' ? 'फिर से अभ्यास करें' 
                    : lang === 'ta' ? 'மீண்டும் பயிற்சி செய்' 
                    : lang === 'te' ? 'మళ్ళీ ప్రాక్టీస్ చేయండి' 
                    : lang === 'kn' ? 'ಮತ್ತೆ ಅಭ್ಯಾಸ ಮಾಡಿ' 
                    : 'Replay Guide'}
                </span>
              </button>
            </div>
          </div>
        ) : step === 'punch_in' ? (
          /* ── STEP 1: SHIFT START (PUNCH IN ONLY) ── */
          <div className="w-full flex flex-col items-center justify-center py-4">
            <div className="relative flex items-center justify-center mb-6">
              <motion.div
                animate={{ scale: [1, 1.28, 1], opacity: [0.25, 0.7, 0.25] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute w-48 h-48 rounded-full border-2 border-emerald-400/60"
              />
              <motion.div
                animate={{ scale: [1, 1.15, 1], opacity: [0.35, 0.8, 0.35] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
                className="absolute w-40 h-40 rounded-full border border-emerald-300/40"
              />

              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={() => handleAction('punch_in')}
                className="relative w-36 h-36 rounded-full flex flex-col items-center justify-center transition-all duration-300 shadow-[0_0_35px_rgba(16,185,129,0.5)] bg-gradient-to-br from-emerald-500 to-teal-700 border-[3px] border-[#dcfce7]/40 text-white cursor-pointer active:scale-95 ring-4 ring-emerald-400/50"
              >
                <LogIn className="w-8 h-8 mb-1.5 text-white drop-shadow-md" />
                <span className="text-xs font-black uppercase tracking-widest text-white drop-shadow-md">
                  PUNCH IN
                </span>
                <span className="text-[9px] font-bold text-emerald-100 uppercase tracking-wider">
                  Start Shift
                </span>
              </motion.button>
            </div>

            <div className="text-center space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold tracking-wider uppercase text-slate-300">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                Shift Not Started
              </div>
              <p className="text-[11px] text-emerald-300/80 font-medium">
                Tap the glowing green orb above to record facial & GPS check-in
              </p>
            </div>
          </div>
        ) : step === 'duty_mode' ? (
          /* ── STEP 2: DUTY MODE SELECTION ── */
          <div className="w-full max-w-sm flex flex-col items-center py-2 space-y-3.5">
            {/* Active Shift Running Banner */}
            <div className="w-full flex items-center justify-between p-3 rounded-2xl bg-emerald-950/50 border border-emerald-500/30 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="font-black text-emerald-200 uppercase tracking-wider">Active Shift Running</span>
              </div>
              <span className="text-[11px] font-mono text-emerald-300/90 font-bold">IN: {simPunchInTime}</span>
            </div>

            {/* Duty Mode Hero Card */}
            <div className="w-full p-4 rounded-3xl bg-gradient-to-b from-[#0A3D2E]/90 to-[#041B0F] border border-emerald-500/30 shadow-xl space-y-3">
              <div className="flex items-center gap-2 text-white">
                <Radio className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-black uppercase tracking-wider">Select Duty Mode</h3>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Choose Regular Duty for standard base facility shifts, or Site Duty for traveling to client properties.
              </p>

              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  onClick={() => {
                    setDutyMode('duty');
                    tutorialVoiceService.playChime('start');
                  }}
                  className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                    dutyMode === 'duty'
                      ? 'bg-emerald-500/20 border-emerald-400 ring-2 ring-emerald-400/40 text-white'
                      : 'bg-black/30 border-white/10 text-slate-400 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-300" />
                    {dutyMode === 'duty' && <Check className="w-4 h-4 text-emerald-400" />}
                  </div>
                  <div>
                    <span className="text-xs font-black block text-white">Regular Duty</span>
                    <span className="text-[9px] text-slate-400">Fixed facility 8h</span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setDutyMode('ot');
                    tutorialVoiceService.playChime('start');
                  }}
                  className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                    dutyMode === 'ot'
                      ? 'bg-teal-500/20 border-teal-400 ring-2 ring-teal-400/40 text-white'
                      : 'bg-black/30 border-white/10 text-slate-400 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <MapPin className="w-5 h-5 text-teal-300" />
                    {dutyMode === 'ot' && <Check className="w-4 h-4 text-teal-400" />}
                  </div>
                  <div>
                    <span className="text-xs font-black block text-white">Site Duty (OT)</span>
                    <span className="text-[9px] text-slate-400">Client visits & travel</span>
                  </div>
                </button>
              </div>

              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => handleAction('set_site_mode')}
                className="w-full py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 mt-1"
              >
                <span>Set Site Duty & Continue</span>
                <ArrowRight className="w-4 h-4" />
              </motion.button>
            </div>
          </div>
        ) : step === 'site_in' ? (
          /* ── STEP 3: CLIENT SITE ARRIVAL (SITE IN) ── */
          <div className="w-full max-w-sm flex flex-col items-center py-2 space-y-3.5">
            {/* Active Shift Running Banner */}
            <div className="w-full flex items-center justify-between p-3 rounded-2xl bg-emerald-950/50 border border-emerald-500/30 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="font-black text-emerald-200 uppercase tracking-wider">Shift Active • Site Duty</span>
              </div>
              <span className="text-[11px] font-mono text-emerald-300/90 font-bold">09:15 AM</span>
            </div>

            {/* Client Site In Card */}
            <div className="w-full p-4 rounded-3xl bg-gradient-to-b from-[#0A3D2E]/90 to-[#041B0F] border border-emerald-500/30 shadow-xl space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0">
                  <MapPin className="w-5 h-5 text-emerald-300" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase text-white tracking-wider">Client Site Arrival</h3>
                  <p className="text-[10px] text-emerald-300/80">Manyata Tech Park • Redwood Facility</p>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-black/40 border border-white/5 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-[11px]">Geofence Status:</span>
                  <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Within 15m radius
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-[11px]">Assigned Task:</span>
                  <span className="text-[10px] font-bold text-slate-200">MEP Maintenance</span>
                </div>
              </div>

              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => handleAction('site_in')}
                className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/30 animate-pulse mt-1"
              >
                <MapPin className="w-4 h-4 text-black" />
                <span>Tap to Site In (Check In)</span>
              </motion.button>
            </div>
          </div>
        ) : step === 'site_out' ? (
          /* ── STEP 4: CLIENT SITE DEPARTURE (SITE OUT) ── */
          <div className="w-full max-w-sm flex flex-col items-center py-2 space-y-3.5">
            {/* Active Shift Running Banner */}
            <div className="w-full flex items-center justify-between p-3 rounded-2xl bg-emerald-950/50 border border-emerald-500/30 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="font-black text-emerald-200 uppercase tracking-wider">Site Visit In Progress</span>
              </div>
              <span className="text-[11px] font-mono text-emerald-300/90 font-bold">Elapsed: 01h 15m</span>
            </div>

            {/* Client Site Out Card */}
            <div className="w-full p-4 rounded-3xl bg-gradient-to-b from-[#0A3D2E]/90 to-[#041B0F] border border-amber-500/30 shadow-xl space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase text-white tracking-wider">Complete Client Visit</h3>
                  <p className="text-[10px] text-amber-300/80">Site: Manyata Tech Park (Redwood)</p>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-black/40 border border-white/5 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-[11px]">Arrival Time:</span>
                  <span className="text-[10px] font-mono text-slate-200">09:15 AM</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-[11px]">Departure Time:</span>
                  <span className="text-[10px] font-mono text-slate-200">10:30 AM</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-[11px]">Billable Site Time:</span>
                  <span className="text-[10px] font-bold text-emerald-400">1 Hour 15 Mins</span>
                </div>
              </div>

              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => handleAction('site_out')}
                className="w-full py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-amber-500/30 animate-pulse mt-1"
              >
                <MapPin className="w-4 h-4 text-black" />
                <span>Tap to Site Out (Complete Visit)</span>
              </motion.button>
            </div>
          </div>
        ) : step === 'break_in' ? (
          /* ── STEP 5: STATUTORY MEAL & REST BREAK (TAKE BREAK) ── */
          <div className="w-full max-w-sm flex flex-col items-center py-2 space-y-3.5">
            {/* Active Shift Running Banner */}
            <div className="w-full flex items-center justify-between p-3 rounded-2xl bg-emerald-950/50 border border-emerald-500/30 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="font-black text-emerald-200 uppercase tracking-wider">Active Shift Running</span>
              </div>
              <span className="text-[11px] font-mono text-emerald-300/90 font-bold">01:00 PM</span>
            </div>

            {/* Break Card */}
            <div className="w-full p-4 rounded-3xl bg-gradient-to-b from-[#0A3D2E]/90 to-[#041B0F] border border-emerald-500/30 shadow-xl space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center shrink-0">
                  <Coffee className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase text-white tracking-wider">Lunch & Tea Break</h3>
                  <p className="text-[10px] text-slate-300">Pause duty tracking for statutory meal rest</p>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-black/40 border border-white/5 text-[11px] text-slate-300 leading-relaxed">
                Taking a break pauses your active duty counter. Statutory breaks ensure fatigue compliance without affecting attendance.
              </div>

              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => handleAction('break_in')}
                className="w-full py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-amber-500/30 animate-pulse mt-1"
              >
                <Coffee className="w-4 h-4 text-black" />
                <span>Tap to Take Break (Pause Shift)</span>
              </motion.button>
            </div>
          </div>
        ) : step === 'break_out' ? (
          /* ── STEP 6: RETURN FROM BREAK (RESUME WORK) ── */
          <div className="w-full max-w-sm flex flex-col items-center py-2 space-y-3.5">
            {/* Paused Shift Banner */}
            <div className="w-full flex items-center justify-between p-3 rounded-2xl bg-amber-950/50 border border-amber-500/30 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                <span className="font-black text-amber-200 uppercase tracking-wider">Shift Paused • On Break</span>
              </div>
              <span className="text-[11px] font-mono text-amber-300/90 font-bold">01:30 PM</span>
            </div>

            {/* Active Break Card */}
            <div className="w-full p-4 rounded-3xl bg-gradient-to-b from-[#0A3D2E]/90 to-[#041B0F] border border-emerald-500/30 shadow-xl space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0">
                  <Coffee className="w-5 h-5 text-emerald-300" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase text-white tracking-wider">Break Finished?</h3>
                  <p className="text-[10px] text-emerald-300/80">Resume your active work tracking</p>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-black/40 border border-white/5 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-[11px]">Break Duration:</span>
                  <span className="text-[10px] font-mono text-amber-400 font-bold">30 Mins (Compliant)</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-[11px]">Remaining Shift:</span>
                  <span className="text-[10px] font-mono text-emerald-400 font-bold">3h 30m</span>
                </div>
              </div>

              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => handleAction('break_out')}
                className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/30 animate-pulse mt-1"
              >
                <CheckCircle2 className="w-4 h-4 text-black" />
                <span>Tap to Resume Work (End Break)</span>
              </motion.button>
            </div>
          </div>
        ) : (
          /* ── STEP 7: SHIFT COMPLETION (PUNCH OUT ONLY) ── */
          <div className="w-full max-w-sm flex flex-col items-center py-2 space-y-3.5">
            {/* Shift Summary Card */}
            <div className="w-full p-3.5 rounded-2xl bg-emerald-950/50 border border-emerald-500/30 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-black text-emerald-200 uppercase tracking-wider">Shift Complete Summary</span>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-bold">1.0 Duty Credit</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-white/10">
                <div>
                  <span className="text-[9px] text-slate-400 block uppercase">Punch In</span>
                  <span className="font-mono text-[11px] text-white font-bold">09:00 AM</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 block uppercase">Site Visits</span>
                  <span className="font-mono text-[11px] text-white font-bold">1 Completed</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 block uppercase">Punch Out</span>
                  <span className="font-mono text-[11px] text-rose-400 font-bold">06:00 PM</span>
                </div>
              </div>
            </div>

            {/* Glowing Red Punch Out Orb */}
            <div className="relative flex items-center justify-center my-2">
              <motion.div
                animate={{ scale: [1, 1.28, 1], opacity: [0.3, 0.75, 0.3] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute w-48 h-48 rounded-full border-2 border-rose-500/60"
              />
              <motion.div
                animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.8, 0.4] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
                className="absolute w-40 h-40 rounded-full border border-rose-400/40"
              />

              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={() => handleAction('punch_out')}
                className="relative w-36 h-36 rounded-full flex flex-col items-center justify-center transition-all duration-300 shadow-[0_0_35px_rgba(244,63,94,0.5)] bg-gradient-to-br from-rose-600 to-red-900 border-[3px] border-rose-200/40 text-white cursor-pointer active:scale-95 ring-4 ring-rose-500/50"
              >
                <LogOut className="w-8 h-8 mb-1.5 text-white drop-shadow-md" />
                <span className="text-xs font-black uppercase tracking-widest text-white drop-shadow-md">
                  PUNCH OUT
                </span>
                <span className="text-[9px] font-bold text-rose-200 uppercase tracking-wider">
                  End Shift
                </span>
              </motion.button>
            </div>

            <div className="text-center space-y-1">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-400">
                Tap red orb to finalize daily shift
              </span>
              <p className="text-[11px] text-slate-300">
                Biometric face scan and final shift closure
              </p>
            </div>
          </div>
        )}

        {/* ── STEP 7: REQUEST PUNCH / ATTENDANCE CORRECTION LAB ── */}
        {step === 'correction' && (
          <div className="w-full max-w-sm flex flex-col gap-3 py-1">
            {/* 1. Missed Punch Scenario Alert Banner */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-rose-500/10 to-transparent border border-amber-500/30 flex items-start gap-3 shadow-lg">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center shrink-0 mt-0.5">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                    Missed Punch Detected
                  </span>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    0.0 Duty / Unclosed
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 mt-1 leading-snug">
                  Yesterday&apos;s shift has no Punch Out punch. Unregularized missed punches result in Loss of Pay (Absent) status.
                </p>
                <div className="mt-2 flex items-center gap-3 text-[10px] font-mono text-slate-400 bg-black/40 px-2 py-1 rounded-lg">
                  <span>IN: <strong className="text-emerald-400">09:12 AM</strong></span>
                  <span>OUT: <strong className="text-rose-400">Missing</strong></span>
                </div>
              </div>
            </div>

            {/* 2. Monthly Quota Policy Badge */}
            <div className="px-3 py-2 rounded-xl bg-[#0A3D2E]/80 border border-emerald-500/20 flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="text-slate-300 font-semibold">Monthly Correction Policy:</span>
              </div>
              <span className="font-bold text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-md border border-emerald-500/30 text-[10px]">
                2 of 3 Allowed Left
              </span>
            </div>

            {/* 3. Reason Selector Form */}
            <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-emerald-400" />
                  Select Correction Reason
                </label>
                <span className="text-[9px] text-slate-400">Correction Request</span>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCorrectionReason('network');
                    triggerHaptic(ImpactStyle.Light);
                  }}
                  className={`p-2.5 rounded-xl text-left transition-all border flex items-center justify-between ${
                    correctionReason === 'network'
                      ? 'bg-emerald-500/20 border-emerald-400 text-white shadow-md'
                      : 'bg-white/5 border-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-bold">Network / Connectivity Failure</span>
                    <span className="text-[10px] text-slate-400">Punch failed to sync due to poor site tower reception</span>
                  </div>
                  {correctionReason === 'network' && <Check className="w-4 h-4 text-emerald-400 shrink-0 ml-2" />}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCorrectionReason('overtime');
                    triggerHaptic(ImpactStyle.Light);
                  }}
                  className={`p-2.5 rounded-xl text-left transition-all border flex items-center justify-between ${
                    correctionReason === 'overtime'
                      ? 'bg-emerald-500/20 border-emerald-400 text-white shadow-md'
                      : 'bg-white/5 border-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-bold">Extended Site Duty / Reliever OT</span>
                    <span className="text-[10px] text-slate-400">Worked extended reliever duty past scheduled shift end</span>
                  </div>
                  {correctionReason === 'overtime' && <Check className="w-4 h-4 text-emerald-400 shrink-0 ml-2" />}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCorrectionReason('device');
                    triggerHaptic(ImpactStyle.Light);
                  }}
                  className={`p-2.5 rounded-xl text-left transition-all border flex items-center justify-between ${
                    correctionReason === 'device'
                      ? 'bg-emerald-500/20 border-emerald-400 text-white shadow-md'
                      : 'bg-white/5 border-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-bold">Hardware Glitch / Battery Drain</span>
                    <span className="text-[10px] text-slate-400">Biometric scanner error or device shut off before punch</span>
                  </div>
                  {correctionReason === 'device' && <Check className="w-4 h-4 text-emerald-400 shrink-0 ml-2" />}
                </button>
              </div>

              {/* Time adjustment preview */}
              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-300">
                <span>Requested Punch Out Time:</span>
                <span className="font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  06:15 PM
                </span>
              </div>
            </div>

            {/* 4. Action & Approval Flow */}
            {correctionStatus === 'idle' ? (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => handleAction('submit_correction')}
                className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-500 to-emerald-500 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20 hover:brightness-110 active:scale-95"
              >
                <Send className="w-4 h-4" />
                <span>Submit Attendance Correction</span>
              </motion.button>
            ) : correctionStatus === 'submitting' ? (
              <div className="w-full py-3 px-4 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-300 font-bold text-xs flex items-center justify-center gap-2 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                <span>Transmitting Request to Site Supervisor...</span>
              </div>
            ) : correctionStatus === 'submitted' ? (
              <div className="w-full py-3 px-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-bold text-xs flex items-center justify-center gap-2 animate-pulse">
                <UserCheck className="w-4 h-4 text-emerald-400" />
                <span>Supervisor Reviewing Correction Request...</span>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="p-3 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-center space-y-1">
                  <div className="flex items-center justify-center gap-1.5 text-emerald-400 font-black text-xs uppercase tracking-wider">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Correction Approved & Regularized!</span>
                  </div>
                  <p className="text-[11px] text-emerald-200/90">
                    Status updated from <strong className="text-rose-400">Absent</strong> to <strong className="text-emerald-300">Present (1.0 Duty Credit)</strong>
                  </p>
                </div>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleAction('correction_continue')}
                  className="w-full py-3 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg active:scale-95"
                >
                  <span>View Certification & Badges</span>
                  <ArrowRight className="w-4 h-4" />
                </motion.button>
              </div>
            )}
          </div>
        )}
        <AnimatePresence>
          {isScanningFace && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/85 backdrop-blur-md z-40 flex flex-col items-center justify-center"
            >
              <div className="relative w-48 h-48 rounded-3xl border-2 border-emerald-400/40 flex items-center justify-center overflow-hidden">
                <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-emerald-400" />
                <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-emerald-400" />
                <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-emerald-400" />
                <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-emerald-400" />

                <motion.div
                  animate={{ y: [-70, 70, -70] }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute w-full h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_15px_#34d399]"
                />

                <Scan className="w-16 h-16 text-emerald-400/60" />
              </div>

              <div className="mt-4 text-center space-y-1">
                <span className="text-xs font-black uppercase tracking-widest text-emerald-400 flex items-center justify-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  Authenticating Face Mesh...
                </span>
                <p className="text-[10px] text-emerald-300/70">
                  Verifying Biometric Liveness & Geofence Check
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* ── Bottom Step Scrubber & Quick Navigation ── */}
      <footer className="sticky bottom-0 z-40 bg-[#06241a] border-t border-emerald-500/20 px-3.5 pt-2.5 pb-8 flex flex-col gap-2.5 shadow-2xl">
        {/* Step Scrubber Pills (Horizontal Scrollable with clean pill chips) */}
        <div className="flex items-center overflow-x-auto gap-1.5 pb-1 no-scrollbar text-[10px] font-bold">
          <button
            onClick={() => {
              tutorialVoiceService.playChime('start');
              setIsCheckedIn(false);
              setIsSiteCheckedIn(false);
              setIsOnBreak(false);
              setStep('punch_in');
            }}
            className={`px-3 py-1.5 rounded-xl shrink-0 transition-all ${
              step === 'punch_in'
                ? 'bg-emerald-500 text-white font-black shadow-md ring-1 ring-emerald-300'
                : 'bg-white/5 text-slate-300 border border-white/5 hover:bg-white/10'
            }`}
          >
            1. Punch In
          </button>
          <button
            onClick={() => {
              tutorialVoiceService.playChime('start');
              setIsCheckedIn(true);
              setStep('duty_mode');
            }}
            className={`px-3 py-1.5 rounded-xl shrink-0 transition-all ${
              step === 'duty_mode'
                ? 'bg-emerald-500 text-white font-black shadow-md ring-1 ring-emerald-300'
                : 'bg-white/5 text-slate-300 border border-white/5 hover:bg-white/10'
            }`}
          >
            2. Duty Mode
          </button>
          <button
            onClick={() => {
              tutorialVoiceService.playChime('start');
              setIsCheckedIn(true);
              setStep('site_in');
            }}
            className={`px-3 py-1.5 rounded-xl shrink-0 transition-all ${
              step === 'site_in'
                ? 'bg-emerald-500 text-white font-black shadow-md ring-1 ring-emerald-300'
                : 'bg-white/5 text-slate-300 border border-white/5 hover:bg-white/10'
            }`}
          >
            3. Site In
          </button>
          <button
            onClick={() => {
              tutorialVoiceService.playChime('start');
              setIsCheckedIn(true);
              setIsSiteCheckedIn(true);
              setStep('site_out');
            }}
            className={`px-3 py-1.5 rounded-xl shrink-0 transition-all ${
              step === 'site_out'
                ? 'bg-emerald-500 text-white font-black shadow-md ring-1 ring-emerald-300'
                : 'bg-white/5 text-slate-300 border border-white/5 hover:bg-white/10'
            }`}
          >
            4. Site Out
          </button>
          <button
            onClick={() => {
              tutorialVoiceService.playChime('start');
              setIsCheckedIn(true);
              setStep('break_in');
            }}
            className={`px-3 py-1.5 rounded-xl shrink-0 transition-all ${
              step === 'break_in' || step === 'break_out'
                ? 'bg-emerald-500 text-white font-black shadow-md ring-1 ring-emerald-300'
                : 'bg-white/5 text-slate-300 border border-white/5 hover:bg-white/10'
            }`}
          >
            5. Breaks
          </button>
          <button
            onClick={() => {
              tutorialVoiceService.playChime('start');
              setIsCheckedIn(true);
              setStep('punch_out');
            }}
            className={`px-3 py-1.5 rounded-xl shrink-0 transition-all ${
              step === 'punch_out'
                ? 'bg-emerald-500 text-white font-black shadow-md ring-1 ring-emerald-300'
                : 'bg-white/5 text-slate-300 border border-white/5 hover:bg-white/10'
            }`}
          >
            6. Punch Out
          </button>
          <button
            onClick={() => {
              tutorialVoiceService.playChime('start');
              setIsCheckedIn(false);
              setStep('correction');
            }}
            className={`px-3 py-1.5 rounded-xl shrink-0 transition-all ${
              step === 'correction' || step === 'completed'
                ? 'bg-emerald-500 text-white font-black shadow-md ring-1 ring-emerald-300'
                : 'bg-white/5 text-slate-300 border border-white/5 hover:bg-white/10'
            }`}
          >
            7. Request Punch
          </button>
        </div>

        {/* Footer Stage Indicator Badge */}
        <div className="flex items-center justify-between text-[11px] px-1">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="font-extrabold uppercase tracking-wider text-emerald-400">
              MODULE: {step.replace('_', ' ')}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-medium">
            Tap any step above to explore features
          </span>
        </div>
      </footer>
    </div>
  );
};
