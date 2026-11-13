import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Download,
  Sparkles,
  Repeat,
  Share2,
  Check,
} from 'lucide-react';

interface AudioPlayerProps {
  audioUrl: string | null;
  textSnippet?: string;
  voiceName?: string;
  stylePrompt?: string;
  title?: string;
  isFallback?: boolean;
  onPlaySpeechFallback?: () => void;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioUrl,
  textSnippet,
  voiceName = 'Kore',
  stylePrompt,
  title = 'Bản Thu Âm Mới Nhất',
  isFallback = false,
  onPlaySpeechFallback,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isLooping, setIsLooping] = useState(false);
  const [copied, setCopied] = useState(false);

  // Audio Context and Analyzer for visualizer
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
      audioRef.current.loop = isLooping;
    }
  }, [playbackRate, isLooping]);

  useEffect(() => {
    // Reset state when new audioUrl arrives
    if (audioUrl && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      setCurrentTime(0);

      // Auto play on new audio generation
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setIsPlaying(true))
          .catch(() => {
            // Autoplay might be blocked by browser policy until user interacts
            setIsPlaying(false);
          });
      }
    }
  }, [audioUrl]);

  // Connect Web Audio API Analyser
  const setupAudioContext = () => {
    if (!audioRef.current || audioCtxRef.current) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;

      const source = ctx.createMediaElementSource(audioRef.current);
      source.connect(analyser);
      analyser.connect(ctx.destination);

      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      sourceRef.current = source;
    } catch (e) {
      console.warn('AudioContext setup skipped or already initialized:', e);
    }
  };

  // Draw waveform animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let bars = 48;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      let dataArray = new Uint8Array(bars);
      if (analyserRef.current && isPlaying) {
        analyserRef.current.getByteFrequencyData(dataArray);
      } else {
        // Subtle resting wave
        const time = Date.now() / 400;
        for (let i = 0; i < bars; i++) {
          dataArray[i] = Math.sin(i * 0.2 + time) * 15 + 20;
        }
      }

      const barWidth = canvas.width / bars;
      const centerY = canvas.height / 2;

      for (let i = 0; i < bars; i++) {
        const val = dataArray[i] / 255;
        const height = Math.max(4, val * (canvas.height * 0.85));
        const x = i * barWidth;

        // Gradient for vibrant aesthetic
        const gradient = ctx.createLinearGradient(0, centerY - height / 2, 0, centerY + height / 2);
        if (isPlaying) {
          gradient.addColorStop(0, '#f43f5e'); // Rose 500
          gradient.addColorStop(0.5, '#ec4899'); // Pink 500
          gradient.addColorStop(1, '#a855f7'); // Purple 500
        } else {
          gradient.addColorStop(0, '#475569');
          gradient.addColorStop(1, '#334155');
        }

        ctx.fillStyle = gradient;
        // Rounded bar
        const r = 2;
        const y = centerY - height / 2;
        const w = Math.max(2, barWidth - 2);

        ctx.beginPath();
        ctx.roundRect(x + 1, y, w, height, [r, r, r, r]);
        ctx.fill();
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isPlaying]);

  const togglePlay = () => {
    if (!audioRef.current || !audioUrl) return;
    setupAudioContext();

    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }

    if (isPlaying) {
      audioRef.current.pause();
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.pause();
      }
      setIsPlaying(false);
    } else {
      if (isFallback && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        } else if (!window.speechSynthesis.speaking) {
          onPlaySpeechFallback?.();
        }
      }
      audioRef.current.play().then(() => setIsPlaying(true)).catch((e) => console.error(e));
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration || 0);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    setIsMuted(val === 0);
    if (audioRef.current) {
      audioRef.current.volume = val;
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    if (isMuted) {
      audioRef.current.volume = volume || 0.8;
      setIsMuted(false);
    } else {
      audioRef.current.volume = 0;
      setIsMuted(true);
    }
  };

  const restartAudio = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      if (isFallback) {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          window.speechSynthesis.cancel();
        }
        onPlaySpeechFallback?.();
      }
      audioRef.current.play().then(() => setIsPlaying(true));
    }
  };

  const downloadWav = () => {
    if (!audioUrl) return;
    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = `voicebloom-${voiceName.toLowerCase()}-${Date.now()}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const copyText = () => {
    if (textSnippet) {
      navigator.clipboard.writeText(textSnippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (!audioUrl) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/60 p-8 text-center backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-rose-500/20 to-purple-500/20 text-rose-400 ring-1 ring-rose-500/30">
          <Sparkles className="h-8 w-8 animate-pulse" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-slate-200">
          Trình Phát Giọng Nói AI
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
          {isFallback
            ? 'Bản thu chưa được tạo thành tệp âm thanh. Bạn có thể nghe trực tiếp bằng giọng tiếng Việt có sẵn trên thiết bị.'
            : 'Chọn phong cách và bấm "Chuyển Thành Giọng Nói" để tạo bản thu bằng Gemini TTS.'}
        </p>
        {isFallback && onPlaySpeechFallback && textSnippet && (
          <button
            onClick={onPlaySpeechFallback}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-rose-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-rose-500/20 transition hover:bg-rose-400"
          >
            <Play className="h-4 w-4" /> Nghe trực tiếp
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-rose-500/30 bg-gradient-to-b from-slate-900/90 via-slate-900/95 to-slate-950 p-6 shadow-2xl backdrop-blur-xl ring-1 ring-white/10">
      {/* Background glow */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-rose-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-purple-500/10 blur-3xl" />

      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
      />

      <div className="flex flex-col gap-4">
        {/* Header with Title and Voice Tag */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-rose-500 to-pink-600 text-white shadow-lg shadow-rose-500/25">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-slate-100">{title}</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2.5 py-0.5 text-xs font-semibold text-rose-300 ring-1 ring-rose-500/30">
                  Giọng {voiceName}
                </span>
                <span className="inline-flex items-center rounded-full bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-300">
                  WAV 24kHz
                </span>
              </div>
              {isFallback ? (
                <p className="text-xs text-amber-300 font-medium line-clamp-1 mt-0.5 flex items-center gap-1">
                  <span>🔊</span>
                  <span>Chế độ: Giọng Đọc Dự Phòng (Web Speech Engine)</span>
                </p>
              ) : (
                <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                  Model: Gemini 3.8 Flash TTS
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {textSnippet && (
              <button
                onClick={copyText}
                title="Sao chép nội dung văn bản"
                className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-700 hover:text-white"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Share2 className="h-3.5 w-3.5" />}
                {copied ? 'Đã chép' : 'Sao chép lời'}
              </button>
            )}
            <button
              onClick={downloadWav}
              title="Tải tệp âm thanh WAV về máy"
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-rose-500 to-pink-600 px-3.5 py-1.5 text-xs font-medium text-white shadow-md shadow-rose-500/20 transition hover:opacity-95"
            >
              <Download className="h-3.5 w-3.5" />
              Tải File WAV
            </button>
          </div>
        </div>

        {/* Text Snippet / Lyrics display */}
        {textSnippet && (
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 text-sm text-slate-300 font-serif italic leading-relaxed">
            "{textSnippet}"
          </div>
        )}

        {/* Audio Visualizer Canvas */}
        <div className="relative flex h-16 w-full items-center justify-center overflow-hidden rounded-xl bg-slate-950/80 px-2 ring-1 ring-slate-800">
          <canvas
            ref={canvasRef}
            width={500}
            height={64}
            className="h-full w-full object-contain"
          />
        </div>

        {/* Seek Bar & Timers */}
        <div className="space-y-1.5">
          <input
            type="range"
            min={0}
            max={duration || 100}
            step="0.01"
            value={currentTime}
            onChange={handleSeek}
            className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 accent-rose-500 transition-all hover:bg-slate-700"
          />
          <div className="flex justify-between text-xs font-mono text-slate-400">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
          {/* Main Controls: Restart, Play/Pause, Loop */}
          <div className="flex items-center gap-2">
            <button
              onClick={restartAudio}
              title="Phát lại từ đầu"
              className="flex h-10 w-10 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-800 hover:text-white"
            >
              <RotateCcw className="h-4 w-4" />
            </button>

            <button
              onClick={togglePlay}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-tr from-rose-500 to-pink-500 text-white shadow-lg shadow-rose-500/30 transition hover:scale-105 active:scale-95"
            >
              {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 translate-x-0.5" />}
            </button>

            <button
              onClick={() => setIsLooping(!isLooping)}
              title={isLooping ? 'Tắt lặp lại' : 'Lặp lại bản thu'}
              className={`flex h-10 w-10 items-center justify-center rounded-full transition ${
                isLooping
                  ? 'bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/40'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Repeat className="h-4 w-4" />
            </button>
          </div>

          {/* Speed & Volume controls */}
          <div className="flex items-center gap-4">
            {/* Speed Selector */}
            <div className="flex items-center gap-1 rounded-lg bg-slate-800/80 p-1 text-xs">
              {[0.8, 1.0, 1.25].map((rate) => (
                <button
                  key={rate}
                  onClick={() => setPlaybackRate(rate)}
                  className={`rounded-md px-2 py-1 font-medium transition ${
                    playbackRate === rate
                      ? 'bg-rose-500 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {rate}x
                </button>
              ))}
            </div>

            {/* Volume */}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleMute}
                className="text-slate-400 hover:text-white"
                title={isMuted ? 'Bật âm' : 'Tắt âm'}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="h-4 w-4 text-rose-400" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="h-1.5 w-16 cursor-pointer appearance-none rounded-lg bg-slate-800 accent-rose-500"
              />
            </div>
          </div>
        </div>

        {stylePrompt && (
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400">
            <span className="font-semibold text-rose-400">Phong thái diễn cảm:</span>
            <span className="truncate">{stylePrompt}</span>
          </div>
        )}
      </div>
    </div>
  );
};
