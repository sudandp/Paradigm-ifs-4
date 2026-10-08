import os

COACH_STEPS_BLOCK = '''const COACH_STEPS: CoachStepConfig[] = [
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
        subtitles: 'Look here! Your punch-in time is captured at First Entry at 09:00 AM.',
        voice: 'Look here! Your punch-in time is captured and displayed at First Entry at 09:00 AM. You can verify your daily logged hours here anytime.'
      },
      hi: {
        title: 'चरण 2: दर्ज पंच समय',
        badge: 'चरण 2/8 • उपस्थिति समय',
        subtitles: 'यहाँ देखें! आपका पंच-इन समय फर्स्ट एंट्री में सुबह 9:00 बजे दर्ज हो गया है।',
        voice: 'यहाँ देखें! आपका पंच-इन समय दर्ज हो गया है और फर्स्ट एंट्री में सुबह 9:00 बजे दिखाई दे रहा है। आप अपने काम के घंटे कभी भी यहाँ देख सकते हैं।'
      },
      ta: {
        title: 'படி 2: பதிவு செய்யப்பட்ட நேரம்',
        badge: 'படி 2/8 • முதல் பதிவு நேரம்',
        subtitles: 'இங்கே பாருங்கள்! உங்கள் பஞ்ச்-இன் நேரம் காலை 9:00 மணிக்கு முதல் பதிவில் காட்டப்படுகிறது.',
        voice: 'இங்கே பாருங்கள்! உங்கள் பஞ்ச்-இன் நேரம் பதிவு செய்யப்பட்டு, காலை 9:00 மணிக்கு முதல் பதிவில் காட்டப்படுகிறது. உங்கள் பணி நேரத்தை எப்போது வேண்டுமானாலும் இங்கே பார்க்கலாம்.'
      },
      te: {
        title: 'దశ 2: నమోదు చేయబడిన సమయం',
        badge: 'దశ 2/8 • ఎంట్రీ రికార్డ్',
        subtitles: 'ఇక్కడ చూడండి! మీ పంచ్-ఇన్ సమయం ఫస్ట్ ఎంట్రీలో ఉదయం 9:00 గంటలకు నమోదైంది.',
        voice: 'ఇక్కడ చూడండి! మీ పంచ్-ఇన్ సమయం రికార్డ్ చేయబడింది మరియు ఫస్ట్ ఎంట్రీలో ఉదయం 9:00 గంటలకు కనిపిస్తుంది. మీ పని గంటలను ఎప్పుడైనా ఇక్కడ తనిఖీ చేయవచ్చు.'
      },
      kn: {
        title: 'ಹಂತ 2: ದಾಖಲಾದ ಸಮಯ',
        badge: 'ಹಂತ 2/8 • ಪ್ರವೇಶ ಸಮಯ',
        subtitles: 'ಇಲ್ಲಿ ನೋಡಿ! ನಿಮ್ಮ ಪಂಚ್-ಇನ್ ಸಮಯ ಬೆಳಗ್ಗೆ 9:00 ಗಂಟೆಗೆ ದಾಖಲಾಗಿದೆ.',
        voice: 'ಇಲ್ಲಿ ನೋಡಿ! ನಿಮ್ಮ ಪಂಚ್-ಇನ್ ಸಮಯ ದಾಖಲಾಗಿದೆ ಮತ್ತು ಮೊದಲ ಪ್ರವೇಶದಲ್ಲಿ ಬೆಳಗ್ಗೆ 9:00 ಗಂಟೆಗೆ ತೋರಿಸಲಾಗುತ್ತಿದೆ. ನಿಮ್ಮ ಕೆಲಸದ ಸಮಯವನ್ನು ನೀವು ಯಾವಾಗ ಬೇಕಾದರೂ ಇಲ್ಲಿ ಪರಿಶೀಲಿಸಬಹುದು.'
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
];'''

target_file = os.path.join(os.path.dirname(__file__), '..', 'components', 'tutorial', 'LiveCoachOverlay.tsx')

with open(target_file, 'r', encoding='utf-8', errors='replace') as f:
    content = f.read()

start_marker = 'const COACH_STEPS: CoachStepConfig[] = ['
end_marker = 'const LiveCoachOverlay: React.FC'

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx != -1 and end_idx != -1:
    new_content = content[:start_idx] + COACH_STEPS_BLOCK + '\\n\\n' + content[end_idx:]
    with open(target_file, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print('Successfully updated LiveCoachOverlay.tsx!')
else:
    print('Error: Markers not found!', start_idx, end_idx)
