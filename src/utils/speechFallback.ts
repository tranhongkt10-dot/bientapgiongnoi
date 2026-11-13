import { VoiceOption, DialogueLine } from '../types';
import { AVAILABLE_VOICES } from '../data/voices';

/**
 * Clean text for SpeechSynthesis by removing XML-like tags like <breath>, <laugh>, |mhm|
 */
export function cleanTextForSpeech(rawText: string): string {
  return rawText
    .replace(/<[^>]+>/g, ' ')
    .replace(/\|[^|]+\|/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Configure voice parameters for Web Speech API based on role, gender, region and childhood
 */
export function getSpeechParams(voice?: VoiceOption) {
  let pitch = 1.0;
  let rate = 1.0;

  if (!voice) return { pitch, rate };

  if (voice.isChild || voice.role === 'kids' || voice.category === 'youth') {
    pitch = 1.45;
    rate = 1.05;
  } else if (voice.role === 'mc') {
    pitch = voice.gender === 'female' ? 1.15 : 0.98;
    rate = 1.06;
  } else if (voice.role === 'editor') {
    pitch = voice.gender === 'female' ? 1.06 : 0.92;
    rate = 1.02;
  } else if (voice.role === 'storyteller') {
    pitch = voice.gender === 'female' ? 1.02 : 0.85;
    rate = 0.9;
  } else if (voice.role === 'maternal') {
    pitch = 1.08;
    rate = 0.92;
  } else if (voice.region === 'mientay') {
    pitch = voice.gender === 'female' ? 1.12 : 0.95;
    rate = 1.02;
  } else if (voice.region === 'hue') {
    pitch = 1.05;
    rate = 0.92;
  } else if (voice.gender === 'male') {
    pitch = 0.88;
    rate = 0.98;
  } else {
    pitch = 1.1;
    rate = 1.0;
  }

  return { pitch, rate };
}

/**
 * Find best Vietnamese voice in browser SpeechSynthesis
 */
export function getBestVietnameseVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;

  const voices = window.speechSynthesis.getVoices();
  const viVoice = voices.find(
    (v) =>
      v.lang.toLowerCase().includes('vi') ||
      v.name.toLowerCase().includes('vietnam') ||
      v.name.toLowerCase().includes('vietnamese')
  );
  return viVoice || null;
}

/**
 * Generate a client-side WAV Blob (24kHz Mono 16-bit PCM) for instant fallback audio playback & download
 */
export function generateClientFallbackWav(durationSeconds = 4): Blob {
  const sampleRate = 24000;
  const numSamples = Math.floor(Math.max(2, Math.min(25, durationSeconds)) * sampleRate);
  const dataSize = numSamples * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // Write ASCII string helper
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // RIFF Chunk
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');

  // fmt subchunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // 16 for PCM
  view.setUint16(20, 1, true); // Linear PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // Byte rate
  view.setUint16(32, 2, true); // Block align
  view.setUint16(34, 16, true); // Bits per sample

  // data subchunk
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Gentle acoustic melodic harmonic chime
  const chord = [261.63, 329.63, 392.0, 523.25];
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let sample = 0;
    const decay = Math.exp(-t * 0.45) * Math.min(1, t * 15);
    for (const freq of chord) {
      sample += Math.sin(2 * Math.PI * freq * t) * 0.22;
    }
    sample += Math.sin(2 * Math.PI * 440 * t) * 0.08 * Math.exp(-t * 1.2);
    const int16 = Math.max(-32767, Math.min(32767, Math.floor(sample * decay * 14000)));
    view.setInt16(44 + i * 2, int16, true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

// Global active dialogue controller to allow cancel/stop
let activeDialogueCancel: (() => void) | null = null;

export function stopAnyActiveSpeech() {
  if (activeDialogueCancel) {
    activeDialogueCancel();
    activeDialogueCancel = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

/**
 * Speak single speaker text using SpeechSynthesis with custom voice tone
 */
export function speakSingleText(
  rawText: string,
  voiceObj?: VoiceOption,
  onStart?: () => void,
  onEnd?: () => void
): () => void {
  stopAnyActiveSpeech();

  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    onEnd?.();
    return () => {};
  }

  const cleaned = cleanTextForSpeech(rawText);
  if (!cleaned) {
    onEnd?.();
    return () => {};
  }

  const utterance = new SpeechSynthesisUtterance(cleaned);
  const viVoice = getBestVietnameseVoice();
  if (viVoice) utterance.voice = viVoice;
  utterance.lang = 'vi-VN';

  const { pitch, rate } = getSpeechParams(voiceObj);
  utterance.pitch = pitch;
  utterance.rate = rate;

  utterance.onstart = () => {
    onStart?.();
  };
  utterance.onend = () => {
    onEnd?.();
  };
  utterance.onerror = () => {
    onEnd?.();
  };

  window.speechSynthesis.speak(utterance);

  return () => {
    window.speechSynthesis.cancel();
  };
}

/**
 * Speak multi-line dialogue sequentially with alternating speaker voice characteristics
 */
export function speakDialogueLines(
  lines: DialogueLine[],
  onStart?: () => void,
  onEnd?: () => void,
  onLineChange?: (lineIndex: number) => void
): () => void {
  stopAnyActiveSpeech();

  if (typeof window === 'undefined' || !('speechSynthesis' in window) || lines.length === 0) {
    onEnd?.();
    return () => {};
  }

  let isCancelled = false;
  let currentIndex = 0;

  const cancelFn = () => {
    isCancelled = true;
    window.speechSynthesis.cancel();
  };
  activeDialogueCancel = cancelFn;

  onStart?.();

  const speakNext = () => {
    if (isCancelled || currentIndex >= lines.length) {
      activeDialogueCancel = null;
      onEnd?.();
      return;
    }

    const currentLine = lines[currentIndex];
    const cleaned = cleanTextForSpeech(currentLine.text);

    if (!cleaned) {
      currentIndex++;
      speakNext();
      return;
    }

    onLineChange?.(currentIndex);

    const voiceObj = AVAILABLE_VOICES.find(
      (v) => v.id === currentLine.voiceName || v.voiceName === currentLine.voiceName
    );

    const utterance = new SpeechSynthesisUtterance(cleaned);
    const viVoice = getBestVietnameseVoice();
    if (viVoice) utterance.voice = viVoice;
    utterance.lang = 'vi-VN';

    const { pitch, rate } = getSpeechParams(voiceObj);
    utterance.pitch = pitch;
    utterance.rate = rate;

    utterance.onend = () => {
      currentIndex++;
      // Brief natural pause between dialogue turns
      setTimeout(speakNext, 350);
    };

    utterance.onerror = () => {
      currentIndex++;
      speakNext();
    };

    window.speechSynthesis.speak(utterance);
  };

  speakNext();

  return cancelFn;
}
