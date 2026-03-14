/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { PoemInput } from './components/PoemInput';
import { ChatInterface } from './components/ChatInterface';

type AppErrorBoundaryState = {
  hasError: boolean;
  errorMessage: string;
};

class AppErrorBoundary extends React.Component<React.PropsWithChildren, AppErrorBoundaryState> {
  constructor(props: React.PropsWithChildren) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
    };
    this.handleReset = this.handleReset.bind(this);
  }
  state: AppErrorBoundaryState = {
    hasError: false,
    errorMessage: '',
  };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Đã xảy ra lỗi không mong muốn.',
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('App render error boundary caught:', error, errorInfo);
  }

  handleReset() {
    this.setState({ hasError: false, errorMessage: '' });
  }
  private handleReset = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#f5f5f0] flex items-center justify-center p-6">
          <div className="max-w-lg w-full rounded-3xl bg-white border border-[#e0e0d8] shadow-sm p-8 text-center">
            <h1 className="text-2xl font-serif text-[#2c2c28] mb-3">Đã có lỗi hiển thị</h1>
            <p className="text-sm text-[#5A5A40] mb-2">
              Mình vừa chặn được lỗi để tránh màn hình trắng. Bạn bấm thử nút bên dưới để tải lại giao diện.
            </p>
            <p className="text-xs text-[#7A7A5A] mb-6 break-words">Chi tiết: {this.state.errorMessage}</p>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={this.handleReset}
                className="rounded-full bg-[#5A5A40] px-5 py-2 text-sm font-medium text-white hover:bg-[#4a4a34]"
              >
                Thử lại
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-full border border-[#5A5A40] px-5 py-2 text-sm font-medium text-[#5A5A40] hover:bg-[#f5f5f0]"
              >
                Tải lại trang
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  const [step, setStep] = useState<'input' | 'chat'>('input');
  const [poemData, setPoemData] = useState({ poem: '', author: '' });

  const handleStart = (poem: string, author: string) => {
    setPoemData({ poem, author });
    setStep('chat');
  };

  const handleBack = () => {
    setStep('input');
    setPoemData({ poem: '', author: '' });
  };

  return (
    <AppErrorBoundary>
      <div className="min-h-screen bg-[#f5f5f0]">
        {step === 'input' ? (
          <PoemInput onSubmit={handleStart} />
        ) : (
          <ChatInterface
            poem={poemData.poem}
            author={poemData.author}
            onBack={handleBack}
          />
        )}
      </div>
    </AppErrorBoundary>
  );
}
