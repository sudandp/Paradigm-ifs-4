/**
 * Audio Feedback Utility — Web Audio API based sounds
 * 
 * Generates short audio tones for biometric events without
 * needing external sound files. Works on all modern browsers.
 * 
 * Used by: GateKiosk, PersonalFaceAuth, RegisterGateUser
 */

type SoundType = 'success' | 'error' | 'warning' | 'scan' | 'duplicate';

// Cache the AudioContext to avoid creating multiple instances
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  // Resume if suspended (browser autoplay policy)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Play a single tone at a specific frequency
 */
function playTone(
  frequency: number,
  duration: number,
  type: OscillatorType = 'sine',
  volume: number = 0.3,
  delay: number = 0
): void {
  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime + delay);
    
    // Envelope: quick attack, hold, quick release
    gainNode.gain.setValueAtTime(0, ctx.currentTime + delay);
    gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + delay + 0.02);
    gainNode.gain.setValueAtTime(volume, ctx.currentTime + delay + duration - 0.05);
    gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + delay + duration);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(ctx.currentTime + delay);
    oscillator.stop(ctx.currentTime + delay + duration);
  } catch (err) {
    // Silently fail — audio is never critical
    console.warn('[audioFeedback] Failed to play tone:', err);
  }
}

/**
 * Play a feedback sound for biometric events.
 * 
 * @param sound - The type of sound to play:
 *   - `success`: Rising two-tone chime (face matched, attendance recorded)
 *   - `error`: Low descending buzz (match failed, camera error)
 *   - `warning`: Mid-frequency alert pulse (timeout, retry needed)
 *   - `scan`: Short blip (face detected, scan started)
 *   - `duplicate`: Distinctive three-tone alert (duplicate face found)
 */
export function playFeedbackSound(sound: SoundType): void {
  switch (sound) {
    case 'success':
      // Rising two-tone chime: C5 → E5
      playTone(523.25, 0.12, 'sine', 0.25, 0);      // C5
      playTone(659.25, 0.2, 'sine', 0.25, 0.12);     // E5
      break;

    case 'error':
      // Low descending buzz: E3 → C3
      playTone(164.81, 0.15, 'square', 0.15, 0);     // E3
      playTone(130.81, 0.25, 'square', 0.15, 0.15);   // C3
      break;

    case 'warning':
      // Two quick mid-frequency pulses
      playTone(440, 0.1, 'triangle', 0.2, 0);        // A4
      playTone(440, 0.1, 'triangle', 0.2, 0.18);     // A4
      break;

    case 'scan':
      // Short subtle blip
      playTone(880, 0.06, 'sine', 0.12, 0);          // A5 blip
      break;

    case 'duplicate':
      // Distinctive three-tone descending alert: G5 → E5 → C5
      playTone(783.99, 0.12, 'triangle', 0.25, 0);    // G5
      playTone(659.25, 0.12, 'triangle', 0.25, 0.14); // E5
      playTone(523.25, 0.22, 'triangle', 0.25, 0.28); // C5
      break;
  }
}

/**
 * Pre-warm the AudioContext on user interaction.
 * Call this once on a user gesture (click/tap) to avoid
 * browser autoplay restrictions blocking future sounds.
 */
export function initAudioContext(): void {
  try {
    const ctx = getAudioContext();
    // Play a silent buffer to "unlock" the context
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
  } catch {
    // Not critical
  }
}
