const DEFAULT_ELEVENLABS_VOICE_ID = 'jdlxsPOZOHdGEfcItXVu';
const ELEVENLABS_MODEL_ID = 'eleven_multilingual_v2';
const ELEVENLABS_OUTPUT_FORMAT = 'mp3_44100_128';
const GOOGLE_TTS_MAX_CHARS = 180;

interface TtsBody {
  text?: string;
  voiceId?: string;
}

const toArrayBuffer = async (response: Response): Promise<ArrayBuffer> => response.arrayBuffer();

const requestElevenLabs = async ({
  apiKey,
  text,
  voiceId,
  signal,
}: {
  apiKey: string;
  text: string;
  voiceId: string;
  signal: AbortSignal;
}): Promise<Response> => {
  return fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      model_id: ELEVENLABS_MODEL_ID,
      output_format: ELEVENLABS_OUTPUT_FORMAT,
      text,
      voice_settings: {
        stability: 0.45,
        similarity_boost: 0.85,
        style: 0.35,
        use_speaker_boost: true,
      },
    }),
    signal,
  });
};

const requestGoogleTranslateTts = async ({ text, signal }: { text: string; signal: AbortSignal }): Promise<Response> => {
  const clippedText = text.slice(0, GOOGLE_TTS_MAX_CHARS);
  const params = new URLSearchParams({
    ie: 'UTF-8',
    client: 'tw-ob',
    tl: 'vi',
    q: clippedText,
  });

  return fetch(`https://translate.google.com/translate_tts?${params.toString()}`, {
    method: 'GET',
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal,
  });
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const body = (req.body || {}) as TtsBody;
  const text = body?.text;
  if (!text || typeof text !== 'string') {
    res.status(400).json({ error: 'text is required' });
    return;
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Missing ELEVENLABS_API_KEY' });
    return;
  }

  const envVoiceId = process.env.ELEVENLABS_VOICE_ID?.trim();
  const requestedVoiceId = body.voiceId?.trim();
  const voiceCandidates = Array.from(
    new Set([requestedVoiceId, envVoiceId, DEFAULT_ELEVENLABS_VOICE_ID].filter(Boolean) as string[]),
  );

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort('TTS timeout'), 45000);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort('TTS timeout'), 45000);

  try {
    let lastError = 'Unknown ElevenLabs error';

    for (const voiceId of voiceCandidates) {
      const response = await requestElevenLabs({
        apiKey,
        text,
        voiceId,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errText = await response.text();
        lastError = `voice=${voiceId}, status=${response.status}, error=${errText}`;
        continue;
      }

      const arrayBuffer = await response.arrayBuffer();
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-TTS-Provider', 'elevenlabs-server');
      res.setHeader('X-ElevenLabs-Voice-Id', voiceId);
    const apiKey = process.env.ELEVENLABS_API_KEY;
    const envVoiceId = process.env.ELEVENLABS_VOICE_ID?.trim();
    const requestedVoiceId = body.voiceId?.trim();
    const voiceCandidates = Array.from(
      new Set([requestedVoiceId, envVoiceId, DEFAULT_ELEVENLABS_VOICE_ID].filter(Boolean) as string[]),
    );

    const errors: string[] = [];

    if (apiKey) {
      for (const voiceId of voiceCandidates) {
        const response = await requestElevenLabs({
          apiKey,
          text,
          voiceId,
          signal: controller.signal,
        });

        if (!response.ok) {
          const errText = await response.text();
          errors.push(`elevenlabs voice=${voiceId} status=${response.status} ${errText}`);
          continue;
        }

        const arrayBuffer = await toArrayBuffer(response);
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-TTS-Provider', 'elevenlabs');
        res.setHeader('X-ElevenLabs-Voice-Id', voiceId);
        res.status(200).send(Buffer.from(arrayBuffer));
        return;
      }
    } else {
      errors.push('elevenlabs missing ELEVENLABS_API_KEY');
    }

    // Fallback miễn phí, không dùng Web Speech
    const freeTtsResponse = await requestGoogleTranslateTts({ text, signal: controller.signal });
    if (freeTtsResponse.ok) {
      const arrayBuffer = await toArrayBuffer(freeTtsResponse);
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-TTS-Provider', 'google-translate');
      res.status(200).send(Buffer.from(arrayBuffer));
      return;
    }

    res.status(502).json({ error: `ElevenLabs error: ${lastError}` });
    const freeTtsError = await freeTtsResponse.text();
    errors.push(`google-translate status=${freeTtsResponse.status} ${freeTtsError}`);
    res.status(502).json({ error: `All TTS providers failed: ${errors.join(' | ')}` });
  } catch (error: any) {
    res.status(502).json({ error: error?.message || String(error) });
  } finally {
    clearTimeout(timeout);
  }
}
