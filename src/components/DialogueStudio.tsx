import React, { useState, useRef, useEffect } from 'react';
import { apiUrl } from '../utils/api';
import { DialogueLine } from '../types';
import { AVAILABLE_VOICES, VOCAL_TAGS } from '../data/voices';
import {
  Plus,
  Trash2,
  MessageSquare,
  Sparkles,
  Loader2,
  AlertCircle,
  Play,
  Square,
  Volume2,
} from 'lucide-react';

interface DialogueStudioProps {
  dialogue: DialogueLine[];
  setDialogue: React.Dispatch<React.SetStateAction<DialogueLine[]>>;
  speaker1Name: string;
  setSpeaker1Name: (name: string) => void;
  speaker1Voice: string;
  setSpeaker1Voice: (voice: string) => void;
  speaker2Name: string;
  setSpeaker2Name: (name: string) => void;
  speaker2Voice: string;
  setSpeaker2Voice: (voice: string) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  error: string | null;
}

export const DialogueStudio: React.FC<DialogueStudioProps> = ({
  dialogue,
  setDialogue,
  speaker1Name,
  setSpeaker1Name,
  speaker1Voice,
  setSpeaker1Voice,
  speaker2Name,
  setSpeaker2Name,
  speaker2Voice,
  setSpeaker2Voice,
  onGenerate,
  isGenerating,
  error,
}) => {
  const [activeLineId, setActiveLineId] = useState<string | null>(dialogue[0]?.id || null);

  // Audition preview state
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
    };
  }, []);

  const playSpeechSynthesisFallback = (voice: any) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setPreviewingVoiceId(null);
      setIsLoadingPreview(false);
      return;
    }

    window.speechSynthesis.cancel();
    const textToSpeak = voice?.sampleText || `Xin chào, tôi là ${voice?.name || 'nhân vật'}.`;
    const utterance = new SpeechSynthesisUtterance(textToSpeak);

    const browserVoices = window.speechSynthesis.getVoices();
    const viVoice = browserVoices.find(
      (v) =>
        v.lang.toLowerCase().includes('vi') ||
        v.name.toLowerCase().includes('vietnam') ||
        v.name.toLowerCase().includes('vietnamese')
    );
    if (viVoice) utterance.voice = viVoice;
    utterance.lang = 'vi-VN';

    if (voice?.isChild || voice?.role === 'kids' || voice?.category === 'youth') {
      utterance.pitch = 1.45;
      utterance.rate = 1.08;
    } else if (voice?.gender === 'male' && voice?.category === 'deep') {
      utterance.pitch = 0.8;
      utterance.rate = 0.95;
    } else if (voice?.gender === 'male') {
      utterance.pitch = 0.88;
      utterance.rate = 0.98;
    } else {
      utterance.pitch = 1.1;
      utterance.rate = 1.0;
    }

    setPreviewingVoiceId(voice?.id || 'spk');
    setIsLoadingPreview(false);

    utterance.onend = () => {
      setPreviewingVoiceId(null);
    };
    utterance.onerror = () => {
      setPreviewingVoiceId(null);
    };

    window.speechSynthesis.speak(utterance);
  };

  const handleTogglePreview = async (voiceId: string) => {
    if (previewingVoiceId === voiceId) {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setPreviewingVoiceId(null);
      return;
    }

    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    const voiceObj = AVAILABLE_VOICES.find((v) => v.id === voiceId || v.voiceName === voiceId);
    setPreviewingVoiceId(voiceId);
    setIsLoadingPreview(true);

    try {
      const res = await fetch(apiUrl('/api/voice-preview'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voiceName: voiceObj?.voiceName || voiceId,
          previewText: voiceObj?.sampleText || `Xin chào, tôi là ${voiceObj?.name || voiceId}.`,
          style: voiceObj?.sampleStyle,
          accentInstruction: voiceObj?.accentInstruction,
        }),
      });

      const data = await res.json();
      if (res.ok && data.audioData && !data.isFallback) {
        const byteCharacters = atob(data.audioData);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: data.mimeType || 'audio/wav' });
        const audioUrl = URL.createObjectURL(blob);

        const audio = new Audio(audioUrl);
        previewAudioRef.current = audio;

        audio.onended = () => {
          setPreviewingVoiceId(null);
          setIsLoadingPreview(false);
        };
        audio.onerror = () => {
          playSpeechSynthesisFallback(voiceObj);
        };

        await audio.play();
        setIsLoadingPreview(false);
      } else {
        playSpeechSynthesisFallback(voiceObj);
      }
    } catch (err) {
      console.warn('Dialogue preview error, falling back to speech synthesis:', err);
      playSpeechSynthesisFallback(voiceObj);
    }
  };

  const addLine = (speaker: string) => {
    const isSpk1 = speaker === speaker1Name;
    const newLine: DialogueLine = {
      id: `line-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      speaker: speaker,
      text: '',
      style: isSpk1 ? 'Warm and affectionate' : 'Enthusiastic and joyful',
      voiceName: isSpk1 ? speaker1Voice : speaker2Voice,
    };
    setDialogue((prev) => [...prev, newLine]);
    setActiveLineId(newLine.id);
  };

  const updateLine = (id: string, field: keyof DialogueLine, value: string) => {
    setDialogue((prev) =>
      prev.map((line) => (line.id === id ? { ...line, [field]: value } : line))
    );
  };

  const removeLine = (id: string) => {
    if (dialogue.length <= 1) return;
    setDialogue((prev) => prev.filter((line) => line.id !== id));
  };

  const insertTagToLine = (lineId: string, tag: string) => {
    setDialogue((prev) =>
      prev.map((line) =>
        line.id === lineId ? { ...line, text: `${line.text} ${tag} ` } : line
      )
    );
  };

  const renderVoiceOptions = () => {
    const mcVoices = AVAILABLE_VOICES.filter((v) => v.role === 'mc');
    const editorVoices = AVAILABLE_VOICES.filter((v) => v.role === 'editor');
    const storytellerVoices = AVAILABLE_VOICES.filter((v) => v.role === 'storyteller');
    const narratorVoices = AVAILABLE_VOICES.filter((v) => v.role === 'narrator');
    const kidsVoices = AVAILABLE_VOICES.filter((v) => v.isChild || v.role === 'kids');
    const maternalVoices = AVAILABLE_VOICES.filter((v) => v.role === 'maternal');

    return (
      <>
        <optgroup label="🎤 MC & Dẫn Chương Trình">
          {mcVoices.map((v) => (
            <option key={v.id} value={v.id}>
              {v.avatar} {v.name} ({v.roleName} - {v.regionName})
            </option>
          ))}
        </optgroup>
        <optgroup label="📺 Biên Tập Viên & Thời Sự">
          {editorVoices.map((v) => (
            <option key={v.id} value={v.id}>
              {v.avatar} {v.name} ({v.roleName} - {v.regionName})
            </option>
          ))}
        </optgroup>
        <optgroup label="📖 Người Kể Chuyện">
          {storytellerVoices.map((v) => (
            <option key={v.id} value={v.id}>
              {v.avatar} {v.name} ({v.roleName} - {v.regionName})
            </option>
          ))}
        </optgroup>
        <optgroup label="🎙️ Người Dẫn Chuyện & Podcast">
          {narratorVoices.map((v) => (
            <option key={v.id} value={v.id}>
              {v.avatar} {v.name} ({v.roleName} - {v.regionName})
            </option>
          ))}
        </optgroup>
        <optgroup label="👶 Trẻ Em & Thiếu Nhi">
          {kidsVoices.map((v) => (
            <option key={v.id} value={v.id}>
              {v.avatar} {v.name} ({v.roleName} - {v.regionName})
            </option>
          ))}
        </optgroup>
        <optgroup label="🤱 Tình Mẫu Tử & Vùng Miền">
          {maternalVoices.map((v) => (
            <option key={v.id} value={v.id}>
              {v.avatar} {v.name} ({v.roleName} - {v.regionName})
            </option>
          ))}
        </optgroup>
      </>
    );
  };

  return (
    <div className="space-y-6">
      {/* Error Banner */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/40 bg-red-950/40 p-4 text-sm text-red-200">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-400 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-red-300">Không thể tạo kịch bản đối thoại</p>
            <p className="mt-0.5 text-xs text-red-300/80">{error}</p>
          </div>
        </div>
      )}

      {/* Speaker Configuration Card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg backdrop-blur-md">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="h-4 w-4 text-rose-400" />
          <h3 className="text-sm font-semibold text-slate-200">
            Thiết Lập 2 Nhân Vật Đối Thoại (Gemini Multi-Speaker)
          </h3>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Speaker 1 */}
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-400">
                Nhân vật 1
              </span>
              <span className="text-xs text-slate-400">Giọng chính</span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Tên hiển thị</label>
                <input
                  type="text"
                  value={speaker1Name}
                  onChange={(e) => {
                    const newName = e.target.value;
                    const oldName = speaker1Name;
                    setSpeaker1Name(newName);
                    setDialogue((prev) =>
                      prev.map((l) => (l.speaker === oldName ? { ...l, speaker: newName } : l))
                    );
                  }}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-white focus:border-rose-500 focus:outline-none"
                  placeholder="Ví dụ: Mẹ"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-slate-400">Chất giọng</label>
                  <button
                    type="button"
                    onClick={() => handleTogglePreview(speaker1Voice)}
                    className="flex items-center gap-1 text-[11px] font-semibold text-rose-400 hover:text-rose-300"
                  >
                    {previewingVoiceId === speaker1Voice && isLoadingPreview ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : previewingVoiceId === speaker1Voice ? (
                      <Square className="h-3 w-3 fill-rose-400" />
                    ) : (
                      <Play className="h-3 w-3" />
                    )}
                    <span>
                      {previewingVoiceId === speaker1Voice ? 'Dừng thử' : 'Nghe thử giọng này'}
                    </span>
                  </button>
                </div>
                <select
                  value={speaker1Voice}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSpeaker1Voice(v);
                    setDialogue((prev) =>
                      prev.map((l) => (l.speaker === speaker1Name ? { ...l, voiceName: v } : l))
                    );
                  }}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-white focus:border-rose-500 focus:outline-none"
                >
                  {renderVoiceOptions()}
                </select>
              </div>
            </div>
          </div>

          {/* Speaker 2 */}
          <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-400">
                Nhân vật 2
              </span>
              <span className="text-xs text-slate-400">Người đáp lời</span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Tên hiển thị</label>
                <input
                  type="text"
                  value={speaker2Name}
                  onChange={(e) => {
                    const newName = e.target.value;
                    const oldName = speaker2Name;
                    setSpeaker2Name(newName);
                    setDialogue((prev) =>
                      prev.map((l) => (l.speaker === oldName ? { ...l, speaker: newName } : l))
                    );
                  }}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-white focus:border-purple-500 focus:outline-none"
                  placeholder="Ví dụ: Con"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-slate-400">Chất giọng</label>
                  <button
                    type="button"
                    onClick={() => handleTogglePreview(speaker2Voice)}
                    className="flex items-center gap-1 text-[11px] font-semibold text-purple-400 hover:text-purple-300"
                  >
                    {previewingVoiceId === speaker2Voice && isLoadingPreview ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : previewingVoiceId === speaker2Voice ? (
                      <Square className="h-3 w-3 fill-purple-400" />
                    ) : (
                      <Play className="h-3 w-3" />
                    )}
                    <span>
                      {previewingVoiceId === speaker2Voice ? 'Dừng thử' : 'Nghe thử giọng này'}
                    </span>
                  </button>
                </div>
                <select
                  value={speaker2Voice}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSpeaker2Voice(v);
                    setDialogue((prev) =>
                      prev.map((l) => (l.speaker === speaker2Name ? { ...l, voiceName: v } : l))
                    );
                  }}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-white focus:border-purple-500 focus:outline-none"
                >
                  {renderVoiceOptions()}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Script Lines Editor */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg backdrop-blur-md">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
          <h3 className="text-sm font-semibold text-slate-200">
            Dòng Kịch Bản Đối Thoại ({dialogue.length} câu)
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => addLine(speaker1Name)}
              className="flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs font-medium text-rose-300 hover:bg-rose-500/20"
            >
              <Plus className="h-3 w-3" />
              <span>Thêm câu của {speaker1Name}</span>
            </button>
            <button
              onClick={() => addLine(speaker2Name)}
              className="flex items-center gap-1 rounded-lg border border-purple-500/30 bg-purple-500/10 px-2.5 py-1 text-xs font-medium text-purple-300 hover:bg-purple-500/20"
            >
              <Plus className="h-3 w-3" />
              <span>Thêm câu của {speaker2Name}</span>
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {dialogue.map((line, index) => {
            const isSpk1 = line.speaker === speaker1Name;
            return (
              <div
                key={line.id}
                onClick={() => setActiveLineId(line.id)}
                className={`rounded-xl p-4 transition-all ${
                  isSpk1
                    ? 'border border-rose-500/30 bg-rose-950/20'
                    : 'border border-purple-500/30 bg-purple-950/20'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-500">#{index + 1}</span>
                    <select
                      value={line.speaker}
                      onChange={(e) => updateLine(line.id, 'speaker', e.target.value)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                        isSpk1
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                      }`}
                    >
                      <option value={speaker1Name}>{speaker1Name}</option>
                      <option value={speaker2Name}>{speaker2Name}</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => removeLine(line.id)}
                      disabled={dialogue.length <= 1}
                      title="Xoá dòng này"
                      className="text-slate-500 hover:text-red-400 disabled:opacity-30"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <textarea
                  value={line.text}
                  onChange={(e) => updateLine(line.id, 'text', e.target.value)}
                  placeholder={`Nhập lời thoại của ${line.speaker}...`}
                  rows={2}
                  className="w-full resize-none rounded-lg border border-slate-700/80 bg-slate-950/70 p-3 text-sm text-slate-100 placeholder-slate-500 focus:border-rose-500 focus:outline-none"
                />

                {/* Subtag pills for this line */}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] text-slate-400">Thêm biểu cảm:</span>
                  {VOCAL_TAGS.slice(0, 4).map((tag) => (
                    <button
                      key={tag.tag}
                      type="button"
                      onClick={() => insertTagToLine(line.id, tag.tag)}
                      className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-slate-700"
                    >
                      {tag.tag}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Generate Button */}
      <button
        onClick={() => {
          if (previewAudioRef.current) {
            previewAudioRef.current.pause();
            previewAudioRef.current = null;
          }
          setPreviewingVoiceId(null);
          onGenerate();
        }}
        disabled={isGenerating || dialogue.some((l) => !l.text.trim())}
        className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-rose-500 via-pink-600 to-purple-600 px-6 py-4 text-base font-bold text-white shadow-xl shadow-rose-500/25 transition-all hover:scale-[1.01] hover:shadow-rose-500/35 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isGenerating ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Đang hòa trộn giọng 2 nhân vật với Gemini 3.8 Flash TTS...</span>
          </>
        ) : (
          <>
            <Sparkles className="h-5 w-5 text-amber-200" />
            <span>Tạo Đối Thoại Kịch Bản 2 Người (Dual-Speaker TTS)</span>
          </>
        )}
      </button>
    </div>
  );
};
