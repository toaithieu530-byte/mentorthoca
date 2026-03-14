const GOOGLE_TTS_MAX_CHARS = 180;

interface TtsBody {
  text?: string;
  language?: string;
}

const toArrayBuffer = async (response: Response): Promise<ArrayBuffer> => response.arrayBuffer();

const requestGoogleTranslateTts = async ({
  text,
  language,
  signal,
}: {
  text: string;
  language: string;
  signal: AbortSignal;
}): Promise<Response> => {
  const clippedText = text.slice(0, GOOGLE_TTS_MAX_CHARS);
  const params = new URLSearchParams({
    ie: 'UTF-8',
    client: 'tw-ob',
    tl: language,
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
  const language = body?.language?.trim() || 'vi';

  if (!text || typeof text !== 'string') {
    res.status(400).json({ error: 'text is required' });
    return;
  }

  const envVoiceId = process.env.ELEVENLABS_VOICE_ID?.trim();
  const requestedVoiceId = body.voiceId?.trim();
  const voiceCandidates = Array.from(
    new Set([requestedVoiceId, envVoiceId, DEFAULT_ELEVENLABS_VOICE_ID].filter(Boolean) as string[]),
  );

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort('TTS timeout'), 45000);

  try {
    const response = await requestGoogleTranslateTts({
      text,
      language,
      signal: controller.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      res.status(502).json({ error: `Google TTS failed (${response.status}): ${errText}` });
      return;
    }

    const arrayBuffer = await toArrayBuffer(response);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-TTS-Provider', 'google-translate');
    res.status(200).send(Buffer.from(arrayBuffer));

    if (!response.ok) {
      const errText = await response.text();
      res.status(502).json({ error: `Google TTS failed (${response.status}): ${errText}` });
      return;
    }

    const arrayBuffer = await toArrayBuffer(response);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-TTS-Provider', 'google-translate');
    res.status(200).send(Buffer.from(arrayBuffer));
    const apiKey = process.env.ELEVENLABS_API_KEY;
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

    const freeTtsResponse = await requestGoogleTranslateTts({ text, signal: controller.signal });
    if (freeTtsResponse.ok) {
      const arrayBuffer = await toArrayBuffer(freeTtsResponse);
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-TTS-Provider', 'google-translate');
      res.status(200).send(Buffer.from(arrayBuffer));
      return;
    }

    const freeTtsError = await freeTtsResponse.text();
    errors.push(`google-translate status=${freeTtsResponse.status} ${freeTtsError}`);
    res.status(502).json({ error: `All TTS providers failed: ${errors.join(' | ')}` });
  } catch (error: any) {
    res.status(502).json({ error: error?.message || String(error) });
  } finally {
    clearTimeout(timeout);
  }
}
