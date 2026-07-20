import React from 'react';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  sourceIds?: string[];
  isLoading?: boolean;
  isError?: boolean;
}

export function ChatMessage({ role, content, sourceIds = [], isLoading = false, isError = false }: ChatMessageProps) {
  const isUser = role === 'user';

  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} mb-5 group`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white flex-shrink-0 mr-3 mt-1 shadow-sm shadow-indigo-200">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
      )}

      <div
        className={`relative max-w-[80%] px-4 py-3 rounded-2xl text-[13px] leading-relaxed shadow-sm transition-all ${
          isUser
            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-tr-sm shadow-blue-500/20'
            : isError
            ? 'bg-rose-50 text-rose-700 border border-rose-100 rounded-tl-sm'
            : 'bg-white text-slate-700 border border-slate-100 rounded-tl-sm shadow-slate-200/50'
        }`}
      >
        {isLoading ? (
          <div className="flex items-center gap-1.5 h-5">
            <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
            <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
            <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></div>
          </div>
        ) : (
          <div className="whitespace-pre-wrap">{content}</div>
        )}


      </div>

      {isUser && (
        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 flex-shrink-0 ml-3 mt-1 shadow-sm border border-slate-300">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
      )}
    </div>
  );
}
