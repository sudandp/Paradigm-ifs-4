// Native Capacitor TTS & High-Fidelity Studio Neural Voice Hybrid Service for Paradigm Interactive Onboarding Tutorial
// Supports 5 Regional Languages: English (en-IN), Hindi (hi-IN), Tamil (ta-IN), Telugu (te-IN), Kannada (kn-IN)
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { Capacitor } from '@capacitor/core';

export type TutorialLanguage = 'en' | 'hi' | 'ta' | 'te' | 'kn';

const TEXT_TO_STEP: Record<string, string> = {
  // Tamil
  'பாராடிக்மிற்கு அன்புடன் வரவேற்கிறோம்! உங்கள் தினசரி பணி எவ்வாறு செயல்படுகிறது என்பதை இப்போது பயிற்சி செய்வோம். தொடங்க ஸ்டார்ட் பட்டனை அழுத்தவும்.': 'intro',
  'முதல் படி. பணிக்கு வந்ததும், பச்சை நிற பஞ்ச் இன் பட்டனை தட்டி உங்கள் பணியை தொடங்குங்கள். இப்போது தட்டவும்.': 'punch_in',
  'சிறப்பு! உங்கள் பணி தொடங்கியது. நீங்கள் ரெகுலர் டியூட்டி அல்லது சைட் டியூட்டி தேர்வு செய்யலாம். சைட் டியூட்டி பட்டனை அழுத்தவும்.': 'duty_mode',
  'நீங்கள் கிளையன்ட் வளாகத்திற்கு வந்ததும், சைட் இன் பட்டனை தட்டி வருகையை பதிவு செய்யுங்கள்.': 'site_in',
  'அற்புதம்! உங்கள் ஆய்வு அல்லது வேலை முடிந்ததும், விசிட்டை முடிக்க சைட் அவுட் பட்டனை தட்டவும்.': 'site_out',
  'மதிய உணவு அல்லது டீ இடைவேளை தேவையா? இடைவேளையை தொடங்க டேக் பிரேக் பட்டனை தட்டவும்.': 'break_in',
  'உங்கள் இடைவேளை முடிவடைந்ததும், பணியை தொடர ரெஸ்யூம் ஒர்க் பட்டனை தட்டவும்.': 'break_out',
  'இறுதியாக, பணி முடிந்ததும், உங்கள் ஷிப்டை முடிக்க சிவப்பு நிற பஞ்ச் அவுட் பட்டனை தட்டவும்.': 'punch_out',
  'பஞ்ச் இன் அல்லது பஞ்ச் அவுட் செய்ய மறந்துவிட்டால், அந்த நாளுக்கான சம்பள வரவு கிடைக்காது. இதனை சரிசெய்ய அட்டெண்டன்ஸ் கரெக்ஷன் விண்ணப்பிக்க வேண்டும். மாதத்திற்கு அதிகபட்சம் 3 முறை மட்டுமே அனுமதிக்கப்படும்.': 'correction',
  'வாழ்த்துகள்! பாராடிக்ம் வருகை பதிவு, சைட் விசிட் மற்றும் பிரேக் கண்காணிப்பை வெற்றிகரமாக கற்றுக்கொண்டீர்கள்.': 'completed',

  // Telugu
  'పారడైమ్‌కు స్వాగతం! మీ రోజువారీ డ్యూటీ ఎలా పనిచేస్తుందో ఇప్పుడు నేర్చుకుందాం. పంచ్ ఇన్, సైట్ ఇన్, సైట్ అవుట్, బ్రేక్స్ మరియు పంచ్ అవుట్ ప్రాక్టీస్ చేద్దాం.': 'intro',
  'మొదటి దశ. విధికి వచ్చినప్పుడు, ఆకుపచ్చ పంచ్ ఇన్ బటన్‌ను నొక్కి మీ షిఫ్ట్‌ను ప్రారంభించండి.': 'punch_in',
  'చాలా బాగుంది! మీ షిఫ్ట్ ప్రారంభమైంది. ఇప్పుడు సైట్ డ్యూటీ బటన్‌ను నొక్కండి.': 'duty_mode',
  'మీరు క్లయింట్ సైట్‌కు చేరుకున్నప్పుడు, సైట్ ఇన్ బటన్‌ను నొక్కి ఎంట్రీని నమోదు చేయండి.': 'site_in',
  'అద్భుతం! పని పూర్తయిన తర్వాత విజిట్ ముగించడానికి సైట్ అవుట్ నొక్కండి.': 'site_out',
  'లంచ్ లేదా టీ బ్రేక్ కావాలా? టేక్ బ్రేక్ పై నొక్కండి.': 'break_in',
  'మీ విరామం పూర్తయినప్పుడు, పనిని కొనసాగించడానికి రెజ్యూమ్ వర్క్ నొక్కండి.': 'break_out',
  'చివరిగా, రోజు పని పూర్తయినప్పుడు, షిఫ్ట్ ముగించడానికి ఎరుపు పంచ్ అవుట్ బటన్ నొక్కండి.': 'punch_out',
  'మీరు పంచ్ ఇన్ లేదా పంచ్ అవుట్ మర్చిపోతే జీతం నష్టం జరుగుతుంది. దీనిని సరిచేయడానికి మీరు అటెండెన్స్ కరెక్షన్ అప్లై చేయవచ్చు. నెలకు గరిష్టంగా 3 సార్లు మాత్రమే అవకాశం ఉంటుంది.': 'correction',
  'అభినందనలు! మీరు పారడైమ్ హాజరు మరియు సైట్ విజిట్ ప్రక్రియను విజయవంతంగా నేర్చుకున్నారు.': 'completed',

  // Kannada
  'ಪ್ಯಾರಾಡೈಮ್‌ಗೆ ಸುಸ್ವಾಗತ! ನಿಮ್ಮ ದೈನಂದಿನ ಕರ್ತವ್ಯ ಹೇಗೆ ಕಾರ್ಯನಿರ್ವಹಿಸುತ್ತದೆ ಎಂಬುದನ್ನು ಈಗ ಕಲಿಯೋಣ. ಪಂಚ್ ಇನ್, ಸೈಟ್ ಇನ್, ಸೈಟ್ ಔಟ್, ಬ್ರೇಕ್ ಮತ್ತು ಪಂಚ್ ಔಟ್ ಅಭ್ಯಾಸ ಮಾಡೋಣ.': 'intro',
  'ಮೊದಲ ಹಂತ. ಕೆಲಸಕ್ಕೆ ಬಂದಾಗ, ಹಸಿರು ಪಂಚ್ ಇನ್ ಬಟನ್ ಒತ್ತಿ ನಿಮ್ಮ ಶಿಫ್ಟ್ ಪ್ರಾರಂಭಿಸಿ.': 'punch_in',
  'ತುಂಬಾ ಒಳ್ಳೆಯದು! ನಿಮ್ಮ ಶಿಫ್ಟ್ ಪ್ರಾರಂಭವಾಗಿದೆ. ಈಗ ಸೈಟ್ ಡ್ಯೂಟಿ ಬಟನ್ ಒತ್ತಿರಿ.': 'duty_mode',
  'ನೀವು ಕ್ಲೈಂಟ್ ಸೈಟ್‌ಗೆ ತಲುಪಿದಾಗ, ಸೈಟ್ ಇನ್ ಬಟನ್ ಒತ್ತಿ ನಿಮ್ಮ ಆಗಮನವನ್ನು ದಾಖಲಿಸಿ.': 'site_in',
  'ಉತ್ತಮ! ಕೆಲಸ ಮುಗಿದ ನಂತರ ಭೇಟಿಯನ್ನು ಪೂರ್ಣಗೊಳಿಸಲು ಸೈಟ್ ಔಟ್ ಒತ್ತಿರಿ.': 'site_out',
  'ಊಟ ಅಥವಾ ಟೀ ವಿರಾಮ ಬೇಕೆ? ಟೇಕ್ ಬ್ರೇಕ್ ಬಟನ್ ಟ್ಯಾಪ್ ಮಾಡಿ.': 'break_in',
  'ವಿರಾಮ ಮುಗಿದ ನಂತರ, ಕೆಲಸವನ್ನು ಮುಂದುವರಿಸಲು ರೆಸ್ಯೂಮ್ ವರ್ಕ್ ಒತ್ತಿರಿ.': 'break_out',
  'ಕೊನೆಯದಾಗಿ, ದಿನದ ಕೆಲಸ ಮುಗಿದ ನಂತರ, ಶಿಫ್ಟ್ ಪೂರ್ಣಗೊಳಿಸಲು ಕೆಂಪು ಪಂಚ್ ಔಟ್ ಬಟನ್ ಒತ್ತಿರಿ.': 'punch_out',
  'ನೀವು ಪಂಚ್ ಇನ್ ಅಥವಾ ಪಂಚ್ ಔಟ್ ಮಾಡಲು ಮರೆತರೆ ಆ ದಿನಕ್ಕೆ ಶೂನ್ಯ ಹಾಜರಾತಿ ಬೀಳುತ್ತದೆ. ಇದನ್ನು ಸರಿಪಡಿಸಲು ಅಟೆಂಡೆನ್ಸ್ ಕರೆಕ್ಷನ್ ರಿಕ್ವೆಸ್ಟ್ ಸಲ್ಲಿಸಬೇಕು. ತಿಂಗಳಿಗೆ ಗರಿಷ್ಠ 3 ಬಾರಿ ಮಾತ್ರ ಅವಕಾಶವಿರುತ್ತದೆ.': 'correction',
  'ಅಭಿನಂದನೆಗಳು! ನೀವು ಪ್ಯಾರಾಡೈಮ್ ಹಾಜರಾತಿ ಮತ್ತು ಸೈಟ್ ಭೇಟಿ ಪ್ರಕ್ರಿಯೆಯನ್ನು ಯಶಸ್ವಿಯಾಗಿ ಕಲಿತಿದ್ದೀರಿ.': 'completed',

  // Hindi
  'पैराडाइम में आपका स्वागत है! आइए अभ्यास करें कि आपकी दैनिक ड्यूटी कैसे काम करती है। हम पंच इन, साइट इन, साइट आउट, ब्रेक और पंच आउट का अभ्यास करेंगे।': 'intro',
  'पहला चरण। काम पर पहुंचने पर, हरे रंग के पंच इन बटन पर टैप करके अपनी शिफ्ट शुरू करें। इसे अभी टैप करें।': 'punch_in',
  'शाबाश! आपकी शिफ्ट अब सक्रिय है। आप रेगुलर ड्यूटी और साइट ड्यूटी के बीच चयन कर सकते हैं। साइट ड्यूटी बटन दबाएं।': 'duty_mode',
  'जब आप किसी क्लाइंट बिल्डिंग या साइट पर पहुंचे, तो आगमन दर्ज करने के लिए साइट इन पर टैप करें।': 'site_in',
  'बहुत बढ़िया! आप साइट में चेक इन हैं। काम पूरा होने के बाद, विजिट पूरा करने के लिए साइट आउट पर टैप करें।': 'site_out',
  'लंच या चाय का ब्रेक चाहिए? ट्रैकिंग रोकने के लिए टेक ब्रेक पर टैप करें।': 'break_in',
  'आपका ब्रेक टाइमर चालू है। ब्रेक समाप्त होने पर, अपनी शिफ्ट जारी रखने के लिए रिज्यूम वर्क पर टैप करें।': 'break_out',
  'अंत में, दिन का काम समाप्त होने पर, अपनी शिफ्ट पूरी करने के लिए लाल पंच आउट बटन पर टैप करें।': 'punch_out',
  'अगर आप पंच इन या पंच आउट करना भूल जाते हैं, तो आपको उस दिन शून्य ड्यूटी मिलेगी। इसे ठीक करने के लिए आप अटेंडेंस करेक्शन का अनुरोध कर सकते हैं। महीने में अधिकतम 3 करेक्शन की अनुमति है। नीचे फॉर्म भरकर सबमिट करें।': 'correction',
  'बधाई हो! आपने उपस्थिति, साइट विजिट और ब्रेक ट्रैकिंग का सफलतापूर्वक अभ्यास कर लिया है। अब आप तैयार हैं।': 'completed',

  // English
  "Welcome to Paradigm! Let's practice how your daily shift works. We will simulate Punch In, Site In, Site Out, Breaks, and Punch Out together. Tap Start to begin.": 'intro',
  'Step one. When you arrive at work, start your shift by tapping the green Punch In orb. Go ahead and tap it now.': 'punch_in',
  'Great job! Your shift is now active. You can switch between Regular Duty and Site Duty. Try tapping the Site Duty button.': 'duty_mode',
  'When you arrive at a client property or facility, tap Check In to log your site arrival. Tap Site In now.': 'site_in',
  'Excellent! You are now checked into the site. When your inspection or work is finished, tap Check Out to complete the visit.': 'site_out',
  'Need a lunch or tea break? Tap Take Break to pause tracking. Try tapping Take Break now.': 'break_in',
  'Your break timer is now active. When you finish your break, tap Resume Work to continue your shift.': 'break_out',
  'Finally, at the end of your workday, tap the red Punch Out orb to finish your shift. Tap it now to complete your practice.': 'punch_out',
  'What if you forgot to punch in or punch out? Your attendance will be marked as Missed Punch with zero duty credit. You can fix this by submitting an Attendance Correction request. You are allowed up to 3 corrections per month. Fill the form below and tap submit.': 'correction',
  'Congratulations! You have successfully mastered Paradigm attendance, site visits, and break tracking. You are now certified and ready for operations.': 'completed'
};

class TutorialVoiceService {
  private isMuted: boolean = false;
  private currentLanguage: TutorialLanguage = 'en';
  private onSpeakingChangeCallback: ((speaking: boolean) => void) | null = null;
  private onStepEndedCallback: ((step: string) => void) | null = null;
  private audioCtx: AudioContext | null = null;
  private isSpeakingState: boolean = false;
  private currentAudio: HTMLAudioElement | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'localStorage' in window) {
      this.isMuted = localStorage.getItem('paradigm_tutorial_voice_muted') === 'true';
      const savedLang = localStorage.getItem('paradigm_tutorial_voice_lang') as TutorialLanguage;
      if (savedLang && ['en', 'hi', 'ta', 'te', 'kn'].includes(savedLang)) {
        this.currentLanguage = savedLang;
      }
    }
  }

  public setOnSpeakingChange(cb: (speaking: boolean) => void) {
    this.onSpeakingChangeCallback = cb;
  }

  public setOnStepEnded(cb: ((step: string) => void) | null) {
    this.onStepEndedCallback = cb;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (typeof window !== 'undefined' && 'localStorage' in window) {
      localStorage.setItem('paradigm_tutorial_voice_muted', muted ? 'true' : 'false');
    }
    if (muted) {
      this.stop();
    }
  }

  public toggleMuted(): boolean {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  public getLanguage(): TutorialLanguage {
    return this.currentLanguage;
  }

  public setLanguage(lang: TutorialLanguage): void {
    this.currentLanguage = lang;
    if (typeof window !== 'undefined' && 'localStorage' in window) {
      localStorage.setItem('paradigm_tutorial_voice_lang', lang);
    }
    this.stop();
  }

  // Synthesize an audible chime using Web Audio API
  public playChime(type: 'success' | 'alert' | 'start' = 'success'): void {
    if (this.isMuted || typeof window === 'undefined') return;

    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!this.audioCtx && AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      if (!this.audioCtx) return;

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      const now = this.audioCtx.currentTime;

      if (type === 'success') {
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.setValueAtTime(880.00, now + 0.1); // A5
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === 'start') {
        osc.frequency.setValueAtTime(440.00, now); // A4
        osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
        osc.frequency.setValueAtTime(880.00, now + 0.16); // A5
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
      } else {
        osc.frequency.setValueAtTime(440, now);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
      }
    } catch (e) {
      // Ignore web audio error
    }
  }

  public async stop(): Promise<void> {
    // 1. Stop HTML5 audio element
    if (this.currentAudio) {
      try {
        const audio = this.currentAudio;
        this.currentAudio = null;
        audio.onplay = null;
        audio.onended = null;
        audio.onerror = null;
        audio.pause();
        audio.currentTime = 0;
        audio.removeAttribute('src');
        audio.load();
      } catch (e) {
        // Ignore
      }
    }

    // 2. Stop Native Capacitor TTS
    if (Capacitor.isNativePlatform()) {
      try {
        await TextToSpeech.stop();
      } catch (e) {
        // Ignore
      }
    } else if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {
        // Ignore
      }
    }

    this.isSpeakingState = false;
    if (this.onSpeakingChangeCallback) {
      this.onSpeakingChangeCallback(false);
    }
  }

  private getLangCode(lang: TutorialLanguage): string {
    switch (lang) {
      case 'hi': return 'hi-IN';
      case 'ta': return 'ta-IN';
      case 'te': return 'te-IN';
      case 'kn': return 'kn-IN';
      default: return 'en-IN';
    }
  }

  /**
   * Play pre-rendered studio neural voice audio file for given tutorial step and language.
   * Gracefully falls back to device TTS if file is missing or fails to load.
   */
  public async playStep(step: string, langOverride?: TutorialLanguage, fallbackText?: string): Promise<void> {
    if (this.isMuted) return;

    await this.stop();

    const targetLang = langOverride || this.currentLanguage;
    const audioPath = `/audio/tutorial/${step}_${targetLang}.mp3`;

    this.playChime('alert');

    try {
      const audio = new Audio(audioPath);
      audio.preload = 'auto';
      this.currentAudio = audio;

      audio.onplay = () => {
        this.isSpeakingState = true;
        if (this.onSpeakingChangeCallback) {
          this.onSpeakingChangeCallback(true);
        }
      };

      audio.onended = () => {
        this.isSpeakingState = false;
        if (this.onSpeakingChangeCallback) {
          this.onSpeakingChangeCallback(false);
        }
        if (this.onStepEndedCallback) {
          this.onStepEndedCallback(step);
        }
        if (this.currentAudio === audio) {
          this.currentAudio = null;
        }
      };

      audio.onerror = async (err) => {
        console.warn(`[TutorialVoice] Pre-rendered audio not found for ${step}_${targetLang}, falling back to device TTS.`, err);
        if (this.currentAudio === audio) {
          this.currentAudio = null;
        }
        if (fallbackText) {
          await this.speakFallback(fallbackText, targetLang);
        } else {
          this.isSpeakingState = false;
          if (this.onSpeakingChangeCallback) {
            this.onSpeakingChangeCallback(false);
          }
        }
      };

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        await playPromise;
      }
    } catch (playErr: unknown) {
      const isAbort = playErr instanceof DOMException && playErr.name === 'AbortError';
      if (!isAbort) {
        console.warn(`[TutorialVoice] Audio play error for ${step}_${targetLang}:`, playErr);
        if (fallbackText) {
          await this.speakFallback(fallbackText, targetLang);
        } else {
          this.isSpeakingState = false;
          if (this.onSpeakingChangeCallback) {
            this.onSpeakingChangeCallback(false);
          }
        }
      }
    }
  }

  /**
   * Speak arbitrary text. If text matches a known tutorial script, plays the studio neural voice directly!
   */
  public async speak(text: string, langOverride?: TutorialLanguage): Promise<void> {
    if (this.isMuted || !text) return;

    const targetLang = langOverride || this.currentLanguage;
    const cleanText = text.trim();

    // Check if this text belongs to a tutorial step
    if (TEXT_TO_STEP[cleanText]) {
      const step = TEXT_TO_STEP[cleanText];
      await this.playStep(step, targetLang, text);
      return;
    }

    await this.speakFallback(text, targetLang);
  }

  /**
   * Device TTS Fallback (Capacitor Native TTS or browser Web Speech API)
   */
  private async speakFallback(text: string, targetLang: TutorialLanguage): Promise<void> {
    if (this.isMuted || !text) return;

    await this.stop();

    const langCode = this.getLangCode(targetLang);

    // Play subtle audio cue to alert user
    this.playChime('alert');

    this.isSpeakingState = true;
    if (this.onSpeakingChangeCallback) {
      this.onSpeakingChangeCallback(true);
    }

    // Prefer Native Capacitor TextToSpeech on Android / iOS
    if (Capacitor.isNativePlatform()) {
      try {
        await TextToSpeech.speak({
          text: text,
          lang: langCode,
          rate: targetLang === 'en' ? 0.95 : 0.88,
          pitch: 1.0,
          volume: 1.0,
        });
        this.isSpeakingState = false;
        if (this.onSpeakingChangeCallback) {
          this.onSpeakingChangeCallback(false);
        }
        return;
      } catch (nativeErr) {
        console.warn('[TutorialVoice] Native TTS for ' + langCode + ' failed, attempting fallback:', nativeErr);
        if (langCode !== 'en-IN') {
          try {
            await TextToSpeech.speak({
              text: text,
              lang: 'en-IN',
              rate: 0.95,
              pitch: 1.0,
              volume: 1.0
            });
            this.isSpeakingState = false;
            if (this.onSpeakingChangeCallback) {
              this.onSpeakingChangeCallback(false);
            }
            return;
          } catch (e2) {
            console.warn('[TutorialVoice] Fallback en-IN native speech failed:', e2);
          }
        }
      }
    }

    // Web Speech API Fallback for browser / emulator
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = targetLang === 'en' ? 0.95 : 0.90;
        utterance.pitch = 1.0;
        utterance.lang = langCode;

        const voices = window.speechSynthesis.getVoices();
        let selectedVoice = voices.find(v => v.lang.toLowerCase().replace('_', '-').includes(langCode.toLowerCase()));

        if (!selectedVoice) {
          selectedVoice = voices.find(v => v.lang.includes('en-IN')) || 
                          voices.find(v => v.lang.startsWith('en')) || 
                          null;
        }

        if (selectedVoice) {
          utterance.voice = selectedVoice;
        }

        utterance.onstart = () => {
          this.isSpeakingState = true;
          if (this.onSpeakingChangeCallback) this.onSpeakingChangeCallback(true);
        };

        utterance.onend = () => {
          this.isSpeakingState = false;
          if (this.onSpeakingChangeCallback) this.onSpeakingChangeCallback(false);
        };

        utterance.onerror = () => {
          this.isSpeakingState = false;
          if (this.onSpeakingChangeCallback) this.onSpeakingChangeCallback(false);
        };

        window.speechSynthesis.speak(utterance);
      } catch (e) {
        this.isSpeakingState = false;
        if (this.onSpeakingChangeCallback) this.onSpeakingChangeCallback(false);
      }
    } else {
      this.isSpeakingState = false;
      if (this.onSpeakingChangeCallback) this.onSpeakingChangeCallback(false);
    }
  }
}

export const tutorialVoiceService = new TutorialVoiceService();
