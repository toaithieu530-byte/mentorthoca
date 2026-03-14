import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, Feather } from 'lucide-react';



type PuterAuthState = 'unknown' | 'signed-in' | 'signed-out' | 'loading';

const isPuterSignedIn = async (): Promise<boolean> => {
  const puter = (window as any).puter;
  if (!puter?.auth) return false;

  try {
    if (typeof puter.auth.isSignedIn === 'function') {
      const value = await puter.auth.isSignedIn();
      return Boolean(value);
    }

    if (typeof puter.auth.getUser === 'function') {
      const user = await puter.auth.getUser();
      return Boolean(user);
    }
  } catch {
    return false;
  }

  return false;
};

const requestPuterSignIn = async (): Promise<void> => {
  const puter = (window as any).puter;
  if (!puter?.auth) throw new Error('Puter SDK chưa sẵn sàng');

  if (typeof puter.auth.signIn === 'function') {
    await puter.auth.signIn();
    return;
  }

  if (typeof puter.auth.login === 'function') {
    await puter.auth.login();
    return;
  }

  throw new Error('Không tìm thấy hàm đăng nhập Puter trong SDK');
};
interface PoemInputProps {
  onSubmit: (poem: string, author: string) => void;
}

export function PoemInput({ onSubmit }: PoemInputProps) {
  const [poem, setPoem] = useState('');
  const [author, setAuthor] = useState('');
  const [puterAuthState, setPuterAuthState] = useState<PuterAuthState>('unknown');
  const [puterAuthError, setPuterAuthError] = useState<string | null>(null);
  const loginTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    let mounted = true;

    const bootstrapAuth = async () => {
      setPuterAuthState('loading');
      const signedIn = await isPuterSignedIn();
      if (!mounted) return;
      setPuterAuthState(signedIn ? 'signed-in' : 'signed-out');
    };

    bootstrapAuth();

    return () => {
      mounted = false;
    };
  }, []);

  const handlePuterLogin = async () => {
    setPuterAuthError(null);
    setPuterAuthState('loading');

    try {
      const loginPromise = requestPuterSignIn();
      const timeoutPromise = new Promise<never>((_, reject) => {
        loginTimeoutRef.current = window.setTimeout(() => {
          reject(new Error('Đăng nhập Puter đang mất quá lâu. Bạn có thể bỏ qua và bắt đầu học luôn.'));
        }, 12000);
      });

      await Promise.race([loginPromise, timeoutPromise]);

      if (loginTimeoutRef.current) {
        clearTimeout(loginTimeoutRef.current);
        loginTimeoutRef.current = null;
      }

      const signedIn = await isPuterSignedIn();
      setPuterAuthState(signedIn ? 'signed-in' : 'signed-out');
      if (!signedIn) {
        setPuterAuthError('Đăng nhập chưa hoàn tất. Bạn vẫn có thể bắt đầu học và hệ thống sẽ dùng API dự phòng.');
      }
    } catch (error: any) {
      if (loginTimeoutRef.current) {
        clearTimeout(loginTimeoutRef.current);
        loginTimeoutRef.current = null;
      }
      setPuterAuthState('signed-out');
      setPuterAuthError(error?.message || 'Không thể đăng nhập Puter lúc này. Bạn vẫn có thể bắt đầu học.');
    }
  };

  useEffect(() => {
    return () => {
      if (loginTimeoutRef.current) {
        clearTimeout(loginTimeoutRef.current);
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (poem.trim() && author.trim()) {
      onSubmit(poem, author);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-xl w-full bg-white rounded-[32px] p-8 md:p-12 shadow-[0px_4px_20px_rgba(0,0,0,0.05)]">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#f5f5f0] mb-6">
            <Feather className="w-8 h-8 text-[#5A5A40]" />
          </div>
          <h1 className="text-4xl md:text-5xl font-serif text-[#2c2c28] mb-3">Mentor Thẩm Mĩ Thơ Ca</h1>
          <p className="text-[#7A7A5A] font-sans font-light">Cùng nhau khám phá vẻ đẹp ẩn giấu sau từng con chữ.</p>
        </div>

        <div className="mb-6 rounded-2xl border border-[#e0e0d8] bg-[#fafaf6] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#2c2c28]">Đăng nhập Puter trước khi bắt đầu</p>
              <p className="text-xs text-[#6f6f52]">Khuyến nghị để dùng giọng đọc ổn định. Nếu lỗi đăng nhập, bạn vẫn có thể học bình thường.</p>
            </div>
            <button
              type="button"
              onClick={handlePuterLogin}
              disabled={puterAuthState === 'loading'}
              className="rounded-full border border-[#5A5A40] px-4 py-2 text-sm font-medium text-[#5A5A40] transition hover:bg-[#5A5A40] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {puterAuthState === 'signed-in' ? '✅ Đã đăng nhập Puter' : puterAuthState === 'loading' ? 'Đang đăng nhập...' : 'Đăng nhập Puter'}
            </button>
          </div>
          {puterAuthError && <p className="mt-2 text-xs text-red-600">{puterAuthError}</p>}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="author" className="block text-sm font-medium text-[#5A5A40] mb-2 uppercase tracking-wider">
              Tên Tác Giả / Bài Thơ
            </label>
            <input
              type="text"
              id="author"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="VD: Quang Dũng - Tây Tiến"
              className="w-full px-4 py-3 rounded-xl border border-[#e0e0d8] bg-[#fafafa] focus:outline-none focus:ring-2 focus:ring-[#5A5A40] focus:border-transparent transition-all font-sans"
              required
            />
          </div>

          <div>
            <label htmlFor="poem" className="block text-sm font-medium text-[#5A5A40] mb-2 uppercase tracking-wider">
              Đoạn Thơ Cần Khám Phá
            </label>
            <textarea
              id="poem"
              value={poem}
              onChange={(e) => setPoem(e.target.value)}
              placeholder="Dốc lên khúc khuỷu dốc thăm thẳm&#10;Heo hút cồn mây súng ngửi trời..."
              rows={6}
              className="w-full px-4 py-3 rounded-xl border border-[#e0e0d8] bg-[#fafafa] focus:outline-none focus:ring-2 focus:ring-[#5A5A40] focus:border-transparent transition-all font-serif text-lg resize-none"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full bg-[#5A5A40] hover:bg-[#4a4a34] text-white rounded-full py-4 px-8 font-medium tracking-wide transition-colors flex items-center justify-center gap-2"
          >
            <BookOpen className="w-5 h-5" />
            Bắt đầu hành trình
          </button>
        </form>
      </div>
    </div>
  );
}
