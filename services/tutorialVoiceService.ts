// Native Capacitor TTS & Web Speech Hybrid Voice Service for Paradigm Interactive Onboarding Tutorial
// Supports 5 Regional Languages: English (en-IN), Hindi (hi-IN), Tamil (ta-IN), Telugu (te-IN), Kannada (kn-IN)
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { Capacitor } from '@capacitor/core';

export type TutorialLanguage = 'en' | 'hi' | 'ta' | 'te' | 'kn';

class TutorialVoiceService {
  private isMuted: boolean = false;
  private currentLanguage: TutorialLanguage = 'en';
  private onSpeakingChangeCallback: ((speaking: boolean) => void) | null = null;
  private audioCtx: AudioContext | null = null;
  private isSpeakingState: boolean = false;

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
        // High pitched pleasant double chime
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

  public async speak(text: string, langOverride?: TutorialLanguage): Promise<void> {
    if (this.isMuted || !text) return;

    await this.stop();

    const targetLang = langOverride || this.currentLanguage;
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
        // Fallback to Indian English voice if regional language voice pack is missing on device OS
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
