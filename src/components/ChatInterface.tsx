import React, { useState, useEffect, useRef } from 'react';
import Markdown from 'react-markdown';
import { Send, Volume2, Loader2, ArrowLeft, User, Sparkles, BookOpen, X, Feather, Activity, Lightbulb } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { callPuterGemini, isPuterAvailable, streamPuterGemini } from '../lib/puter';

const SYSTEM_PROMPT = `VAI TRÒ: Bạn là "Mentor Thẩm mĩ Thơ ca" hướng dẫn học sinh cấp 3 phân tích thơ hiện đại theo từng bước sư phạm.

MỤC TIÊU PHẢN HỒI:
- Luôn giúp học sinh tự nghĩ ra đáp án trước, không làm hộ ngay.
- Luôn chấm mức độ đúng/sai/thiếu của câu trả lời học sinh.
- Nếu học sinh sai hoặc thiếu: gợi ý tăng dần tối đa 3 lượt. Sau lượt thứ 3 vẫn chưa đạt thì mới đưa đáp án mẫu ngắn gọn.

QUY TẮC BẮT BUỘC VỀ ĐỊNH DẠNG (mọi phản hồi):
1) Dòng đầu tiên luôn là tiêu đề bước: "### BƯỚC X: ...".
2) Tiếp theo là mục "ĐÁNH GIÁ" (đúng/sai/thiếu + vì sao).
3) Tiếp theo là mục "GỢI Ý" (nếu cần).
4) Cuối cùng luôn có dòng: "🔴 **CÂU HỎI TRỌNG TÂM:** ...".
5) Câu hỏi trọng tâm phải chỉ có 1 câu hỏi chính, ngắn, rõ, dễ trả lời.

THANG ĐÁNH GIÁ CÂU TRẢ LỜI HỌC SINH:
- ĐÚNG: nêu được ý cốt lõi + có bằng chứng từ ngữ/hình ảnh thơ.
- THIẾU: đúng hướng nhưng thiếu ví dụ, thiếu tín hiệu thẩm mĩ, hoặc xếp loại chưa đủ nhóm.
- SAI: lệch nghĩa văn bản hoặc không bám câu chữ.

CƠ CHẾ GỢI Ý 3 LẦN:
- Lần 1: gợi ý định hướng rất nhẹ (không lộ đáp án).
- Lần 2: gợi ý cụ thể hơn, khoanh vùng từ khóa/câu thơ.
- Lần 3: gợi ý gần đáp án (khung trả lời).
- Sau 3 lần chưa đạt: đưa đáp án mẫu ngắn + giải thích vì sao.

CÔNG CỤ TƯƠNG TÁC (đặt cuối khi phù hợp):
- [RHYTHM: dòng 1 / ngắt nhịp, dòng 2 / ngắt nhịp]
- [HIGHLIGHT: từ 1, từ 2]
- [CLEAR_MARKUP]
- [SUMMARY_MODE]

QUY TẮC KÍCH HOẠT TƯƠNG TÁC TRÊN VĂN BẢN THƠ (BẮT BUỘC):
- Khi học sinh trả lời ĐÚNG về nhịp: bắt buộc thêm [RHYTHM: ...] để hiện dấu ngắt nhịp trực tiếp trên bài thơ bên trái.
- Khi học sinh trả lời ĐÚNG về hình ảnh/từ ngữ/tín hiệu thẩm mĩ: bắt buộc thêm [HIGHLIGHT: ...] để tô đậm từ/cụm từ tương ứng.
- Khi chuyển sang phân tích sâu một từ/hình ảnh cụ thể: bắt buộc thêm [HIGHLIGHT: ...] chứa đúng từ/hình ảnh đang phân tích.
- Nếu học sinh trả lời sai hoàn toàn, có thể dùng [CLEAR_MARKUP] để xóa đánh dấu cũ trước khi dẫn dắt lại.

LUỒNG DẠY HỌC:
### BƯỚC 1: TRI GIÁC ĐOẠN THƠ
- Mục tiêu: nhận giọng điệu, nhịp điệu, cảm xúc chủ đạo.

### BƯỚC 2: XÁC ĐỊNH TÍN HIỆU THẨM MĨ
- Mục tiêu: chọn từ/cụm từ "đắt", đa nghĩa, gợi hình/gợi cảm.

### BƯỚC 3: PHÂN DẠNG TÍN HIỆU
- Mục tiêu: xếp vào nhóm thể loại, từ ngữ đặc biệt, tu từ, cú pháp.

### BƯỚC 4: GIẢI MÃ TÍN HIỆU
- Mục tiêu: phân tích dụng ý nghệ thuật, hiệu quả biểu đạt.

### BƯỚC 5: TỔNG KẾT
- Bắt buộc dùng [SUMMARY_MODE] + JSON tổng kết như schema cũ.`;

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3, baseDelay = 400): Promise<T> {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await fn();
    } catch (error: any) {
      attempt++;
      const errorMessage = error?.message || '';
      const isRetryable =
        error?.status === 429 ||
        error?.status >= 500 ||
        errorMessage.includes('429') ||
        errorMessage.includes('500') ||
        errorMessage.includes('quota') ||
        errorMessage.includes('Internal') ||
        errorMessage.includes('Failed to fetch') ||
        errorMessage.includes('NetworkError') ||
        errorMessage.includes('Load failed');
      if (!isRetryable || attempt >= maxRetries) {
        throw error;
      }
      const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Max retries reached');
}

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  isAudioLoading?: boolean;
}


interface SummaryData {
  tone: string;
  rhythm: string;
  highlights: { word: string; analysis: string }[];
  mainIdea: string;
}

interface ChatInterfaceProps {
  poem: string;
  author: string;
  onBack: () => void;
}

interface ChatChunk {
  text: string;
}

interface ChatSession {
  sendMessageStream: ({ message }: { message: string }) => AsyncGenerator<ChatChunk, void, unknown>;
}

interface PollinationsMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const DEFAULT_TEXT_ENDPOINT = 'https://text.pollinations.ai/openai/v1/chat/completions';
const TEXT_API_BASE = (import.meta as any).env?.VITE_TEXT_API_BASE as string | undefined;
const SHOULD_USE_LOCAL_API = (import.meta as any).env?.VITE_USE_LOCAL_API === 'true';
const TEXT_API_ENDPOINTS = TEXT_API_BASE
  ? [`${TEXT_API_BASE.replace(/\/$/, '')}/openai/v1/chat/completions`]
  : SHOULD_USE_LOCAL_API
    ? ['/api/chat', DEFAULT_TEXT_ENDPOINT]
    : [DEFAULT_TEXT_ENDPOINT, '/api/chat'];
const TEXT_MODELS = ['openai', 'openai-large'];
const USE_PUTER_GEMINI = (import.meta as any).env?.VITE_USE_PUTER_GEMINI !== 'false';

export function ChatInterface({ poem, author, onBack }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [chatSession, setChatSession] = useState<ChatSession | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showMobilePoem, setShowMobilePoem] = useState(false);
  
  const [initStage, setInitStage] = useState<'analyzing' | 'reading' | 'ready'>('reading');
  const [poemTone] = useState('truyền cảm');
  const [readingPoemLine, setReadingPoemLine] = useState<number | null>(null);
  const activePoemLineRef = useRef<HTMLDivElement>(null);
  
  const [highlights, setHighlights] = useState<string[]>([]);
  const [isSummaryMode, setIsSummaryMode] = useState(false);
  const [summaryText, setSummaryText] = useState('');
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [rhythmLines, setRhythmLines] = useState<string[]>([]);
  
  const initializedRef = useRef(false);
  const convoHistoryRef = useRef<PollinationsMessage[]>([]);
  const unavailableEndpointsRef = useRef<Set<string>>(new Set());

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    // Only auto-scroll when a new message is added or loading state changes,
    // not on every chunk during streaming, so users can read from the top.
    scrollToBottom();
  }, [messages.length, isLoading, initStage]);

  useEffect(() => {
    if (readingPoemLine !== null && activePoemLineRef.current) {
      activePoemLineRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [readingPoemLine]);

  const callTextAI = async (conversation: PollinationsMessage[]): Promise<string> => {
    let lastError: unknown;

    if (USE_PUTER_GEMINI && isPuterAvailable()) {
      try {
        return await callPuterGemini(conversation);
      } catch (error) {
        lastError = error;
      }
    }

    for (const endpoint of TEXT_API_ENDPOINTS) {
      if (unavailableEndpointsRef.current.has(endpoint)) continue;

      for (const model of TEXT_MODELS) {
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort('Text API timeout'), 45000);

        try {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model,
              messages: conversation,
              temperature: 0.35,
            }),
            signal: controller.signal,
          });

          if (!response.ok) {
            const errorText = await response.text();
            if (response.status === 404 && endpoint.startsWith('/api/')) {
              unavailableEndpointsRef.current.add(endpoint);
            }
            throw new Error(`Text API failed (${response.status}, endpoint=${endpoint}, model=${model}): ${errorText}`);
          }

          const data = await response.json();
          const text = data?.choices?.[0]?.message?.content?.trim();
          if (!text) {
            throw new Error(`Text API returned empty content (endpoint=${endpoint}, model=${model})`);
          }

          return text;
        } catch (error: any) {
          if (error?.name === 'AbortError') {
            lastError = new Error(`Text API timeout (endpoint=${endpoint}, model=${model})`);
          } else {
            lastError = error;
          }
        } finally {
          window.clearTimeout(timeout);
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error('Text API failed with unknown error');
  };

  const createChatSession = (historyRef: React.MutableRefObject<PollinationsMessage[]>): ChatSession => {
    return {
      sendMessageStream: async function* ({ message }) {
        historyRef.current.push({ role: 'user', content: message });

        if (USE_PUTER_GEMINI && isPuterAvailable()) {
          try {
            let puterText = '';
            const stream = streamPuterGemini(historyRef.current);
            for await (const part of stream) {
              puterText += part;
              yield { text: part };
            }

            if (puterText.trim()) {
              historyRef.current.push({ role: 'assistant', content: puterText });
              return;
            }
          } catch (error) {
            console.warn('Puter stream failed, fallback to text API:', error);
          }
        }

        const fullText = await withRetry(() => callTextAI(historyRef.current));
        historyRef.current.push({ role: 'assistant', content: fullText });
        yield { text: fullText };
      },
    };
  };

  const parseMarkup = (text: string) => {
    if (text.includes('[CLEAR_MARKUP]')) {
      setHighlights([]);
      setRhythmLines([]);
    }

    const rhythmMatches = Array.from(text.matchAll(/\[RHYTHM:\s*(.*?)\]/g));
    if (rhythmMatches.length > 0) {
      const lastRhythm = rhythmMatches[rhythmMatches.length - 1]?.[1] || '';
      const lines = lastRhythm.split(',').map(l => l.trim()).filter(Boolean);
      setRhythmLines(lines);
    }

    const highlightMatches = Array.from(text.matchAll(/\[HIGHLIGHT:\s*(.*?)\]/g));
    if (highlightMatches.length > 0) {
      const lastHighlight = highlightMatches[highlightMatches.length - 1]?.[1] || '';
      const words = lastHighlight.split(',').map(w => w.trim()).filter(Boolean);
      setHighlights(words);
    }
    
    if (text.includes('[SUMMARY_MODE]')) {
      setIsSummaryMode(true);
      
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[1]);
          setSummaryData(parsed);
        } catch (e) {
          console.error("Failed to parse summary JSON", e);
        }
      }
      
      // Extract the summary text (everything before the tag)
      const cleanText = text.replace(/\[SUMMARY_MODE\]/g, '').replace(/\[RHYTHM:.*?\]/g, '').replace(/\[HIGHLIGHT:.*?\]/g, '').replace(/```json[\s\S]*?```/g, '').trim();
      setSummaryText(cleanText);
    }
  };

  const renderPoem = () => {
    let lines = poem.split('\n');
    
    return lines.map((line, index) => {
      let displayLine = line;
      
      if (rhythmLines.length > 0) {
        const getWords = (s: string) => s.replace(/[.,!?/]/g, '').trim().toLowerCase().split(/\s+/).filter(Boolean);
        const originalWords = getWords(line).join(' ');
        
        const matchedRhythm = rhythmLines.find(rl => {
          const aiWords = getWords(rl).join(' ');
          return originalWords === aiWords && originalWords.length > 0;
        });
        
        if (matchedRhythm) {
          displayLine = matchedRhythm;
        }
      }
      
      let lineElements: React.ReactNode[] = [displayLine];
      
      let spanCounter = 0;
      if (highlights.length > 0) {
        highlights.forEach(word => {
          if (!word) return;
          const regex = new RegExp(`(${word})`, 'gi');
          lineElements = lineElements.flatMap(part => {
            if (typeof part === 'string') {
              const splits = part.split(regex);
              return splits.map((s) => {
                if (s.toLowerCase() === word.toLowerCase()) {
                  spanCounter++;
                  return <span key={`highlight-${spanCounter}`} className="bg-gradient-to-r from-yellow-200 to-yellow-400 text-yellow-900 px-1.5 py-0.5 rounded-md font-semibold transition-all duration-500 shadow-sm inline-block hover:scale-110 hover:-translate-y-0.5 cursor-default">{s}</span>;
                }
                return s;
              });
            }
            return part;
          });
        });
      }
      
      lineElements = lineElements.flatMap(part => {
        if (typeof part === 'string') {
          const splits = part.split(/(\/)/);
          return splits.map((s) => {
            if (s === '/') {
              spanCounter++;
              return <span key={`rhythm-${spanCounter}`} className="text-red-500/80 font-bold mx-2 animate-pulse scale-125 inline-block select-none">/</span>;
            }
            return s;
          });
        }
        return part;
      });

      const isReading = readingPoemLine === index || readingPoemLine === -1;

      return (
        <div 
          key={index} 
          ref={isReading ? activePoemLineRef : null}
          className={`min-h-[1.5rem] transition-all duration-500 hover:bg-white/60 hover:pl-2 rounded-lg cursor-default ${isReading ? 'bg-yellow-100/80 text-yellow-900 font-medium px-4 py-1 rounded-xl -mx-4 shadow-sm scale-[1.02] transform' : 'py-1'}`}
        >
          {lineElements}
        </div>
      );
    });
  };

  const audioTasks = useRef<AudioTask[]>([]);
  const isPlayingAudio = useRef(false);

  const stopAllAudio = () => {
    audioTasks.current = [];
    isPlayingAudio.current = false;
  };

  const addAudioTask = (text: string, onStart?: () => void, onEnd?: () => void) => {
    const task: AudioTask = { text, isFetching: false, isReady: false, isFailed: false, onStart, onEnd };
    audioTasks.current.push(task);
    fetchNextAudio();
  };


  const createPuterElevenLabsPlayer = async (text: string): Promise<(() => Promise<void>) | null> => {
    const puter = (window as any).puter;
    if (!puter?.ai?.txt2speech) return null;

    const audioLike = await puter.ai.txt2speech(text, {
      provider: 'elevenlabs',
      voice: PUTER_ELEVENLABS_VOICE_ID,
      model: 'eleven_multilingual_v2',
      output_format: 'mp3_44100_128',
    });

    return async () => {
      if (audioLike?.pause) {
        try {
          audioLike.currentTime = 0;
        } catch {}
      }

      await new Promise<void>((resolve, reject) => {
        if (!audioLike || typeof audioLike.play !== 'function') {
          reject(new Error('Puter txt2speech returned unsupported audio object'));
          return;
        }

        const cleanup = () => {
          if (typeof audioLike.removeEventListener === 'function') {
            audioLike.removeEventListener('ended', onEnded);
            audioLike.removeEventListener('error', onError);
          }
        };

        const onEnded = () => {
          cleanup();
          resolve();
        };

        const onError = () => {
          cleanup();
          reject(new Error('Puter ElevenLabs playback failed'));
        };

        if (typeof audioLike.addEventListener === 'function') {
          audioLike.addEventListener('ended', onEnded);
          audioLike.addEventListener('error', onError);
        }

        Promise.resolve(audioLike.play())
          .then(() => {
            if (typeof audioLike.addEventListener !== 'function') {
              resolve();
            }
          })
          .catch((error: any) => {
            cleanup();
            reject(error);
          });
      });
    };
  };

  const fetchNextAudio = async () => {
    const task = audioTasks.current.find(t => !t.isFetching && !t.isReady && !t.isFailed);
    if (!task) return;

    task.isFetching = true;
    try {
      const response = await fetch(ELEVENLABS_TTS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: task.text, voiceId: ELEVENLABS_VOICE_ID }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`ElevenLabs TTS failed (${response.status}): ${errText}`);
      }

      const buffer = await response.arrayBuffer();
      let binary = '';
      const bytes = new Uint8Array(buffer);
      const chunkSize = 0x8000;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.slice(i, i + chunkSize));
      }
      task.base64Audio = `data:audio/mpeg;base64,${btoa(binary)}`;
      task.isReady = true;
    } catch (error: any) {
      console.warn('Server ElevenLabs TTS unavailable, trying Puter ElevenLabs:', error);
      try {
        const puterPlay = await createPuterElevenLabsPlayer(task.text);
        if (!puterPlay) {
          throw new Error('Puter ElevenLabs is unavailable in this browser');
        }

        task.puterPlay = puterPlay;
        task.base64Audio = 'puter-elevenlabs';
        task.isReady = true;
        setTtsError(null);
      } catch (puterError) {
        console.warn('Puter ElevenLabs TTS unavailable:', puterError);
        task.isFailed = true;
        setTtsError('Không phát được audio: ElevenLabs server và Puter ElevenLabs đều đang lỗi.');
      }
    } finally {
      task.isFetching = false;
      playNextAudio();
      fetchNextAudio();
    }
  };

  const playNextAudio = async () => {
    if (isPlayingAudio.current) return;
    
    const task = audioTasks.current[0];
    if (!task) return;
    
    if (!task.isReady && !task.isFailed) return;
    
    audioTasks.current.shift();
    
    if (task.isReady && task.base64Audio) {
      isPlayingAudio.current = true;
      if (task.onStart) task.onStart();
      try {
        if (task.puterPlay) {
          await task.puterPlay();
        } else if (task.base64Audio.startsWith('data:audio/')) {
          await new Promise<void>((resolve, reject) => {
            const audio = new Audio(task.base64Audio);
            audio.onended = () => resolve();
            audio.onerror = () => reject(new Error('Failed to play ElevenLabs audio'));
            audio.play().catch(reject);
          });
        }
      } catch (e) {
        console.error("Play error", e);
      } finally {
        if (task.onEnd) task.onEnd();
        isPlayingAudio.current = false;
        playNextAudio();
      }
    } else {
      if (task.onEnd) task.onEnd();
      playNextAudio();
    }
  };

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const initializeMentoring = async () => {
      try {
        convoHistoryRef.current = [{ role: 'system', content: SYSTEM_PROMPT }];

        setInitStage('reading');
        setMessages([{
          id: 'system-reading',
          role: 'model',
          text: '*Đang khởi tạo phiên học và phân tích đoạn thơ...*',
          text: '*Đang đọc đoạn thơ bằng giọng ElevenLabs (server/Puter)...*',
        }]);

        setReadingPoemLine(null);

        // 2. Start Chat
        setInitStage('ready');
        const chat = createChatSession(convoHistoryRef);
        setChatSession(chat);

        const initialPrompt = `Đoạn thơ: ${poem}\nTác giả: ${author}\nHãy bắt đầu BƯỚC 1.`;
        const responseStream = chat.sendMessageStream({ message: initialPrompt });
        
        const firstMessageId = Date.now().toString();
        setMessages(prev => [
          ...prev,
          { id: firstMessageId, role: 'model', text: '' },
        ]);
        
        let fullText = '';
        
        for await (const chunk of responseStream) {
          const chunkText = chunk.text || '';
          fullText += chunkText;
          
          const displayText = fullText.replace(/\[RHYTHM:.*?\]/g, '').replace(/\[HIGHLIGHT:.*?\]/g, '').replace(/\[CLEAR_MARKUP\]/g, '').trim();
          setMessages((prev) => prev.map(m => m.id === firstMessageId ? { ...m, text: displayText } : m));
          
          parseMarkup(fullText);
        }
        
      } catch (error: any) {
        console.error('Initialization error:', error);
        let errorMessage = 'Xin lỗi, đã có lỗi xảy ra khi khởi tạo. Vui lòng thử lại sau.';
        if (error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('quota')) {
          errorMessage = 'Hệ thống đang quá tải hoặc hết hạn mức API. Vui lòng thử lại sau ít phút.';
        } else if (error?.message?.includes('Failed to fetch') || error?.message?.includes('NetworkError')) {
          errorMessage = 'Không thể kết nối tới máy chủ AI (có thể do chặn mạng/CORS ở môi trường deploy). Vui lòng kiểm tra mạng hoặc đổi endpoint TEXT_API.';
        }
        setMessages([{
          id: Date.now().toString(),
          role: 'model',
          text: errorMessage,
        }]);
      } finally {
        setIsLoading(false);
      }
    };

    initializeMentoring();
  }, [poem, author]);

  const sendChatMessage = async (userMessage: string) => {
    if (!chatSession) return;
    

    const newMessageId = Date.now().toString();
    setMessages((prev) => [
      ...prev,
      { id: newMessageId, role: 'user', text: userMessage },
    ]);
    setIsLoading(true);

    try {
      const responseStream = chatSession.sendMessageStream({ message: userMessage });
      const modelMessageId = (Date.now() + 1).toString();
      
      setMessages((prev) => [
        ...prev,
        { id: modelMessageId, role: 'model', text: '' },
      ]);
      
      setIsLoading(false);
      
      let fullText = '';
      
      for await (const chunk of responseStream) {
        const chunkText = chunk.text || '';
        fullText += chunkText;
        
        const displayText = fullText.replace(/\[RHYTHM:.*?\]/g, '').replace(/\[HIGHLIGHT:.*?\]/g, '').replace(/\[CLEAR_MARKUP\]/g, '').trim();
        
        setMessages((prev) => prev.map(m => m.id === modelMessageId ? { ...m, text: displayText } : m));
        
        parseMarkup(fullText);
      }
      
    } catch (error: any) {
      console.error('Failed to send message:', error);
      let errorMessage = 'Xin lỗi, tôi không thể trả lời lúc này. Vui lòng thử lại.';
      if (error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('quota')) {
        errorMessage = 'Hệ thống đang quá tải hoặc hết hạn mức API. Vui lòng thử lại sau ít phút.';
      }
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'model',
          text: errorMessage,
        },
      ]);
      setIsLoading(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || initStage !== 'ready') return;
    const text = input.trim();
    setInput('');
    await sendChatMessage(text);
  };

  return (
    <div className="flex flex-col h-screen bg-[#f5f5f0] max-w-5xl mx-auto shadow-2xl overflow-hidden md:rounded-3xl md:h-[95vh] md:my-[2.5vh]">
      {/* Header */}
      <header className="bg-white px-6 py-4 border-b border-[#e0e0d8] flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-[#f5f5f0] rounded-full transition-colors text-[#5A5A40]"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="font-serif text-xl font-semibold text-[#2c2c28]">Mentor Thơ Ca</h2>
            <p className="text-xs text-[#7A7A5A] uppercase tracking-wider font-medium">{author}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowMobilePoem(!showMobilePoem)}
            className="md:hidden p-2 hover:bg-[#f5f5f0] rounded-full transition-colors text-[#5A5A40]"
          >
            {showMobilePoem ? <X className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Poem Context Panel (Desktop) / Collapsible (Mobile) */}
      <div className="flex-1 flex overflow-hidden relative">
        <div className={`
          absolute inset-0 z-20 bg-[#fafafa] border-r border-[#e0e0d8] p-4 md:p-8 lg:p-12 overflow-y-auto transition-all duration-1000 ease-in-out
          md:relative md:block md:translate-x-0
          ${showMobilePoem ? 'translate-x-0' : '-translate-x-full'}
          ${isSummaryMode ? 'md:w-full border-r-0 flex flex-col items-center' : 'md:w-1/2'}
        `}>
          {!isSummaryMode ? (
            <>
              <h3 className="text-sm font-medium text-[#5A5A40] uppercase tracking-widest mb-6 flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                Nội dung tác phẩm
              </h3>
              <div className="transition-all duration-1000 w-full">
                <div className="font-serif text-xl leading-[2.2] text-[#2c2c28] whitespace-pre-wrap italic pl-6 py-6 bg-gradient-to-br from-white/80 to-white/40 rounded-3xl shadow-sm backdrop-blur-sm">
                  {renderPoem()}
                </div>
              </div>
            </>
          ) : (
            <AnimatePresence>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="w-full max-w-6xl mx-auto py-8"
              >
                {/* Header Section */}
                <motion.div 
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                  className="text-center mb-16"
                >
                  <div className="inline-flex items-center justify-center px-4 py-1.5 mb-6 rounded-full bg-[#5A5A40]/10 text-[#5A5A40] text-sm font-medium tracking-widest uppercase">
                    Kết quả giải mã tín hiệu thẩm mĩ
                  </div>
                  <h2 className="text-4xl md:text-5xl font-serif text-[#2c2c28] font-bold mb-4">Hành Trình Thẩm Mĩ</h2>
                  <div className="w-24 h-1 bg-[#5A5A40] mx-auto rounded-full opacity-30"></div>
                </motion.div>

                {/* Bento Grid Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-12">
                  
                  {/* Left Column: Tone & Rhythm (4/12) */}
                  <div className="lg:col-span-4 flex flex-col gap-6">
                    <motion.div 
                      initial={{ opacity: 0, x: -30 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2, duration: 0.6 }}
                      className="bg-white p-8 rounded-[32px] shadow-sm border border-[#e0e0d8] flex-1 group hover:shadow-md transition-shadow"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                        <Volume2 className="w-6 h-6 text-blue-600" />
                      </div>
                      <h4 className="text-xs font-bold text-[#7A7A5A] uppercase tracking-[0.2em] mb-3">Giọng điệu</h4>
                      <p className="text-2xl font-serif text-[#2c2c28] leading-tight italic">
                        {summaryData?.tone || "Đang cập nhật..."}
                      </p>
                    </motion.div>

                    <motion.div 
                      initial={{ opacity: 0, x: -30 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3, duration: 0.6 }}
                      className="bg-white p-8 rounded-[32px] shadow-sm border border-[#e0e0d8] flex-1 group hover:shadow-md transition-shadow"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                        <Activity className="w-6 h-6 text-red-600" />
                      </div>
                      <h4 className="text-xs font-bold text-[#7A7A5A] uppercase tracking-[0.2em] mb-3">Nhịp thơ</h4>
                      <p className="text-2xl font-serif text-[#2c2c28] leading-tight italic">
                        {summaryData?.rhythm || "Đang cập nhật..."}
                      </p>
                    </motion.div>
                  </div>

                  {/* Center Column: The Poem (4/12) */}
                  <motion.div 
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, duration: 0.8 }}
                    className="lg:col-span-4 bg-[#2c2c28] text-white p-10 rounded-[40px] shadow-2xl relative overflow-hidden flex items-center justify-center min-h-[400px]"
                  >
                    {/* Decorative elements */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full -ml-16 -mb-16 blur-2xl"></div>
                    
                    <div className="relative z-10 w-full text-center">
                      <div className="font-serif text-xl md:text-2xl leading-[2.4] italic whitespace-pre-wrap opacity-90">
                        {renderPoem()}
                      </div>
                      <div className="mt-8 pt-6 border-t border-white/10">
                        <p className="text-xs uppercase tracking-[0.3em] text-white/40 font-medium">{author}</p>
                      </div>
                    </div>
                  </motion.div>

                  {/* Right Column: Highlights (4/12) */}
                  <motion.div 
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4, duration: 0.6 }}
                    className="lg:col-span-4 bg-white p-8 rounded-[32px] shadow-sm border border-[#e0e0d8] overflow-hidden"
                  >
                    <div className="flex items-center justify-between mb-8">
                      <h4 className="text-xs font-bold text-[#7A7A5A] uppercase tracking-[0.2em]">Điểm sáng ngôn từ</h4>
                      <Sparkles className="w-5 h-5 text-yellow-500" />
                    </div>
                    
                    <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                      {summaryData?.highlights?.map((h, i) => (
                        <motion.div 
                          key={i}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.5 + (i * 0.1) }}
                          className="relative pl-6 border-l-2 border-yellow-400/30 py-1"
                        >
                          <div className="absolute left-[-5px] top-2 w-2 h-2 rounded-full bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.6)]"></div>
                          <span className="text-lg font-serif font-bold text-[#2c2c28] block mb-1">
                            {h.word}
                          </span>
                          <p className="text-sm text-[#5A5A40] leading-relaxed italic">
                            {h.analysis}
                          </p>
                        </motion.div>
                      ))}
                      {!summaryData?.highlights?.length && (
                        <div className="text-center py-12">
                          <p className="text-[#7A7A5A] italic text-sm">Chưa có điểm sáng nào được ghi nhận.</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                </div>

                {/* Main Idea Section (Full Width) */}
                <motion.div 
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6, duration: 0.8 }}
                  className="bg-gradient-to-br from-[#5A5A40] to-[#4a4a35] text-white p-12 rounded-[40px] shadow-xl relative overflow-hidden mb-12"
                >
                  <div className="absolute top-0 right-0 p-8 opacity-10">
                    <Lightbulb className="w-32 h-32" />
                  </div>
                  
                  <div className="relative z-10 max-w-3xl mx-auto text-center">
                    <h4 className="text-xs font-bold text-white/60 uppercase tracking-[0.3em] mb-6">Cảm hứng chủ đạo & Nội dung chính</h4>
                    <p className="text-2xl md:text-3xl font-serif leading-relaxed italic">
                      "{summaryData?.mainIdea || "Đang tổng hợp nội dung..."}"
                    </p>
                  </div>
                </motion.div>

                {/* AI Commentary (Optional) */}
                {summaryText && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                    className="max-w-3xl mx-auto mb-16 text-center"
                  >
                    <div className="inline-block p-1 mb-4 rounded-full bg-[#f5f5f0]">
                      <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm">
                        <Sparkles className="w-5 h-5 text-[#5A5A40]" />
                      </div>
                    </div>
                    <div className="markdown-body text-lg text-[#5A5A40] leading-relaxed font-serif italic">
                      <Markdown>{summaryText}</Markdown>
                    </div>
                  </motion.div>
                )}

                {/* Action Buttons */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1 }}
                  className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12"
                >
                  <button
                    onClick={onBack}
                    className="group px-10 py-5 bg-[#5A5A40] text-white rounded-full font-medium hover:bg-[#4a4a35] transition-all duration-300 shadow-lg hover:shadow-2xl transform hover:-translate-y-1 flex items-center gap-3"
                  >
                    <BookOpen className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                    Khám phá tác phẩm mới
                  </button>
                  
                  <button
                    onClick={() => window.print()}
                    className="px-10 py-5 bg-white text-[#5A5A40] border border-[#e0e0d8] rounded-full font-medium hover:bg-[#f5f5f0] transition-all duration-300 shadow-sm flex items-center gap-3"
                  >
                    <Feather className="w-5 h-5" />
                    Lưu lại hành trình
                  </button>
                </motion.div>
              </motion.div>
            </AnimatePresence>
          )}
        </div>

        {/* Chat Area */}
        <div className={`flex flex-col bg-white overflow-hidden relative transition-all duration-1000 ease-in-out ${isSummaryMode ? 'w-0 opacity-0' : 'flex-1 md:w-1/2 opacity-100'}`}>
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    msg.role === 'user' ? 'bg-[#e0e0d8] text-[#5A5A40]' : 'bg-[#5A5A40] text-white'
                  }`}>
                    {msg.role === 'user' ? <User className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
                  </div>
                  
                  <div className={`max-w-[85%] md:max-w-[75%] rounded-2xl p-5 ${
                    msg.role === 'user' 
                      ? 'bg-[#f5f5f0] text-[#2c2c28] rounded-tr-sm' 
                      : 'bg-white border border-[#e0e0d8] text-[#2c2c28] rounded-tl-sm shadow-sm'
                  }`}>
                    {msg.role === 'model' && (
                      <div className="markdown-body text-[15px] leading-relaxed">
                        <Markdown
                          components={{
                            p: ({ children }) => {
                              const plain = Array.isArray(children) ? children.join('') : String(children ?? '');
                              if (plain.includes('CÂU HỎI TRỌNG TÂM')) {
                                return <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 font-semibold text-red-700">{children}</p>;
                              }
                              return <p>{children}</p>;
                            },
                          }}
                        >
                          {msg.text}
                        </Markdown>
                      </div>
                    )}
                    {msg.role === 'user' && (
                      <div className="text-[15px] leading-relaxed whitespace-pre-wrap">
                        {msg.text}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            
            {initStage === 'analyzing' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-center py-4">
                <div className="bg-[#f5f5f0] text-[#5A5A40] px-4 py-2 rounded-full text-sm flex items-center gap-2 shadow-sm border border-[#e0e0d8]">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Đang phân tích giọng điệu bài thơ...
                </div>
              </motion.div>
            )}
            
            {initStage === 'reading' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-center py-4">
                <div className="bg-[#f5f5f0] text-[#5A5A40] px-4 py-2 rounded-full text-sm flex items-center gap-2 shadow-sm border border-[#e0e0d8]">
                  <Volume2 className="w-4 h-4 animate-pulse" />
                  Đang chuẩn bị phiên học: <span className="font-semibold">{poemTone}</span>
                </div>
              </motion.div>
            )}

            {isLoading && initStage === 'ready' && (
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                className="flex gap-4"
              >
                <div className="w-10 h-10 rounded-full bg-[#5A5A40] text-white flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="bg-white border border-[#e0e0d8] rounded-2xl rounded-tl-sm p-5 flex items-center gap-2 shadow-sm">
                  <div className="w-2 h-2 bg-[#5A5A40] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-[#5A5A40] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-[#5A5A40] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </motion.div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-white border-t border-[#e0e0d8]">
            <form onSubmit={handleSend} className="relative flex items-end gap-2 max-w-4xl mx-auto">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(e);
                  }
                }}
                placeholder="Nhập câu trả lời của bạn..."
                className="w-full bg-[#f5f5f0] border-none rounded-2xl py-3 pl-4 pr-14 focus:ring-2 focus:ring-[#5A5A40] resize-none max-h-32 min-h-[52px]"
                rows={1}
                disabled={isLoading || initStage !== 'ready'}
              />
              
              <div className="absolute right-2 bottom-1.5 flex items-center gap-1">
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading || initStage !== 'ready'}
                  className="p-2 bg-[#5A5A40] text-white rounded-xl hover:bg-[#4a4a34] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </form>
            <div className="text-center mt-2">
              <span className="text-[10px] text-[#7A7A5A] uppercase tracking-wider">Nhấn Enter để gửi, Shift + Enter để xuống dòng.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
