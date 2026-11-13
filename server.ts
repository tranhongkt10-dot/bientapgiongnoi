import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

app.use(express.json({ limit: '15mb' }));

// Ensure preview cache folder exists on disk
const PREVIEW_CACHE_DIR = path.resolve(__dirname, 'preview_cache');
if (!fs.existsSync(PREVIEW_CACHE_DIR)) {
  fs.mkdirSync(PREVIEW_CACHE_DIR, { recursive: true });
}

// Initialize Google GenAI client according to AI Studio guidelines
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Helper to generate a clean, harmonic fallback WAV buffer (24kHz Mono 16-bit PCM)
function createFallbackWav(durationSeconds = 4, sampleRate = 24000): Buffer {
  const numSamples = Math.floor(Math.max(2, Math.min(25, durationSeconds)) * sampleRate);
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF identifier
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // fmt subchunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // subchunk1 size (16 for PCM)
  buffer.writeUInt16LE(1, 20); // audio format (1 = PCM)
  buffer.writeUInt16LE(1, 22); // num channels (1 = mono)
  buffer.writeUInt32LE(sampleRate, 24); // sample rate
  buffer.writeUInt32LE(sampleRate * 2, 28); // byte rate
  buffer.writeUInt16LE(2, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample

  // data subchunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Generate warm, gentle acoustic chord chime with soft decay
  const baseFreqs = [261.63, 329.63, 392.0, 523.25]; // C major chord chime
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let sample = 0;
    const decay = Math.exp(-t * 0.45) * Math.min(1, t * 15);
    for (const freq of baseFreqs) {
      sample += Math.sin(2 * Math.PI * freq * t) * 0.22;
    }
    sample += Math.sin(2 * Math.PI * 440 * t) * 0.08 * Math.exp(-t * 1.2);
    const intSample = Math.max(-32767, Math.min(32767, Math.floor(sample * decay * 14000)));
    buffer.writeInt16LE(intSample, 44 + i * 2);
  }

  return buffer;
}

// Single-speaker & Multi-speaker TTS Endpoint with disk caching and resilient fallback
app.post('/api/tts', async (req, res) => {
  const {
    mode = 'single',
    text,
    voiceName = 'Kore',
    style,
    accentInstruction,
    dialogue,
  } = req.body;

  const validVoices = ['Kore', 'Puck', 'Fenrir', 'Charon', 'Zephyr'];
  const safeVoiceName = validVoices.includes(voiceName) ? voiceName : 'Kore';

  // 1. Check disk cache first to conserve user's Gemini quota
  const cacheKey =
    mode === 'dialogue'
      ? `dialogue_${crypto.createHash('md5').update(JSON.stringify(dialogue || [])).digest('hex')}`
      : `single_${safeVoiceName}_${crypto.createHash('md5').update(`${(text || '').trim()}_${style || ''}_${accentInstruction || ''}`).digest('hex')}`;
  const cachePath = path.join(PREVIEW_CACHE_DIR, `tts_${cacheKey}.wav`);

  if (fs.existsSync(cachePath)) {
    try {
      const cachedBuf = fs.readFileSync(cachePath);
      return res.json({
        audioData: cachedBuf.toString('base64'),
        mimeType: 'audio/wav',
        model: 'cached-gemini-tts',
        cached: true,
      });
    } catch (e) {
      console.warn('Failed to read from cache, continuing to generate:', e);
    }
  }

  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured in environment secrets.');
    }

    if (mode === 'dialogue') {
      // Validate multi-speaker dialogue
      if (!Array.isArray(dialogue) || dialogue.length === 0) {
        return res.status(400).json({ error: 'Dialogue lines are required for dialogue mode.' });
      }

      // Collect unique speakers (Gemini 3.8 Flash TTS multi-speaker supports exactly 2 speakers)
      const speakerNames = Array.from(new Set(dialogue.map((d: { speaker: string }) => d.speaker.trim())));
      if (speakerNames.length !== 2) {
        return res.status(400).json({
          error: 'Chế độ đối thoại cần đúng 2 nhân vật (ví dụ: Mẹ và Con).',
        });
      }

      // Find assigned voices for each speaker
      const speakerConfigs = speakerNames.map((name, idx) => {
        const item = dialogue.find((d: { speaker: string; voiceName?: string }) => d.speaker.trim() === name);
        const rawName = item?.voiceName || (idx === 0 ? 'Kore' : 'Puck');
        const v = validVoices.includes(rawName) ? rawName : (idx === 0 ? 'Kore' : 'Puck');
        return {
          speaker: name,
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: v,
            },
          },
        };
      });

      // Prepare contents parts with regional accent & style
      const parts = dialogue.map((line: { speaker: string; text: string; style?: string; accentInstruction?: string }) => {
        const lineStyle = [line.accentInstruction, line.style].filter(Boolean).join('. ') || 'Natural, warm and conversational Vietnamese speech';
        return {
          text: `${line.speaker}: ${line.text}`,
          speechMetadata: {
            speaker: line.speaker,
            style: lineStyle,
          },
        };
      });

      let response: any;
      let usedModel = 'gemini-3.8-flash-tts';

      try {
        response = await ai.models.generateContent({
          model: 'gemini-3.8-flash-tts',
          contents: [{ role: 'user', parts: parts }],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              multiSpeakerVoiceConfig: {
                speakerVoiceConfigs: speakerConfigs,
              },
            },
          },
        });
      } catch (err: any) {
        console.warn('Dialogue TTS error with gemini-3.8-flash-tts:', err?.message?.slice(0, 100));
        throw err;
      }

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        throw new Error('Không thể tạo âm thanh đối thoại từ Gemini.');
      }

      // Save to disk cache
      try {
        fs.writeFileSync(cachePath, Buffer.from(base64Audio, 'base64'));
      } catch (e) {
        console.warn('Failed to save dialogue cache:', e);
      }

      return res.json({
        audioData: base64Audio,
        mimeType: 'audio/wav',
        model: usedModel,
        cached: false,
      });
    } else {
      // Single speaker TTS
      if (!text || typeof text !== 'string' || !text.trim()) {
        return res.status(400).json({ error: 'Văn bản không được để trống.' });
      }

      const combinedStyle = [accentInstruction, style].filter(Boolean).join('. ');
      const stylePrompt = combinedStyle.trim().length > 0
        ? combinedStyle.trim()
        : 'Warm, emotional, and loving voice speaking naturally and smoothly in Vietnamese';

      let response: any;
      let usedModel = 'gemini-3.8-flash-lite-tts';

      try {
        response = await ai.models.generateContent({
          model: 'gemini-3.8-flash-lite-tts',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: text.trim(),
                  speechMetadata: {
                    style: stylePrompt,
                  },
                },
              ],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: safeVoiceName,
                },
              },
            },
          },
        });
      } catch (err: any) {
        // If flash-lite fails, attempt with gemini-3.8-flash-tts
        if (!err?.message?.includes('429') && !err?.message?.includes('RESOURCE_EXHAUSTED')) {
          usedModel = 'gemini-3.8-flash-tts';
          response = await ai.models.generateContent({
            model: 'gemini-3.8-flash-tts',
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    text: text.trim(),
                    speechMetadata: {
                      style: stylePrompt,
                    },
                  },
                ],
              },
            ],
            config: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: safeVoiceName,
                  },
                },
              },
            },
          });
        } else {
          throw err;
        }
      }

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        throw new Error('Không thể tạo giọng nói từ model.');
      }

      // Save to disk cache
      try {
        fs.writeFileSync(cachePath, Buffer.from(base64Audio, 'base64'));
      } catch (e) {
        console.warn('Failed to save single tts cache:', e);
      }

      return res.json({
        audioData: base64Audio,
        mimeType: 'audio/wav',
        model: usedModel,
        cached: false,
      });
    }
  } catch (error: any) {
    console.warn('TTS API warning/error:', error?.message?.slice(0, 150));
    const isQuota =
      error?.message?.includes('429') ||
      error?.message?.includes('quota') ||
      error?.message?.includes('RESOURCE_EXHAUSTED');

    // Resilient fallback: Return a valid fallback WAV so frontend never crashes
    const approxDuration = mode === 'dialogue'
      ? Math.max(4, Math.min(20, (dialogue?.length || 2) * 4))
      : Math.max(3, Math.min(15, Math.ceil((text?.length || 50) / 16)));

    const fallbackBuf = createFallbackWav(approxDuration);

    return res.json({
      audioData: fallbackBuf.toString('base64'),
      mimeType: 'audio/wav',
      model: 'web-speech-fallback',
      quotaExceeded: isQuota,
      isFallback: true,
      cached: false,
      notice: isQuota
        ? 'Tài khoản đã đạt hạn mức 10 yêu cầu/ngày của Gemini TTS miễn phí. Ứng dụng đã tự động kích hoạt Giọng Đọc Dự Phòng (Web Speech Engine) để bạn tiếp tục nghe không giới hạn.'
        : 'Đã chuyển sang giọng đọc dự phòng.',
    });
  }
});

// Cache for voice previews with disk persistence
app.post('/api/voice-preview', async (req, res) => {
  try {
    const { voiceName, previewText, style, accentInstruction } = req.body;
    if (!voiceName) {
      return res.status(400).json({ error: 'voiceName is required' });
    }

    const validVoices = ['Kore', 'Puck', 'Fenrir', 'Charon', 'Zephyr'];
    const safeVoiceName = validVoices.includes(voiceName) ? voiceName : 'Kore';

    const combinedStyle = [accentInstruction, style].filter(Boolean).join('. ');
    const sampleText = previewText || `Xin chào, tôi là giọng đọc ${safeVoiceName}. Rất vui được đồng hành cùng bạn.`;
    const stylePrompt = combinedStyle || 'Clear, warm, expressive, and natural Vietnamese delivery';

    // Calculate a unique hash for disk cache
    const cacheKeyRaw = `${safeVoiceName}_${sampleText}_${stylePrompt}`;
    const hash = crypto.createHash('md5').update(cacheKeyRaw).digest('hex');
    const diskPath = path.join(PREVIEW_CACHE_DIR, `${hash}.wav`);

    // 1. Check disk cache first (Instant response, 0 API calls)
    if (fs.existsSync(diskPath)) {
      const fileBuffer = fs.readFileSync(diskPath);
      return res.json({
        audioData: fileBuffer.toString('base64'),
        mimeType: 'audio/wav',
        cached: true,
      });
    }

    // 2. Try generating with gemini-3.8-flash-lite-tts (or gemini-3.8-flash-tts)
    let base64Audio: string | undefined;

    // Use gemini-3.8-flash-lite-tts first for preview to conserve full-TTS quota
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: sampleText,
                speechMetadata: {
                  style: stylePrompt,
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: safeVoiceName,
              },
            },
          },
        },
      });
      base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    } catch (liteErr: any) {
      // If lite fails, attempt with gemini-3.8-flash-tts
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash-tts',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: sampleText,
                  speechMetadata: {
                    style: stylePrompt,
                  },
                },
              ],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: safeVoiceName,
                },
              },
            },
          },
        });
        base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      } catch (fullErr: any) {
        console.warn('Voice preview API error:', fullErr?.message?.slice(0, 100));
        const isQuota =
          fullErr?.message?.includes('429') ||
          fullErr?.message?.includes('quota') ||
          fullErr?.message?.includes('RESOURCE_EXHAUSTED') ||
          liteErr?.message?.includes('429');
        return res.status(isQuota ? 429 : 500).json({
          error: isQuota ? 'Quota reached' : fullErr?.message || 'Preview generation failed',
          quotaExceeded: isQuota,
        });
      }
    }

    if (!base64Audio) {
      return res.status(500).json({ error: 'No audio returned for preview' });
    }

    // Save to disk cache permanently
    try {
      fs.writeFileSync(diskPath, Buffer.from(base64Audio, 'base64'));
    } catch (writeErr) {
      console.warn('Failed to write preview to disk cache:', writeErr);
    }

    return res.json({
      audioData: base64Audio,
      mimeType: 'audio/wav',
      cached: false,
    });
    } catch (error: any) {
    const isQuota =
      error?.message?.includes('429') ||
      error?.message?.includes('quota') ||
      error?.message?.includes('RESOURCE_EXHAUSTED');

    // Return fallback preview WAV so preview never throws 500/429
    const fallbackBuf = createFallbackWav(3);
    return res.json({
      audioData: fallbackBuf.toString('base64'),
      mimeType: 'audio/wav',
      cached: false,
      isFallback: true,
      quotaExceeded: isQuota,
    });
  }
});

// Helper endpoint for script enhancement or generating expressive texts with vocal tags
app.post('/api/enhance-text', async (req, res) => {
  const { action, text = '', theme } = req.body;

  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is missing.');
    }

    let prompt = '';
    if (action === 'add-vocal-bursts') {
      prompt = `Take this text and subtly enhance it with Gemini 3.8 Flash TTS vocal burst tags like <laugh>, <gasp>, <breath>, <sigh>, |mhm|, |yeah| to make it sound deeply realistic, emotive, and human. Keep the original language (e.g. Vietnamese if input is Vietnamese). Return ONLY the enhanced text, nothing else.
Input text: "${text}"`;
    } else if (action === 'generate-poem') {
      prompt = `Write a short, heart-melting 2 to 4-sentence poetic message or lullaby on the theme of "${theme || 'mẹ yêu con, tình mẫu tử thiết tha'}". Use natural emotional phrasing suitable for high quality text-to-speech reading. Include 1 or 2 subtle vocal tags like <breath> or <sigh> if appropriate. Language: Vietnamese. Return ONLY the text, nothing else.`;
    } else {
      prompt = `Polish and improve this text for expressive Text-to-Speech narration with warm emotional delivery. Return ONLY the improved text:\n"${text}"`;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
    });

    const output = response.text?.trim() || text;
    return res.json({ result: output, fromFallback: false });
  } catch (err: any) {
    console.warn('Enhance text fallback activated due to:', err?.message?.slice(0, 100));

    // Intelligent local fallback so the user always gets enhanced text
    if (action === 'add-vocal-bursts') {
      let enhanced = text.trim();
      if (!enhanced) {
        enhanced = 'Này con yêu ơi <breath>, mẹ yêu con nhất trên đời. <sigh>';
      } else {
        // Add breath at commas or periods if missing
        if (!enhanced.includes('<breath>') && !enhanced.includes('<sigh>') && !enhanced.includes('<laugh>')) {
          if (enhanced.includes(',')) {
            enhanced = enhanced.replace(',', ', <breath>');
          } else if (enhanced.includes('.')) {
            enhanced = enhanced.replace('.', '. <breath>');
          } else {
            enhanced = `${enhanced} <breath>`;
          }
        }
      }
      return res.json({ result: enhanced, fromFallback: true });
    } else if (action === 'generate-poem') {
      const lullabies = [
        'Này con yêu ơi con biết không, mẹ yêu con yêu con nhất trên đời. <breath> Dù mai này khôn lớn, đi đến muôn trùng phương xa, vòng tay mẹ vẫn luôn ở đây chở che cho con.',
        'À ơi con ngủ cho ngoan, lời ru của mẹ chứa chan ân tình. <breath> Trăng khuya soi bóng thanh bình, mong con khôn lớn an lành mỗi mai. <sigh>',
        'Con là tia nắng bình minh, sưởi ấm lòng mẹ lung linh nụ cười. <breath> Dẫu cho bão táp muôn nơi, bên con mẹ thấy một trời bình yên.',
        'Gió mùa thu mẹ ru con ngủ, năm canh chày thức đủ vừa năm. <breath> Hỡi chàng chàng hỡi hãy yên lòng, dẫu ngàn gian khổ mẹ tròn chở che. <sigh>',
      ];
      const picked = lullabies[Math.floor(Math.random() * lullabies.length)];
      return res.json({ result: picked, fromFallback: true });
    }

    return res.json({ result: text, fromFallback: true });
  }
});

// Mount Vite in development or serve static in production
if (process.env.NODE_ENV !== 'production') {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.resolve(__dirname, 'dist')));
  app.get('*', (_req, res) => {
    res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
  });
}

app.listen(port, '0.0.0.0', () => {
  console.log(`VoiceBloom TTS Server running at http://0.0.0.0:${port}`);
});
