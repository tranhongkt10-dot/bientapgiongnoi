import React from 'react';
import { GeneratedAudio } from '../types';
import { Play, Download, Trash2, Clock, Music2 } from 'lucide-react';

interface HistoryListProps {
  history: GeneratedAudio[];
  onSelect: (item: GeneratedAudio) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
  activeAudioUrl: string | null;
}

export const HistoryList: React.FC<HistoryListProps> = ({
  history,
  onSelect,
  onDelete,
  onClearAll,
  activeAudioUrl,
}) => {
  if (history.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-8 text-center">
        <Music2 className="mx-auto h-8 w-8 text-slate-600 mb-2" />
        <p className="text-sm font-medium text-slate-400">Chưa có bản thu nào được lưu.</p>
        <p className="text-xs text-slate-400 mt-1">
          Các bản thu tạo ra sẽ tự động được lưu trữ tại đây trong phiên làm việc.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg backdrop-blur-md">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-4">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-rose-400" />
          <h3 className="text-sm font-semibold text-slate-200">
            Lịch Sử Bản Thu ({history.length})
          </h3>
        </div>
        <button
          onClick={onClearAll}
          className="text-xs text-slate-400 hover:text-red-400 transition"
        >
          Xoá tất cả
        </button>
      </div>

      <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
        {history.map((item) => {
          const isActive = activeAudioUrl === item.audioUrl;
          const formattedDate = new Date(item.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });

          return (
            <div
              key={item.id}
              className={`group flex items-center justify-between gap-3 rounded-xl p-3 transition-all ${
                isActive
                  ? 'border border-rose-500/50 bg-rose-500/10'
                  : 'border border-slate-800/70 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-800/30'
              }`}
            >
              <button
                onClick={() => onSelect(item)}
                className="flex items-start gap-3 flex-1 text-left min-w-0"
              >
                <div
                  className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${
                    isActive
                      ? 'bg-rose-500 text-white shadow-md shadow-rose-500/30'
                      : 'bg-slate-800 text-slate-300 group-hover:bg-rose-500/20 group-hover:text-rose-300'
                  }`}
                >
                  <Play className="h-4 w-4 translate-x-0.5" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-200">
                      {item.voiceName}
                    </span>
                    <span className="rounded bg-slate-800 px-1.5 py-0.2 text-[10px] text-slate-400">
                      {item.mode === 'dialogue' ? 'Đối thoại' : 'Đơn thoại'}
                    </span>
                    <span className="text-[10px] text-slate-500">{formattedDate}</span>
                  </div>

                  <p className="mt-1 text-xs text-slate-400 line-clamp-1 italic font-serif">
                    "{item.dialoguePreview || item.text}"
                  </p>
                </div>
              </button>

              <div className="flex items-center gap-1.5 shrink-0">
                <a
                  href={item.audioUrl}
                  download={`voicebloom-${item.voiceName}-${item.timestamp}.wav`}
                  title="Tải tệp WAV"
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
                >
                  <Download className="h-4 w-4" />
                </a>
                <button
                  onClick={() => onDelete(item.id)}
                  title="Xoá bản thu"
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-red-400 transition"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
