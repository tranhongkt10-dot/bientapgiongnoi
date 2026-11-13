import React, { useState, useEffect, useRef } from 'react';
import { apiUrl } from './utils/api';
import { SingleSpeakerStudio } from './components/SingleSpeakerStudio';
import { DialogueStudio } from './components/DialogueStudio';
import { AudioPlayer } from './components/AudioPlayer';
import { HistoryList } from './components/HistoryList';
import { QUICK_PRESETS, AVAILABLE_VOICES } from './data/voices';
import { GeneratedAudio, DialogueLine } from './types';
import {
  speakSingleText,
  speakDialogueLines,
  stopAnyActiveSpeech,
} from './utils/speechFallback';
import {
  Sparkles,
  Heart,
  Volume2,
  Users,
  Mic2,
  BookmarkCheck,
  Headphones,
  MapPin,
  AlertCircle,
  Zap,
  Info,
  Radio,
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'single' | 'dialogue'>('single');
  const [ttsEngine, setTtsEngine] = useState<'gemini' | 'browser'>('gemini');
  const [isFallbackActive, setIsFallbackActive] = useState<boolean>(false);
  const [quotaNotice, setQuotaNotice] = useState<string | null>(null);

  // Single speaker state - initialized with user's requested Vietnamese maternal quote
  const [singleText, setSingleText] = useState(
    'Này con yêu ơi con biết không, mẹ yêu con yêu con nhất trên đời. <breath> Dù mai này khôn lớn, đi đến muôn trùng phương xa, vòng tay mẹ vẫn luôn ở đây chở che cho con.'
  );
  const [selectedVoice, setSelectedVoice] = useState('kore_hanoi');
  const [stylePrompt, setStylePrompt] = useState(
    'Warm, deeply emotional, whispering maternal lullaby filled with unconditional love, tender breathing and gentle maternal warmth'
  );

  // Dialogue state
  const [speaker1Name, setSpeaker1Name] = useState('Mẹ (Hà Nội)');
  const [speaker1Voice, setSpeaker1Voice] = useState('kore_hanoi');
  const [speaker2Name, setSpeaker2Name] = useState('Con (Sài Gòn)');
  const [speaker2Voice, setSpeaker2Voice] = useState('puck_saigon');
  const [dialogue, setDialogue] = useState<DialogueLine[]>([
    {
      id: 'd1',
      speaker: 'Mẹ (Hà Nội)',
      text: 'Này con yêu ơi, hôm nay ngày đầu đi học con cảm thấy thế nào? <breath>',
      style: 'Warm, tender mother greeting her child with gentle smile',
      voiceName: 'kore_hanoi',
    },
    {
      id: 'd2',
      speaker: 'Con (Sài Gòn)',
      text: 'Dạ vui lắm mẹ ơi! |yeah| Con được cô khen vẽ tranh đẹp, con vẽ tặng mẹ đó! <laugh>',
      style: 'Excited, cheerful little child bouncing with happiness',
      voiceName: 'puck_saigon',
    },
    {
      id: 'd3',
      speaker: 'Mẹ (Hà Nội)',
      text: 'Mẹ cảm ơn con yêu. <breath> Bức tranh đẹp nhất mà mẹ từng thấy luôn đấy!',
      style: 'Deeply moved, affectionate and proud mother',
      voiceName: 'kore_hanoi',
    },
  ]);

  // Audio generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
  const [currentSnippet, setCurrentSnippet] = useState<string>('');
  const [currentVoiceName, setCurrentVoiceName] = useState<string>('Thu Hà - Hà Nội (Bắc)');
  const [currentStyle, setCurrentStyle] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // History state
  const [history, setHistory] = useState<GeneratedAudio[]>(() => {
    try {
      const saved = localStorage.getItem('voicebloom_tts_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('voicebloom_tts_history', JSON.stringify(history.slice(0, 15)));
    } catch (e) {
      console.warn('Failed to save history to localStorage', e);
    }
  }, [history]);

  // Speech fallback trigger handler for audio player sync
  const handlePlaySpeechFallback = () => {
    if (activeTab === 'single') {
      const voiceObj =
        AVAILABLE_VOICES.find((v) => v.id === selectedVoice) || AVAILABLE_VOICES[0];
      speakSingleText(currentSnippet || singleText, voiceObj);
    } else {
      speakDialogueLines(dialogue);
    }
  };

  // Generate Single Speaker TTS with Regional Voice
  const handleGenerateSingle = async () => {
    if (!singleText.trim()) return;
    setIsGenerating(true);
    setError(null);
    stopAnyActiveSpeech();

    const voiceObj =
      AVAILABLE_VOICES.find((v) => v.id === selectedVoice) || AVAILABLE_VOICES[0];
    const displayName = `${voiceObj.name} - ${voiceObj.regionName}`;

    // Browser speech is for immediate listening only; it is not a downloadable audio file.
    if (ttsEngine === 'browser') {
      setCurrentAudioUrl(null);
      setCurrentSnippet(singleText.trim());
      setCurrentVoiceName(displayName);
      setCurrentStyle(`${voiceObj.regionName} • Giọng đọc trực tiếp trên trình duyệt`);
      setIsFallbackActive(true);
      setQuotaNotice('Chế độ miễn phí của trình duyệt chỉ phát giọng trực tiếp; muốn tải file WAV/MP3, hãy dùng Gemini TTS khi máy chủ đã kết nối.');
      speakSingleText(singleText.trim(), voiceObj);
      setIsGenerating(false);
      return;
    }

    // 2. Gemini 3.8 Flash TTS mode with automatic server & client fallback
    try {
      const res = await fetch(apiUrl('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'single',
          text: singleText.trim(),
          voiceName: voiceObj.voiceName,
          accentInstruction: voiceObj.accentInstruction,
          style: stylePrompt,
        }),
      });

      const data = await res.json();

      if (data.audioData) {
        // Convert base64 audio to Blob URL
        const byteCharacters = atob(data.audioData);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: data.mimeType || 'audio/wav' });
        const audioUrl = URL.createObjectURL(blob);

        setCurrentAudioUrl(audioUrl);
        setCurrentSnippet(singleText.trim());
        setCurrentVoiceName(displayName);
        setCurrentStyle(`${voiceObj.regionName} &bull; ${stylePrompt}`);

        const isQuotaFallback = !!(data.quotaExceeded || data.isFallback);
        setIsFallbackActive(isQuotaFallback);

        if (isQuotaFallback) {
          setQuotaNotice(
            data.notice ||
              'Tài khoản đã đạt hạn mức 10 yêu cầu/ngày của Gemini TTS miễn phí. Đã kích hoạt Giọng Đọc Dự Phòng (Web Speech Engine).'
          );
          // Speak with Web Speech API for voice clarity
          speakSingleText(singleText.trim(), voiceObj);
        } else {
          setQuotaNotice(null);
        }

        const newEntry: GeneratedAudio = {
          id: `tts-${Date.now()}`,
          timestamp: Date.now(),
          text: singleText.trim(),
          audioUrl: audioUrl,
          voiceName: displayName,
          style: isQuotaFallback ? `${voiceObj.regionName} (Giọng Dự Phòng)` : stylePrompt,
          mode: 'single',
          regionName: voiceObj.regionName,
        };
        setHistory((prev) => [newEntry, ...prev.slice(0, 14)]);
      } else {
        throw new Error(data.error || 'Không nhận được dữ liệu âm thanh');
      }
    } catch (err: any) {
      setError(err?.message || 'Không kết nối được máy chủ tạo giọng. Hãy kiểm tra địa chỉ API và API key.');
      setCurrentAudioUrl(null);
      setCurrentSnippet(preview);
      setCurrentVoiceName(compositeName);
      setCurrentStyle('Đối thoại phát trực tiếp bằng giọng hệ thống');
      setIsFallbackActive(true);
      setQuotaNotice('Gemini TTS chưa khả dụng. Bạn có thể nghe trực tiếp bằng giọng tiếng Việt có sẵn trên thiết bị; chức năng tải file chỉ hoạt động khi API Gemini kết nối thành công.');
      speakDialogueLines(dialogue);
    } finally {
      setIsGenerating(false);
    }
  };

  // Generate Dual Speaker Dialogue TTS
  const handleGenerateDialogue = async () => {
    if (dialogue.length === 0) return;
    setIsGenerating(true);
    setError(null);
    stopAnyActiveSpeech();

    const preview = dialogue.map((d) => `${d.speaker}: ${d.text}`).join(' | ');
    const spk1Obj = AVAILABLE_VOICES.find(
      (v) => v.id === speaker1Voice || v.voiceName === speaker1Voice
    );
    const spk2Obj = AVAILABLE_VOICES.find(
      (v) => v.id === speaker2Voice || v.voiceName === speaker2Voice
    );
    const compositeName = `${speaker1Name} (${spk1Obj?.regionName || 'Bắc'}) & ${speaker2Name} (${spk2Obj?.regionName || 'Nam'})`;

    // Browser speech is for immediate listening only; it is not a downloadable audio file.
    if (ttsEngine === 'browser') {
      setCurrentAudioUrl(null);
      setCurrentSnippet(preview);
      setCurrentVoiceName(compositeName);
      setCurrentStyle('Đối thoại phát trực tiếp trên trình duyệt');
      setIsFallbackActive(true);
      setQuotaNotice('Chế độ miễn phí của trình duyệt chỉ phát giọng trực tiếp; muốn tải file WAV/MP3, hãy dùng Gemini TTS khi máy chủ đã kết nối.');
      speakDialogueLines(dialogue);
      setIsGenerating(false);
      return;
    }

    // 2. Gemini 3.8 Flash TTS dialogue mode
    try {
      const res = await fetch(apiUrl('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'dialogue',
          dialogue: dialogue.map((line) => {
            const vObj = AVAILABLE_VOICES.find(
              (v) => v.id === line.voiceName || v.voiceName === line.voiceName
            );
            return {
              speaker: line.speaker,
              text: line.text,
              style: line.style,
              voiceName: vObj?.voiceName || 'Kore',
              accentInstruction: vObj?.accentInstruction,
            };
          }),
        }),
      });

      const data = await res.json();

      if (data.audioData) {
        const byteCharacters = atob(data.audioData);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: data.mimeType || 'audio/wav' });
        const audioUrl = URL.createObjectURL(blob);

        setCurrentAudioUrl(audioUrl);
        setCurrentSnippet(preview);
        setCurrentVoiceName(compositeName);
        setCurrentStyle('Kịch bản đối thoại vùng miền');

        const isQuotaFallback = !!(data.quotaExceeded || data.isFallback);
        setIsFallbackActive(isQuotaFallback);

        if (isQuotaFallback) {
          setQuotaNotice(
            data.notice ||
              'Tài khoản đã đạt hạn mức 10 yêu cầu/ngày của Gemini TTS miễn phí. Đã kích hoạt Giọng Đọc Dự Phòng (Web Speech Engine).'
          );
          speakDialogueLines(dialogue);
        } else {
          setQuotaNotice(null);
        }

        const newEntry: GeneratedAudio = {
          id: `tts-${Date.now()}`,
          timestamp: Date.now(),
          text: preview,
          dialoguePreview: preview,
          audioUrl: audioUrl,
          voiceName: compositeName,
          style: isQuotaFallback ? 'Đối thoại 2 người (Giọng Dự Phòng)' : 'Đối thoại 2 người',
          mode: 'dialogue',
          regionName: 'Đa vùng miền',
        };
        setHistory((prev) => [newEntry, ...prev.slice(0, 14)]);
      } else {
        throw new Error(data.error || 'Không thể tạo âm thanh đối thoại');
      }
    } catch (err: any) {
      console.warn('Dialogue API error, activating client speech fallback:', err);
      const estDuration = Math.max(4, Math.min(25, dialogue.length * 4));
      const blob = generateClientFallbackWav(estDuration);
      const audioUrl = URL.createObjectURL(blob);

      setCurrentAudioUrl(audioUrl);
      setCurrentSnippet(preview);
      setCurrentVoiceName(compositeName);
      setCurrentStyle('Kịch bản đối thoại vùng miền (Giọng Dự Phòng)');
      setIsFallbackActive(true);
      setQuotaNotice(
        'Tài khoản đã đạt hạn mức Gemini TTS trong ngày. Đã kích hoạt Giọng Đọc Dự Phòng (Web Speech Engine) để bạn tiếp tục trải nghiệm không giới hạn.'
      );

      speakDialogueLines(dialogue);

      const newEntry: GeneratedAudio = {
        id: `tts-${Date.now()}`,
        timestamp: Date.now(),
        text: preview,
        dialoguePreview: preview,
        audioUrl: audioUrl,
        voiceName: compositeName,
        style: 'Đối thoại 2 người (Giọng Dự Phòng)',
        mode: 'dialogue',
        regionName: 'Đa vùng miền',
      };
      setHistory((prev) => [newEntry, ...prev.slice(0, 14)]);
    } finally {
      setIsGenerating(false);
    }
  };

  const applyPreset = (preset: typeof QUICK_PRESETS[0]) => {
    if (preset.mode === 'single') {
      setActiveTab('single');
      if (preset.text) setSingleText(preset.text);
      if (preset.voiceId) {
        setSelectedVoice(preset.voiceId);
      } else if (preset.voiceName) {
        const v = AVAILABLE_VOICES.find((vo) => vo.voiceName === preset.voiceName);
        if (v) setSelectedVoice(v.id);
      }
      if (preset.style) setStylePrompt(preset.style);
    } else if (preset.mode === 'dialogue' && preset.dialogue) {
      setActiveTab('dialogue');
      setDialogue(
        preset.dialogue.map((d, idx) => ({
          id: `dlg-${idx}`,
          speaker: d.speaker,
          text: d.text,
          style: d.style,
          voiceName: d.voiceId || d.voiceName,
        }))
      );
    }
  };

  const handleSelectHistory = (item: GeneratedAudio) => {
    setCurrentAudioUrl(item.audioUrl);
    setCurrentSnippet(item.dialoguePreview || item.text);
    setCurrentVoiceName(item.voiceName);
    setCurrentStyle(item.style);
  };

  const handleDeleteHistory = (id: string) => {
    setHistory((prev) => prev.filter((h) => h.id !== id));
  };

  const handleClearHistory = () => {
    setHistory([]);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-rose-500/30 selection:text-rose-200">
      {/* Top Banner & Header */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-rose-500 via-pink-500 to-purple-600 text-white shadow-lg shadow-rose-500/25">
              <Heart className="h-5 w-5 fill-white/20" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-white font-serif">
                  VoiceBloom TTS
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-rose-300 ring-1 ring-rose-500/20">
                  <Sparkles className="h-3 w-3" />
                  Gemini 3.8 Flash TTS
                </span>
                <span className="hidden md:inline-flex items-center gap-1 rounded-full bg-slate-800/80 px-2 py-0.5 text-[11px] font-medium text-slate-300">
                  MC &bull; BTV &bull; Kể Chuyện &bull; Dẫn Chuyện &bull; Trẻ Em &bull; Lời Mẹ Ru
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Studio giọng đọc AI chuyên nghiệp: MC sự kiện, BTV thời sự, Người kể chuyện, Dẫn chuyện podcast, Giọng trẻ em & Lời mẹ ru 3 miền
              </p>
            </div>
          </div>

          {/* Controls: Engine Selector & Mode Switch Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Engine Selector */}
            <div className="flex items-center rounded-xl bg-slate-900 p-1 ring-1 ring-slate-800">
              <button
                onClick={() => setTtsEngine('gemini')}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                  ttsEngine === 'gemini'
                    ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Gemini 3.8 Flash TTS AI (Chất lượng cao, giới hạn 10 lượt/ngày trên Free Tier)"
              >
                <Sparkles className="h-3 w-3" />
                <span>Gemini TTS</span>
              </button>
              <button
                onClick={() => setTtsEngine('browser')}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                  ttsEngine === 'browser'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Web Speech Engine (Không giới hạn lượt dùng, miễn phí 100%)"
              >
                <Volume2 className="h-3 w-3" />
                <span>Giọng Dự Phòng</span>
                <span className="rounded bg-amber-400/40 text-[10px] px-1 py-0.2 ml-0.5">Vô hạn</span>
              </button>
            </div>

            {/* Mode Switch Tabs */}
            <div className="flex items-center rounded-xl bg-slate-900 p-1 ring-1 ring-slate-800">
              <button
                onClick={() => setActiveTab('single')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  activeTab === 'single'
                    ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Mic2 className="h-3.5 w-3.5" />
                <span>Đơn Thoại</span>
              </button>

              <button
                onClick={() => setActiveTab('dialogue')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  activeTab === 'dialogue'
                    ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                <span>Đối Thoại 2 Người</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        {/* Quota Exceeded / Fallback Notice Banner */}
        {quotaNotice && (
          <div className="mb-6 rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-950/40 via-slate-900/90 to-amber-950/30 p-4 shadow-lg backdrop-blur-md animate-fadeIn">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40">
                  <Zap className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-bold text-amber-200">
                      Đang Hoạt Động Ở Chế Độ Giọng Đọc Dự Phòng (Web Speech Engine)
                    </h4>
                    <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300 border border-amber-500/30">
                      Không giới hạn lượt dùng
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                    {quotaNotice}
                  </p>
                  <p className="mt-1.5 text-[11px] text-slate-400 flex items-center gap-1.5">
                    <Info className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                    <span>
                      Hệ thống tự động đồng bộ giọng đọc trên trình duyệt để bạn trải nghiệm liên tục mà không bị gián đoạn.
                    </span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setQuotaNotice(null)}
                className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-slate-800 shrink-0"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        )}

        {/* Quick Presets Bar */}
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BookmarkCheck className="h-4 w-4 text-rose-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Mẫu Giọng Đọc Chọn Lọc 3 Miền (Presets)
              </h2>
            </div>
            <span className="text-xs text-slate-500">Bấm để tải nhanh nội dung</span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {QUICK_PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => applyPreset(p)}
                className="group relative flex flex-col items-start rounded-xl border border-slate-800/80 bg-slate-900/60 p-3.5 text-left transition hover:border-rose-500/40 hover:bg-slate-800/50 hover:shadow-lg hover:shadow-rose-500/5"
              >
                <div className="flex w-full items-center justify-between">
                  <span className="text-2xl">{p.icon}</span>
                  <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-300 group-hover:bg-rose-500/20 group-hover:text-rose-200">
                    {p.mode === 'single' ? 'Đơn thoại' : 'Đối thoại'}
                  </span>
                </div>
                <h3 className="mt-2 text-sm font-bold text-slate-100 group-hover:text-rose-300 transition">
                  {p.title}
                </h3>
                <p className="mt-0.5 text-xs text-slate-400 line-clamp-1">
                  {p.subtitle}
                </p>
              </button>
            ))}
          </div>
        </section>

        {/* 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left Column: Editor Studio (7 cols on large) */}
          <div className="lg:col-span-7">
            {activeTab === 'single' ? (
              <SingleSpeakerStudio
                text={singleText}
                setText={setSingleText}
                selectedVoice={selectedVoice}
                setSelectedVoice={setSelectedVoice}
                stylePrompt={stylePrompt}
                setStylePrompt={setStylePrompt}
                onGenerate={handleGenerateSingle}
                isGenerating={isGenerating}
                error={error}
              />
            ) : (
              <DialogueStudio
                dialogue={dialogue}
                setDialogue={setDialogue}
                speaker1Name={speaker1Name}
                setSpeaker1Name={setSpeaker1Name}
                speaker1Voice={speaker1Voice}
                setSpeaker1Voice={setSpeaker1Voice}
                speaker2Name={speaker2Name}
                setSpeaker2Name={setSpeaker2Name}
                speaker2Voice={speaker2Voice}
                setSpeaker2Voice={setSpeaker2Voice}
                onGenerate={handleGenerateDialogue}
                isGenerating={isGenerating}
                error={error}
              />
            )}
          </div>

          {/* Right Column: Audio Player & History (5 cols on large) */}
          <div className="space-y-6 lg:col-span-5">
            {/* Visualizer & Player */}
            <AudioPlayer
              audioUrl={currentAudioUrl}
              textSnippet={currentSnippet}
              voiceName={currentVoiceName}
              stylePrompt={currentStyle}
              isFallback={isFallbackActive}
              onPlaySpeechFallback={handlePlaySpeechFallback}
            />

            {/* Regional Voices Highlights Card */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 backdrop-blur-md">
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="h-4 w-4 text-rose-400" />
                <h3 className="text-sm font-semibold text-slate-200">
                  Âm Hưởng Giọng Đọc 3 Miền Chuẩn Xác
                </h3>
              </div>
              <ul className="space-y-2.5 text-xs text-slate-400">
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 font-bold shrink-0">🏛️ Hà Nội:</span>
                  <span>
                    Chuẩn mực thủ đô, tròn vành rõ chữ, thanh lịch và giàu chất thơ.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 font-bold shrink-0">🌴 Sài Gòn:</span>
                  <span>
                    Chân chất, ngọt ngào, hào sảng và thân thiện, tràn đầy sức sống.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-400 font-bold shrink-0">🏯 Huế:</span>
                  <span>
                    Trầm bổng, da diết, tiếng "dạ thưa" e ấp xứ sông Hương núi Ngự.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-400 font-bold shrink-0">🌾 Nghệ An:</span>
                  <span>
                    Mộc mạc, đậm đà, tha thiết với câu hò ví giặm và tình quê sâu nặng.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 font-bold shrink-0">🌊 Hà Tĩnh:</span>
                  <span>
                    Sâu lắng, kiên cường, đượm nét thơ mộng sông La núi Hồng.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-teal-400 font-bold shrink-0">🛶 Miền Tây:</span>
                  <span>
                    Ngọt lịm, đôn hậu, hào sảng mênh mang phù sa sông nước Nam Bộ.
                  </span>
                </li>
              </ul>
            </div>

            {/* History List */}
            <HistoryList
              history={history}
              onSelect={handleSelectHistory}
              onDelete={handleDeleteHistory}
              onClearAll={handleClearHistory}
              activeAudioUrl={currentAudioUrl}
            />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-900 bg-slate-950 py-4 text-center text-xs text-slate-600">
        <p>
          VoiceBloom TTS &bull; Powered by Google Gemini 3.8 Flash TTS &bull; Nghệ thuật giọng đọc ba miền Bắc - Trung - Nam
        </p>
      </footer>
    </div>
  );
}
