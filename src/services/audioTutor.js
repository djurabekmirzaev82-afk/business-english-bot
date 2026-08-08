const config = require('../config');

// Gemini's native text-to-speech model. Returns raw 16-bit PCM audio (mono, 24kHz)
// that we wrap in a WAV header ourselves before sending to Telegram.
const TTS_MODEL = 'gemini-2.5-flash-preview-tts';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent`;

const SAMPLE_RATE = 24000;
const CHANNELS = 1;
const BITS_PER_SAMPLE = 16;

function assertConfigured() {
  if (!config.geminiApiKey) {
    const err = new Error("GEMINI_API_KEY sozlanmagan. .env fayliga API kalitni qo'shing.");
    err.code = 'AI_NOT_CONFIGURED';
    throw err;
  }
}

/**
 * Wraps raw 16-bit PCM audio data in a standard 44-byte WAV header so that
 * Telegram (and any standard audio player) can play it back correctly.
 */
function pcmToWav(pcmBuffer) {
  const byteRate = (SAMPLE_RATE * CHANNELS * BITS_PER_SAMPLE) / 8;
  const blockAlign = (CHANNELS * BITS_PER_SAMPLE) / 8;
  const dataSize = pcmBuffer.length;
  const header = Buffer.alloc(44);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // fmt chunk size
  header.writeUInt16LE(1, 20); // audio format = 1 (PCM)
  header.writeUInt16LE(CHANNELS, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(BITS_PER_SAMPLE, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

async function callTts(body) {
  assertConfigured();

  const response = await fetch(`${API_URL}?key=${config.geminiApiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini TTS xatosi (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const part = data.candidates?.[0]?.content?.parts?.[0];
  const base64Audio = part?.inlineData?.data;
  if (!base64Audio) {
    throw new Error('Gemini TTS audio qaytarmadi.');
  }
  const pcmBuffer = Buffer.from(base64Audio, 'base64');
  return pcmToWav(pcmBuffer);
}

/**
 * Generates single-speaker speech audio (WAV Buffer) from plain text.
 * `voiceName` is one of Gemini's ~30 prebuilt voices (default: a clear, neutral voice).
 */
async function generateSpeech(text, voiceName = 'Kore') {
  const body = {
    contents: [{ parts: [{ text }] }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName } },
      },
    },
  };
  return callTts(body);
}

/**
 * Generates two-speaker dialogue audio (WAV Buffer). `script` must be plain text
 * with lines like "Speaker1: ...\nSpeaker2: ...", matching the speaker names given.
 */
async function generateDialogueSpeech(script, speaker1Name, speaker1Voice, speaker2Name, speaker2Voice) {
  const body = {
    contents: [{ parts: [{ text: script }] }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        multiSpeakerVoiceConfig: {
          speakerVoiceConfigs: [
            { speaker: speaker1Name, voiceConfig: { prebuiltVoiceConfig: { voiceName: speaker1Voice } } },
            { speaker: speaker2Name, voiceConfig: { prebuiltVoiceConfig: { voiceName: speaker2Voice } } },
          ],
        },
      },
    },
  };
  return callTts(body);
}

module.exports = { generateSpeech, generateDialogueSpeech };
