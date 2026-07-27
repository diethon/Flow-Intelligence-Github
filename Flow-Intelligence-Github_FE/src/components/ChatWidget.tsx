import React, { useState, useRef, useEffect } from 'react';
import { chatApi, type ChatMessageData } from '../services/api/chatApi';
import { ChatMessage } from './ChatMessage';


const SUGGESTED_QUESTIONS = [
  "Which PR has been open the longest?",
  "Who is the most overloaded reviewer?",
  "What is the CI failure rate this week?"
];

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);


  const [repoId, setRepoId] = useState(() => localStorage.getItem("selectedRepositoryId") || "");

  useEffect(() => {
    const handleStorageChange = () => {
      const newRepoId = localStorage.getItem("selectedRepositoryId") || "";
      if (newRepoId !== repoId) {
        setRepoId(newRepoId);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    const intervalId = setInterval(handleStorageChange, 1000);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(intervalId);
    };
  }, [repoId]);

  // Let's redefine message state to include sources and error state.
  const [chatHistory, setChatHistory] = useState<Array<ChatMessageData & { sourceIds?: string[], isError?: boolean }>>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!repoId) {
      setChatHistory([]);
      return;
    }
    const savedHistory = localStorage.getItem(`chatHistory_${repoId}`);
    if (savedHistory) {
      try {
        setChatHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to parse saved chat history:", e);
        setChatHistory([]);
      }
    } else {
      setChatHistory([]);
    }
  }, [repoId]);

  useEffect(() => {
    if (repoId && chatHistory.length > 0) {
      localStorage.setItem(`chatHistory_${repoId}`, JSON.stringify(chatHistory));
    }
  }, [chatHistory, repoId]);

  useEffect(() => {
    // Scroll to bottom when history changes
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, isLoading]);

  const toggleOpen = () => setIsOpen(!isOpen);

  const handleSend = async (text: string) => {
    if (!text.trim() || !repoId) return;

    const newMsg: ChatMessageData = { role: 'user', content: text };
    
    // Optimistic UI update
    const updatedHistory = [...chatHistory, newMsg];
    
    // Keep max 20 messages (10 turns) for API history
    const apiHistory = updatedHistory.slice(-20);
    
    setChatHistory(updatedHistory);
    setInputValue("");
    setIsLoading(true);

    try {
      // Exclude error/sourceIds metadata from what we send to the API
      const historyForApi = apiHistory.slice(0, -1).map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      const response = await chatApi.chatWithData(repoId, text, historyForApi);
      
      setChatHistory(prev => [
        ...prev,
        { role: 'assistant', content: response.reply, sourceIds: response.sourceIds }
      ]);
    } catch (error) {
      console.error("Chat error:", error);
      setChatHistory(prev => [
        ...prev,
        { role: 'assistant', content: "Something went wrong. Please try again.", isError: true }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSend(inputValue);
    }
  };

  const handleClearChat = () => {
    setChatHistory([]);
    if (repoId) {
      localStorage.removeItem(`chatHistory_${repoId}`);
    }
  };

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={toggleOpen}
          className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full shadow-[0_8px_30px_rgb(79,70,229,0.3)] hover:shadow-[0_8px_30px_rgb(79,70,229,0.5)] hover:scale-105 transition-all duration-300 flex items-center justify-center text-white z-50 focus:outline-none focus:ring-4 focus:ring-indigo-500/30 group"
          title="Chat with your data"
        >
          <svg className="w-6 h-6 transform group-hover:-translate-y-0.5 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </button>
      )}

      {isOpen && (
        <div className="fixed bottom-6 right-6 w-[380px] h-[560px] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200/60 z-50 animate-in slide-in-from-bottom-5 fade-in duration-200">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-4 flex items-center justify-between shadow-sm z-10 rounded-t-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
            <div className="flex items-center gap-3 relative z-10">
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white backdrop-blur-sm shadow-inner border border-white/10">
                <span className="text-[17px]">✨</span>
              </div>
              <div>
                <h3 className="font-bold text-white text-[15px] leading-tight">Flow Intelligence</h3>
                <p className="text-blue-100 text-[10px] font-bold tracking-widest uppercase mt-0.5 opacity-90">Powered by Gemini</p>
              </div>
            </div>
            <div className="flex items-center gap-1 relative z-10">
              <button onClick={handleClearChat} title="Clear chat history" className="text-white/70 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
              <button onClick={toggleOpen} className="text-white/70 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-5 bg-slate-50/50">
            {chatHistory.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-6 animate-in fade-in duration-300">
                <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center rotate-12 shadow-sm">
                  <span className="text-3xl rotate-[-12deg]">✨</span>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-800">How can I help you?</h4>
                  <p className="text-sm text-slate-500 mt-1 max-w-[240px]">Ask me anything about this repository's metrics, PRs, or alerts.</p>
                </div>
                <div className="w-full flex flex-col gap-2 pt-2">
                  {SUGGESTED_QUESTIONS.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => handleSend(q)}
                      className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-600 hover:border-blue-300 hover:text-blue-600 hover:shadow-sm transition-all text-left truncate"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {chatHistory.map((msg, idx) => (
              <ChatMessage
                key={idx}
                role={msg.role}
                content={msg.content}
                sourceIds={msg.sourceIds}
                isError={msg.isError}
              />
            ))}
            
            {isLoading && (
              <ChatMessage role="assistant" content="" isLoading={true} />
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-white border-t border-slate-100 relative">
            {showSuggestions && (
              <div className="absolute bottom-[calc(100%+8px)] left-4 right-4 bg-white border border-slate-200 shadow-xl rounded-xl z-20 animate-in slide-in-from-bottom-2 fade-in overflow-hidden">
                <div className="bg-slate-50 px-4 py-2 border-b border-slate-100 flex justify-between items-center">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Suggested Questions</span>
                  <button onClick={() => setShowSuggestions(false)} className="text-slate-400 hover:text-slate-700 transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="p-2 flex flex-col gap-1">
                  {SUGGESTED_QUESTIONS.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => { handleSend(q); setShowSuggestions(false); }}
                      className="px-3 py-2.5 text-left text-sm text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-colors truncate"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            <div className="relative flex items-center gap-1.5 bg-white border border-slate-200 rounded-full p-1.5 shadow-sm hover:shadow-md transition-shadow">
              <button
                onClick={() => setShowSuggestions(!showSuggestions)}
                title="Suggested Questions"
                className="w-8 h-8 rounded-[10px] bg-[#5a55e9] hover:bg-[#4b47cc] text-white flex items-center justify-center transition-colors shrink-0"
              >
                <span className="text-[15px] leading-none mb-0.5">✨</span>
              </button>
              
              <div className="relative flex-1 flex items-center">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about open PRs, velocity,"
                  className="w-full bg-transparent border-none text-[13px] text-slate-700 focus:outline-none focus:ring-0 placeholder:text-slate-400 py-1.5 px-2"
                  maxLength={500}
                  disabled={isLoading}
                />
              </div>

              <button
                disabled={true}
                className="p-1.5 text-slate-400 opacity-60 cursor-not-allowed shrink-0"
                title="Attach file (coming soon)"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </button>
              
              <button
                onClick={() => handleSend(inputValue)}
                disabled={isLoading || !inputValue.trim()}
                className="w-8 h-8 rounded-full bg-[#5a55e9] hover:bg-[#4b47cc] disabled:bg-slate-200 disabled:text-slate-400 text-white flex items-center justify-center transition-colors shrink-0"
              >
                <svg className="w-[15px] h-[15px] ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </button>
            </div>
            
            <div className="text-center mt-2.5">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Gemini may produce inaccurate information</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
