export type VoiceCategory = 'all' | 'maternal' | 'youth' | 'deep' | 'narrator' | 'mc' | 'editor' | 'storyteller';
export type VoiceRole = 'all' | 'mc' | 'editor' | 'storyteller' | 'narrator' | 'maternal' | 'kids';
export type Region = 'hanoi' | 'saigon' | 'hue' | 'nghean' | 'hatinh' | 'mientay';
export type FilterRegion = 'all' | Region;
export type FilterGender = 'all' | 'female' | 'male' | 'kids';
export type FilterRole = 'all' | 'mc' | 'editor' | 'storyteller' | 'narrator' | 'maternal' | 'kids';

export interface VoiceOption {
  id: string;
  voiceName: string; // Prebuilt Gemini voice (Kore, Fenrir, Puck, Charon, Zephyr)
  name: string; // Vietnamese persona name
  gender: 'female' | 'male';
  isChild?: boolean; // True for children/kids voices
  role: VoiceRole;
  roleName: string; // "MC Sự kiện", "Biên tập viên", "Người kể chuyện", "Người dẫn chuyện", "Thiếu nhi", "Lời mẹ ru"
  region: Region;
  regionName: string; // "Hà Nội", "Sài Gòn", "Huế", "Nghệ An", "Hà Tĩnh", "Miền Tây"
  category: VoiceCategory;
  tone: string;
  description: string;
  avatar: string;
  recommendedFor: string;
  sampleText: string;
  sampleStyle?: string;
  accentInstruction: string;
}

export interface Preset {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  mode: 'single' | 'dialogue';
  text?: string;
  voiceId?: string;
  voiceName?: string;
  style?: string;
  dialogue?: Array<{
    speaker: string;
    text: string;
    style: string;
    voiceName: string;
    voiceId?: string;
  }>;
}

export interface GeneratedAudio {
  id: string;
  timestamp: number;
  text: string;
  audioUrl: string;
  voiceName: string;
  style: string;
  mode: 'single' | 'dialogue';
  dialoguePreview?: string;
  duration?: number;
  regionName?: string;
  roleName?: string;
}

export interface DialogueLine {
  id: string;
  speaker: string;
  text: string;
  style: string;
  voiceName: string;
  voiceId?: string;
}
