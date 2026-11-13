import React, { useRef, useState, useEffect } from 'react';
import { apiUrl } from '../utils/api';
import { AVAILABLE_VOICES, STYLE_PRESETS, VOCAL_TAGS } from '../data/voices';
import { FilterRegion, FilterGender, FilterRole, VoiceOption } from '../types';
import {
  Sparkles,
  Wand2,
  Volume2,
  Mic,
  Heart,
  AlertCircle,
  Loader2,
  Play,
  Square,
  Search,
  VolumeX,
  MapPin,
  UserCheck,
  Briefcase,
  Baby,
} from 'lucide-react';

interface SingleSpeakerStudioProps {
  text: string;
  setText: (text: string) => void;
  selectedVoice: string;
  setSelectedVoice: (voiceId: string) => void;
  stylePrompt: string;
  setStylePrompt: (style: string) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  error: string | null;
}

export const SingleSpeakerStudio: React.FC<SingleSpeakerStudioProps> = ({
  text,
  setText,
  selectedVoice,
  setSelectedVoice,
  stylePrompt,
  setStylePrompt,
  onGenerate,
  isGenerating,
  error,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhanceMessage, setEnhanceMessage] = useState<string | null>(null);

  // Filters: Role, Region, Gender/Demographic, Search
  const [selectedRole, setSelectedRole] = useState<FilterRole>('all');
  const [selectedRegion, setSelectedRegion] = useState<FilterRegion>('all');
  const [selectedGender, setSelectedGender] = useState<FilterGender>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Voice Preview Audition State
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isUsingFallback, setIsUsingFallback] = useState(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // Stop preview on unmount
  useEffect(() => {
    return () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Browser SpeechSynthesis Fallback if API preview quota is exhausted
  const playSpeechSynthesisFallback = (voice: VoiceOption) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setPreviewingVoiceId(null);
      setIsLoadingPreview(false);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(voice.sampleText);

    // Pick best Vietnamese voice in browser if present
    const browserVoices = window.speechSynthesis.getVoices();
    const viVoice = browserVoices.find(
      (v) =>
        v.lang.toLowerCase().includes('vi') ||
        v.name.toLowerCase().includes('vietnam') ||
        v.name.toLowerCase().includes('vietnamese')
    );
    if (viVoice) {
      utterance.voice = viVoice;
    }
    utterance.lang = 'vi-VN';

    // Tone shaping based on persona, child/adult, and region
    if (voice.isChild || voice.role === 'kids' || voice.category === 'youth') {
      utterance.pitch = 1.45;
      utterance.rate = 1.08;
    } else if (voice.role === 'mc') {
      utterance.pitch = voice.gender === 'female' ? 1.15 : 1.0;
      utterance.rate = 1.08;
    } else if (voice.role === 'editor') {
      utterance.pitch = voice.gender === 'female' ? 1.05 : 0.9;
      utterance.rate = 1.02;
    } else if (voice.role === 'storyteller') {
      utterance.pitch = voice.gender === 'female' ? 1.08 : 0.82;
      utterance.rate = 0.9;
    } else if (voice.region === 'mientay') {
      utterance.pitch = voice.gender === 'female' ? 1.15 : 0.95;
      utterance.rate = 1.02;
    } else if (voice.region === 'nghean' || voice.region === 'hatinh') {
      utterance.pitch = voice.gender === 'female' ? 1.02 : 0.82;
      utterance.rate = 0.94;
    } else if (voice.gender === 'male' && voice.category === 'deep') {
      utterance.pitch = 0.8;
      utterance.rate = 0.95;
    } else if (voice.gender === 'male') {
      utterance.pitch = 0.9;
      utterance.rate = 1.0;
    } else if (voice.region === 'hue') {
      utterance.pitch = 1.08;
      utterance.rate = 0.92;
    } else {
      utterance.pitch = 1.1;
      utterance.rate = 1.0;
    }

    setPreviewingVoiceId(voice.id);
    setIsLoadingPreview(false);
    setIsUsingFallback(true);

    utterance.onend = () => {
      setPreviewingVoiceId(null);
      setIsUsingFallback(false);
    };

    utterance.onerror = () => {
      setPreviewingVoiceId(null);
      setIsUsingFallback(false);
    };

    window.speechSynthesis.speak(utterance);
  };

  // Handle Play/Stop Preview
  const handleTogglePreview = async (
    e: React.MouseEvent,
    voice: VoiceOption
  ) => {
    e.stopPropagation();

    // If already playing this voice, stop it
    if (previewingVoiceId === voice.id) {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setPreviewingVoiceId(null);
      setIsUsingFallback(false);
      return;
    }

    // Stop existing preview
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    setPreviewingVoiceId(voice.id);
    setIsLoadingPreview(true);
    setIsUsingFallback(false);

    try {
      const res = await fetch(apiUrl('/api/voice-preview'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voiceName: voice.voiceName,
          previewText: voice.sampleText,
          style: voice.sampleStyle,
          accentInstruction: voice.accentInstruction,
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
          playSpeechSynthesisFallback(voice);
        };

        await audio.play();
        setIsLoadingPreview(false);
        setIsUsingFallback(false);
      } else {
        // Fallback to Web Speech API
        playSpeechSynthesisFallback(voice);
      }
    } catch (err) {
      console.warn('Preview fetch error, activating fallback:', err);
      playSpeechSynthesisFallback(voice);
    }
  };

  // Insert vocal tag at cursor
  const insertTag = (tag: string) => {
    if (!textareaRef.current) {
      setText(`${text} ${tag} `);
      return;
    }
    const el = textareaRef.current;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const before = text.substring(0, start);
    const after = text.substring(end);
    const newText = `${before} ${tag} ${after}`;
    setText(newText);

    setTimeout(() => {
      el.focus();
      const pos = start + tag.length + 2;
      el.setSelectionRange(pos, pos);
    }, 50);
  };

  // Enhance text with vocal bursts or poem
  const handleEnhance = async (action: 'add-vocal-bursts' | 'generate-poem') => {
    setIsEnhancing(true);
    setEnhanceMessage(null);
    try {
      const res = await fetch(apiUrl('/api/enhance-text'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          text: text,
          theme: 'mẹ yêu con, tình mẫu tử tha thiết, lời ru ngọt ngào',
        }),
      });
      const data = await res.json();
      if (data.result) {
        setText(data.result);
        setEnhanceMessage(
          action === 'add-vocal-bursts'
            ? 'Đã điểm xuyết các thẻ biểu cảm tự nhiên (<breath>, <laugh>...)'
            : 'Đã tạo đoạn thơ ru tình mẫu tử ngọt ngào!'
        );
        setTimeout(() => setEnhanceMessage(null), 3500);
      }
    } catch (err) {
      console.error('Enhance error:', err);
    } finally {
      setIsEnhancing(false);
    }
  };

  // Filter voices by Role, Region, Gender/Demographic & Search Query
  const filteredVoices = AVAILABLE_VOICES.filter((voice) => {
    // 1. Role match
    let matchesRole = true;
    if (selectedRole === 'kids') {
      matchesRole = voice.isChild === true || voice.role === 'kids';
    } else if (selectedRole !== 'all') {
      matchesRole = voice.role === selectedRole;
    }

    // 2. Region match
    const matchesRegion =
      selectedRegion === 'all' || voice.region === selectedRegion;

    // 3. Gender & Demographic match
    let matchesGender = true;
    if (selectedGender === 'kids') {
      matchesGender = voice.isChild === true || voice.role === 'kids';
    } else if (selectedGender === 'female') {
      matchesGender = voice.gender === 'female' && !voice.isChild;
    } else if (selectedGender === 'male') {
      matchesGender = voice.gender === 'male' && !voice.isChild;
    }

    // 4. Search query
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      voice.name.toLowerCase().includes(q) ||
      voice.roleName.toLowerCase().includes(q) ||
      voice.regionName.toLowerCase().includes(q) ||
      voice.tone.toLowerCase().includes(q) ||
      voice.description.toLowerCase().includes(q) ||
      voice.recommendedFor.toLowerCase().includes(q);

    return matchesRole && matchesRegion && matchesGender && matchesSearch;
  });

  // Role tabs definitions
  const roleList: { id: FilterRole; label: string; icon: string; count: number }[] = [
    {
      id: 'all',
      label: 'Tất Cả Vai Trò',
      icon: '🌟',
      count: AVAILABLE_VOICES.length,
    },
    {
      id: 'mc',
      label: 'MC & Dẫn Chương Trình',
      icon: '🎤',
      count: AVAILABLE_VOICES.filter((v) => v.role === 'mc').length,
    },
    {
      id: 'editor',
      label: 'Biên Tập Viên & Thời Sự',
      icon: '📺',
      count: AVAILABLE_VOICES.filter((v) => v.role === 'editor').length,
    },
    {
      id: 'storyteller',
      label: 'Người Kể Chuyện',
      icon: '📖',
      count: AVAILABLE_VOICES.filter((v) => v.role === 'storyteller').length,
    },
    {
      id: 'narrator',
      label: 'Người Dẫn Chuyện & Podcast',
      icon: '🎙️',
      count: AVAILABLE_VOICES.filter((v) => v.role === 'narrator').length,
    },
    {
      id: 'kids',
      label: 'Trẻ Em & Thiếu Nhi',
      icon: '👶',
      count: AVAILABLE_VOICES.filter((v) => v.isChild || v.role === 'kids').length,
    },
    {
      id: 'maternal',
      label: 'Tình Mẫu Tử & Vùng Miền',
      icon: '🤱',
      count: AVAILABLE_VOICES.filter((v) => v.role === 'maternal').length,
    },
  ];

  // Region tabs definitions
  const regionsList: { id: FilterRegion; label: string; icon: string; count: number }[] = [
    {
      id: 'all',
      label: 'Tất cả vùng miền',
      icon: '🗺️',
      count: AVAILABLE_VOICES.length,
    },
    {
      id: 'hanoi',
      label: 'Hà Nội',
      icon: '🏛️',
      count: AVAILABLE_VOICES.filter((v) => v.region === 'hanoi').length,
    },
    {
      id: 'saigon',
      label: 'Sài Gòn',
      icon: '🌴',
      count: AVAILABLE_VOICES.filter((v) => v.region === 'saigon').length,
    },
    {
      id: 'hue',
      label: 'Huế',
      icon: '🏯',
      count: AVAILABLE_VOICES.filter((v) => v.region === 'hue').length,
    },
    {
      id: 'nghean',
      label: 'Nghệ An',
      icon: '🌾',
      count: AVAILABLE_VOICES.filter((v) => v.region === 'nghean').length,
    },
    {
      id: 'hatinh',
      label: 'Hà Tĩnh',
      icon: '🌊',
      count: AVAILABLE_VOICES.filter((v) => v.region === 'hatinh').length,
    },
    {
      id: 'mientay',
      label: 'Miền Tây',
      icon: '🛶',
      count: AVAILABLE_VOICES.filter((v) => v.region === 'mientay').length,
    },
  ];

  const getRegionBadgeClass = (region: string) => {
    switch (region) {
      case 'hanoi':
        return 'bg-amber-500/15 text-amber-300 ring-amber-500/30 border-amber-500/20';
      case 'saigon':
        return 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30 border-emerald-500/20';
      case 'hue':
        return 'bg-purple-500/15 text-purple-300 ring-purple-500/30 border-purple-500/20';
      case 'nghean':
        return 'bg-yellow-500/15 text-yellow-300 ring-yellow-500/30 border-yellow-500/20';
      case 'hatinh':
        return 'bg-cyan-500/15 text-cyan-300 ring-cyan-500/30 border-cyan-500/20';
      case 'mientay':
        return 'bg-teal-500/15 text-teal-300 ring-teal-500/30 border-teal-500/20';
      default:
        return 'bg-slate-800 text-slate-300 ring-slate-700';
    }
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'mc':
        return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
      case 'editor':
        return 'bg-sky-500/15 text-sky-300 border-sky-500/30';
      case 'storyteller':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      case 'narrator':
        return 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30';
      case 'kids':
        return 'bg-pink-500/15 text-pink-300 border-pink-500/30';
      default:
        return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
    }
  };

  const currentPreviewingVoice = AVAILABLE_VOICES.find(
    (v) => v.id === previewingVoiceId
  );

  return (
    <div className="space-y-6">
      {/* Error notification banner */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/40 bg-red-950/40 p-4 text-sm text-red-200">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-400 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-red-300">Thông báo</p>
            <p className="mt-0.5 text-xs text-red-300/80">{error}</p>
          </div>
        </div>
      )}

      {/* Textarea Section */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <Mic className="h-4 w-4 text-rose-400" />
            <label className="text-sm font-semibold text-slate-200">
              Văn Bản Cần Chuyển Thành Giọng Nói
            </label>
          </div>

          {/* Quick AI Helpers */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleEnhance('add-vocal-bursts')}
              disabled={isEnhancing || !text.trim()}
              className="flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs font-medium text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-40"
              title="Tự động thêm các thẻ thở, cười, cảm xúc của Gemini 3.8 Flash TTS"
            >
              {isEnhancing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Wand2 className="h-3.5 w-3.5" />
              )}
              <span>Tự động thêm thở & cảm xúc</span>
            </button>

            <button
              onClick={() => handleEnhance('generate-poem')}
              disabled={isEnhancing}
              className="flex items-center gap-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 px-2.5 py-1 text-xs font-medium text-purple-300 transition hover:bg-purple-500/20 disabled:opacity-40"
              title="Soạn thảo lời ru tình mẫu tử ngọt ngào"
            >
              <Heart className="h-3.5 w-3.5 text-rose-400" />
              <span>Gợi ý thơ mẫu tử</span>
            </button>
          </div>
        </div>

        {enhanceMessage && (
          <div className="mt-2 text-xs font-medium text-emerald-400 flex items-center gap-1.5 animate-fadeIn">
            <Sparkles className="h-3.5 w-3.5" />
            <span>{enhanceMessage}</span>
          </div>
        )}

        <div className="mt-3 relative">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            placeholder="Nhập nội dung văn bản muốn chuyển thành giọng nói tại đây..."
            className="w-full resize-y rounded-xl border border-slate-700/80 bg-slate-950/70 p-4 text-sm font-sans text-slate-100 placeholder-slate-500 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20 leading-relaxed"
          />

          <div className="flex items-center justify-between text-xs text-slate-400 mt-2">
            <span>
              Hỗ trợ giọng MC sự kiện, BTV thời sự, Người kể chuyện, Người dẫn chuyện, Giọng Trẻ em và Lời mẹ ru.
            </span>
            <span className="font-mono text-slate-500">
              {text.length} ký tự
            </span>
          </div>
        </div>

        {/* Expressive Vocal Tags Toolbar */}
        <div className="mt-4 pt-3 border-t border-slate-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              Thẻ biểu cảm tự nhiên (Gemini 3.8 Flash TTS):
            </span>
            <span className="text-[11px] text-slate-500">Bấm để chèn vào văn bản</span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {VOCAL_TAGS.map((item) => (
              <button
                key={item.tag}
                type="button"
                onClick={() => insertTag(item.tag)}
                title={`${item.label}: ${item.hint}`}
                className="group flex items-center gap-1 rounded-lg border border-slate-700/70 bg-slate-800/60 px-2.5 py-1 text-xs text-slate-300 transition hover:border-rose-500/60 hover:bg-rose-500/10 hover:text-rose-200"
              >
                <code className="font-mono text-[11px] text-rose-400 font-semibold group-hover:text-rose-300">
                  {item.tag}
                </code>
                <span className="text-[11px] text-slate-400 group-hover:text-slate-200">
                  {item.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Voice Selection Cards with Role Tabs, Regional Accents & Preview */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-rose-400" />
            <div>
              <h3 className="text-sm font-semibold text-slate-200">
                Thư Viện Giọng Đọc Đa Dạng ({AVAILABLE_VOICES.length} Giọng Đọc)
              </h3>
              <p className="text-xs text-slate-400">
                <strong>MC, Biên tập viên, Người kể chuyện, Người dẫn chuyện, Giọng Trẻ em</strong> &bull; Bấm <strong>"Nghe thử"</strong> để nghe mẫu giọng tức thì
              </p>
            </div>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm giọng, vai trò, vùng miền..."
              className="w-full rounded-xl border border-slate-800 bg-slate-950/80 pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:border-rose-500 focus:outline-none"
            />
          </div>
        </div>

        {/* 1. ROLE FILTER TABS (MC, BTV, Kể Chuyện, Dẫn Chuyện, Trẻ Em, Mẫu Tử) */}
        <div className="space-y-2 pb-3 mb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
            <Briefcase className="h-3.5 w-3.5 text-rose-400" />
            <span>Vai Trò & Thể Loại Diễn Đọc:</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {roleList.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedRole(r.id)}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                  selectedRole === r.id
                    ? 'bg-rose-500 text-white shadow-md shadow-rose-500/25 ring-1 ring-rose-400'
                    : 'border border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700 hover:text-white'
                }`}
              >
                <span>{r.icon}</span>
                <span>{r.label}</span>
                <span
                  className={`ml-1 rounded-full px-1.5 py-0.2 text-[10px] ${
                    selectedRole === r.id
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {r.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* 2. REGION & GENDER SUB-FILTERS */}
        <div className="space-y-3 pb-4 mb-4 border-b border-slate-800/80">
          {/* Region Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-400 flex items-center gap-1 mr-1">
              <MapPin className="h-3.5 w-3.5 text-slate-500" />
              Vùng miền:
            </span>
            {regionsList.map((reg) => (
              <button
                key={reg.id}
                onClick={() => setSelectedRegion(reg.id)}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  selectedRegion === reg.id
                    ? 'bg-purple-600 text-white ring-1 ring-purple-400'
                    : 'border border-slate-800 bg-slate-950/40 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>{reg.icon}</span>
                <span>{reg.label}</span>
                <span className="text-[10px] opacity-70">({reg.count})</span>
              </button>
            ))}
          </div>

          {/* Gender / Demographic */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400 flex items-center gap-1 mr-1">
                <UserCheck className="h-3.5 w-3.5 text-slate-500" />
                Đối tượng:
              </span>
              {[
                { id: 'all', label: 'Tất cả' },
                { id: 'female', label: '👩 Giọng Nữ' },
                { id: 'male', label: '👨 Giọng Nam' },
                { id: 'kids', label: '🧒 Giọng Trẻ Em' },
              ].map((g) => (
                <button
                  key={g.id}
                  onClick={() => setSelectedGender(g.id as FilterGender)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                    selectedGender === g.id
                      ? 'bg-slate-700 text-white ring-1 ring-slate-500'
                      : 'border border-slate-800 bg-slate-950/50 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>

            <div className="text-xs text-slate-400">
              Hiển thị <strong>{filteredVoices.length}</strong> giọng phù hợp
            </div>
          </div>
        </div>

        {/* Active Audition Status Bar if playing */}
        {previewingVoiceId && currentPreviewingVoice && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-500/40 bg-gradient-to-r from-rose-950/40 via-purple-950/40 to-slate-950/40 p-3 shadow-inner animate-fadeIn">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-rose-300">
                    Đang nghe thử: {currentPreviewingVoice.name}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.2 text-[10px] font-semibold border ${getRoleBadgeClass(
                      currentPreviewingVoice.role
                    )}`}
                  >
                    {currentPreviewingVoice.roleName}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.2 text-[10px] font-semibold border ${getRegionBadgeClass(
                      currentPreviewingVoice.region
                    )}`}
                  >
                    {currentPreviewingVoice.regionName}
                  </span>
                  {isUsingFallback && (
                    <span className="inline-flex items-center gap-1 rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300 border border-amber-500/30">
                      Chế độ nghe thử dự phòng
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-300 italic truncate font-serif mt-0.5">
                  "{currentPreviewingVoice.sampleText}"
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                if (previewAudioRef.current) {
                  previewAudioRef.current.pause();
                  previewAudioRef.current = null;
                }
                if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
                  window.speechSynthesis.cancel();
                }
                setPreviewingVoiceId(null);
                setIsUsingFallback(false);
              }}
              className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white shrink-0"
            >
              <VolumeX className="h-3.5 w-3.5" />
              <span>Dừng nghe</span>
            </button>
          </div>
        )}

        {/* Grid of Voice Cards */}
        {filteredVoices.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">
            Không tìm thấy giọng đọc phù hợp với tiêu chí lọc hiện tại. Vui lòng bấm "Tất Cả Vai Trò" hoặc "Tất cả vùng miền" để xem thêm.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 max-h-[580px] overflow-y-auto pr-1">
            {filteredVoices.map((v) => {
              const isSelected = selectedVoice === v.id;
              const isThisPreviewing = previewingVoiceId === v.id;
              const isThisLoading = isThisPreviewing && isLoadingPreview;

              return (
                <div
                  key={v.id}
                  onClick={() => setSelectedVoice(v.id)}
                  className={`group relative flex flex-col justify-between rounded-xl p-3.5 text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'border-2 border-rose-500 bg-gradient-to-b from-rose-500/15 via-slate-900/90 to-purple-500/10 shadow-lg shadow-rose-500/15'
                      : 'border border-slate-800/90 bg-slate-950/60 hover:border-slate-700 hover:bg-slate-900/60'
                  }`}
                >
                  <div>
                    {/* Header: Avatar, Name, Role Badge, Region Badge */}
                    <div className="flex w-full items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-2xl shrink-0">{v.avatar}</span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-slate-100 text-sm">
                              {v.name}
                            </span>
                            {v.isChild && (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-pink-500/20 px-1.5 py-0.2 text-[9px] font-bold text-pink-300 border border-pink-500/30">
                                <Baby className="h-2.5 w-2.5" />
                                Bé Nhí
                              </span>
                            )}
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.2 text-[10px] font-semibold border ${getRegionBadgeClass(
                                v.region
                              )}`}
                            >
                              {v.regionName}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-400">
                            <span
                              className={`font-semibold border rounded px-1.5 py-0.1 text-[10px] ${getRoleBadgeClass(
                                v.role
                              )}`}
                            >
                              {v.roleName}
                            </span>
                            <span className="text-rose-400 font-medium">
                              {v.isChild
                                ? v.gender === 'female'
                                  ? 'Bé gái'
                                  : 'Bé trai'
                                : v.gender === 'female'
                                ? 'Nữ'
                                : 'Nam'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {isSelected && (
                        <span className="h-3 w-3 shrink-0 rounded-full bg-rose-500 shadow-md shadow-rose-500 ring-2 ring-rose-500/30" />
                      )}
                    </div>

                    {/* Tone & Description */}
                    <p className="mt-2 text-xs text-slate-400 leading-relaxed line-clamp-2">
                      {v.description}
                    </p>

                    {/* Regional sample quote */}
                    <div className="mt-2 rounded-lg bg-slate-900/80 p-2 text-[11px] text-slate-300 italic font-serif border border-slate-800/80">
                      "{v.sampleText}"
                    </div>
                  </div>

                  {/* Card Bottom: Recommended for & Audition Button */}
                  <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-2">
                    <span className="text-[10px] text-slate-500 truncate max-w-[140px]">
                      {v.recommendedFor}
                    </span>

                    {/* Preview Audition Button */}
                    <button
                      type="button"
                      onClick={(e) => handleTogglePreview(e, v)}
                      title={
                        isThisPreviewing
                          ? 'Dừng nghe thử'
                          : `Nghe thử giọng ${v.name} (${v.roleName})`
                      }
                      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition shrink-0 ${
                        isThisPreviewing
                          ? 'bg-rose-500 text-white shadow-md shadow-rose-500/30 animate-pulse'
                          : 'border border-slate-700 bg-slate-800 text-slate-200 hover:border-rose-500/50 hover:bg-rose-500/10 hover:text-rose-200'
                      }`}
                    >
                      {isThisLoading ? (
                        <Loader2 className="h-3 w-3 animate-spin text-rose-300" />
                      ) : isThisPreviewing ? (
                        <Square className="h-3 w-3 fill-white" />
                      ) : (
                        <Play className="h-3 w-3 translate-x-0.2" />
                      )}
                      <span>{isThisPreviewing ? 'Dừng' : 'Nghe thử'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Emotion / Style Prompt Section */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg backdrop-blur-md">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Heart className="h-4 w-4 text-rose-400" />
            <h3 className="text-sm font-semibold text-slate-200">
              Phong Thái & Cảm Xúc Diễn Đạt (Speech Metadata Style)
            </h3>
          </div>
          <span className="text-xs text-slate-400">Định hình âm hưởng</span>
        </div>

        <p className="text-xs text-slate-400 mb-3">
          Gemini 3.8 Flash TTS kết hợp chuẩn xác giữa vai trò (MC, BTV, Kể chuyện, Trẻ em) và phong thái cảm xúc:
        </p>

        {/* Style chips */}
        <div className="flex flex-wrap gap-2 mb-3">
          {STYLE_PRESETS.map((style) => (
            <button
              key={style.id}
              type="button"
              onClick={() => setStylePrompt(style.prompt)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                stylePrompt === style.prompt
                  ? 'bg-rose-500 text-white shadow-md shadow-rose-500/25 ring-1 ring-rose-400'
                  : 'border border-slate-800 bg-slate-950/50 text-slate-300 hover:border-slate-700 hover:bg-slate-800/50 hover:text-white'
              }`}
            >
              {style.label}
            </button>
          ))}
        </div>

        {/* Custom Style Input */}
        <input
          type="text"
          value={stylePrompt}
          onChange={(e) => setStylePrompt(e.target.value)}
          placeholder="Hoặc tự mô tả phong cách diễn đạt (ví dụ: Giọng MC gala bùng nổ, BTV dõng dạc, Bé nhí líu lo...)"
          className="w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
        />
      </div>

      {/* Main Generate Button */}
      <div className="pt-2">
        <button
          onClick={() => {
            // Stop preview when generating full speech
            if (previewAudioRef.current) {
              previewAudioRef.current.pause();
              previewAudioRef.current = null;
            }
            if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
              window.speechSynthesis.cancel();
            }
            setPreviewingVoiceId(null);
            setIsUsingFallback(false);
            onGenerate();
          }}
          disabled={isGenerating || !text.trim()}
          className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-rose-500 via-pink-600 to-purple-600 px-6 py-4 text-base font-bold text-white shadow-xl shadow-rose-500/25 transition-all hover:scale-[1.01] hover:shadow-rose-500/35 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />

          {isGenerating ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Đang kết hợp âm hưởng nhân vật và biến thành giọng nói...</span>
            </>
          ) : (
            <>
              <Sparkles className="h-5 w-5 text-amber-200" />
              <span>Chuyển Thành Giọng Nói (Gemini 3.8 Flash TTS)</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
