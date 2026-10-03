/**
 * Synthesizes a luxury acoustic lounge chime (432Hz harmonic chord) using Web Audio API
 */
let audioCtx: AudioContext | null = null;

// Voice announcements preferences & user interaction unlock
const VOICE_STORAGE_KEY = 'daltek_voice_announcements_enabled';

/**
 * Checks if voice announcements are enabled (defaults to true)
 */
export function isVoiceEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const stored = localStorage.getItem(VOICE_STORAGE_KEY);
  if (stored === null) return true; // Enabled by default
  return stored === 'true';
}

/**
 * Sets voice announcements preference
 */
export function setVoiceEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(VOICE_STORAGE_KEY, enabled ? 'true' : 'false');
}

/**
 * Track user gesture audio unlock for browsers that block autoplay
 */
let isAudioUnlocked = false;

export function getIsAudioUnlocked(): boolean {
  return isAudioUnlocked;
}

/**
 * Call on first user click to unlock AudioContext and SpeechSynthesis
 */
export function unlockAudioSystem(): void {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!audioCtx && AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    if ('speechSynthesis' in window) {
      window.speechSynthesis.resume();
      // Speak a silent micro-utterance to unlock speech on iOS/Safari/Chrome
      const silentUtterance = new SpeechSynthesisUtterance('');
      silentUtterance.volume = 0;
      window.speechSynthesis.speak(silentUtterance);
    }

    isAudioUnlocked = true;
  } catch (err) {
    console.warn('Audio unlock warning:', err);
  }
}

export function playLuxuryChime(frequencyMultiplier = 1.0) {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!audioCtx && AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    if (!audioCtx) return;
    const now = audioCtx.currentTime;

    // Luxury 3-stage harmonic chime: 523.25Hz (C5), 659.25Hz (E5), 783.99Hz (G5) with rich warmth
    const notes = [
      { freq: 523.25 * frequencyMultiplier, start: 0.0, duration: 1.2, gain: 0.18 },
      { freq: 659.25 * frequencyMultiplier, start: 0.14, duration: 1.4, gain: 0.16 },
      { freq: 783.99 * frequencyMultiplier, start: 0.28, duration: 1.8, gain: 0.14 },
      { freq: 1046.5 * frequencyMultiplier, start: 0.32, duration: 1.0, gain: 0.06 },
    ];

    notes.forEach(({ freq, start, duration, gain }) => {
      if (!audioCtx) return;
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + start);

      gainNode.gain.setValueAtTime(0.0001, now + start);
      gainNode.gain.exponentialRampToValueAtTime(gain, now + start + 0.04);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);

      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      osc.start(now + start);
      osc.stop(now + start + duration);
    });
  } catch (err) {
    console.warn('Audio chime playback omitted or unsupported:', err);
  }
}

/**
 * Deduplication cache: stores ticket call signatures announced in the last 15 seconds
 * to strictly prevent duplicate vocal announcements across renders, re-renders or WebSocket reconnects.
 */
const recentAnnouncements = new Map<string, number>();

/**
 * Automatically announces a called ticket with a native French voice:
 * « Numéro [ticketNumber], veuillez vous présenter. »
 * 
 * Strict specifications:
 * - Number is dynamically generated from ticket.id (never fixed)
 * - French language synthesis (fr-FR / fr)
 * - Strict check against voiceEnabled setting
 * - De-duplicated per event (never announced multiple times on reconnection or re-renders)
 * - Preceded by subtle acoustic luxury chime
 */
export function announceTicketCall(ticketNumber: number | string, deskName?: string): boolean {
  if (typeof window === 'undefined') return false;

  // 1. Strict check: are vocal announcements enabled?
  if (!isVoiceEnabled()) {
    return false;
  }

  const num = String(ticketNumber).trim();
  if (!num) return false;

  // 2. Strict deduplication check: within 12 seconds, do not re-announce identical ticket
  const now = Date.now();
  const signature = `${num}_${deskName || 'desk'}`;
  const lastTime = recentAnnouncements.get(signature);

  if (lastTime && now - lastTime < 12000) {
    return false; // Prevent duplicate announcement
  }

  recentAnnouncements.set(signature, now);

  // Clean old deduplication entries
  for (const [key, timestamp] of recentAnnouncements.entries()) {
    if (now - timestamp > 30000) {
      recentAnnouncements.delete(key);
    }
  }

  // 3. Play luxury acoustic chime
  playLuxuryChime();

  // 4. Synthesize voice in French
  if (!('speechSynthesis' in window)) {
    return false;
  }

  try {
    window.speechSynthesis.cancel(); // Cancel any lingering utterance

    // Dynamic phrase strictly based on the real called number
    // Specification: « Numéro 14, veuillez vous présenter. » (14 being dynamic)
    const textToAnnounce = deskName && deskName.trim().length > 0 && deskName !== 'Standard'
      ? `Numéro ${num}, veuillez vous présenter au ${deskName}.`
      : `Numéro ${num}, veuillez vous présenter.`;

    const utterance = new SpeechSynthesisUtterance(textToAnnounce);
    utterance.lang = 'fr-FR';
    utterance.rate = 0.92; // Slightly calm, authoritative, perfectly articulate for waiting rooms / TVs
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Pick best available French voice
    const voices = window.speechSynthesis.getVoices();
    const frenchVoice = voices.find(
      (v) => (v.lang.startsWith('fr') || v.lang === 'fr-FR' || v.lang === 'fr-CA') && !v.name.includes('Compact')
    ) || voices.find((v) => v.lang.startsWith('fr'));

    if (frenchVoice) {
      utterance.voice = frenchVoice;
    }

    // Delay speech slightly to let the luxury acoustic chime resonate first
    setTimeout(() => {
      try {
        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.warn('Speech synthesis speak error:', e);
      }
    }, 450);

    return true;
  } catch (err) {
    console.warn('Speech synthesis error:', err);
    return false;
  }
}

