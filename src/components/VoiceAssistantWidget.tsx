import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Send, 
  Bot, 
  Sparkles, 
  User, 
  Languages, 
  ChevronDown
} from 'lucide-react';
import type { LandRecordDocument } from '../types/landRecord';
import { answerLandRecordQuery, type AssistantResponse } from '../utils/voiceAssistantEngine';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  spokenText?: string;
  metrics?: Array<{ label: string; value: string }>;
  suggestedQuestions?: string[];
  timestamp: string;
}

interface VoiceAssistantWidgetProps {
  record: LandRecordDocument;
}

export const VoiceAssistantWidget: React.FC<VoiceAssistantWidgetProps> = ({ record }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [lang, setLang] = useState<'hi' | 'en'>('hi');
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [inputText, setInputText] = useState<string>('');
  const [isThinking, setIsThinking] = useState<boolean>(false);

  // Initial welcome message
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'msg-welcome',
      sender: 'assistant',
      text: lang === 'hi' 
        ? `नमस्ते! मैं आपका भू-मित्र AI सहायक हूँ। इस ज़मीन (खाता: ${record.khataNumber.value}, गाटा: ${record.plots[0]?.khasraNumber.value || '861'}) के बारे में आप कुछ भी पूछ सकते हैं:\n\n• मालिक कौन हैं?\n• किसका कितना हिस्सा / रकबा है?\n• क्या कोई बैंक लोन या बंधक है?`
        : `Hello! I am Bhoo-Mitra AI Assistant. Ask me anything about this land record (Khata: ${record.khataNumber.value}, Plot: ${record.plots[0]?.khasraNumber.value || '861'}):\n\n• Who is the owner?\n• What amount of land is in his part?\n• Is there any active bank loan?`,
      timestamp: 'अभी (Now)',
      suggestedQuestions: lang === 'hi'
        ? ['इस ज़मीन का मालिक कौन है?', 'किसका कितना हिस्सा है?', 'क्या कोई बैंक लोन है?']
        : ['Who is the owner of this land?', 'What amount of land is in his part?', 'Is there any active bank loan?']
    }
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  // Cancel speech on unmount
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  // Update welcome message when language changes
  useEffect(() => {
    setMessages((prev) => {
      if (prev.length === 1 && prev[0].id === 'msg-welcome') {
        return [
          {
            id: 'msg-welcome',
            sender: 'assistant',
            text: lang === 'hi'
              ? `नमस्ते! मैं आपका भू-मित्र AI सहायक हूँ। इस ज़मीन (खाता: ${record.khataNumber.value}) के बारे में पूछें:\n\n• मालिक कौन हैं?\n• किसका कितना हिस्सा / रकबा है?\n• क्या कोई बैंक लोन है?`
              : `Hello! I am Bhoo-Mitra AI Assistant. Ask me about this land (Khata: ${record.khataNumber.value}):\n\n• Who is the owner?\n• What amount of land is in his part?\n• Is there any bank loan?`,
            timestamp: 'Now',
            suggestedQuestions: lang === 'hi'
              ? ['इस ज़मीन का मालिक कौन है?', 'किसका कितना हिस्सा है?', 'क्या कोई बैंक लोन है?']
              : ['Who is the owner of this land?', 'What amount of land is in his part?', 'Is there any bank loan?']
          }
        ];
      }
      return prev;
    });
  }, [lang, record]);

  // Text to Speech Narrator
  const speakText = (text: string, targetLang: 'hi' | 'en' = lang) => {
    if (!('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = targetLang === 'hi' ? 'hi-IN' : 'en-IN';
    utterance.rate = 0.93; // Calm, respectful Indian pace

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  };

  // Process a question through the AI Assistant Engine
  const handleAskQuestion = async (queryText: string) => {
    if (!queryText.trim()) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: queryText.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setIsThinking(true);

    // Answers come from the record only (see utils/voiceAssistantEngine.ts).
    const finalAnswer: AssistantResponse = answerLandRecordQuery(queryText, record, lang);

    setIsThinking(false);

    const assistantMsg: Message = {
      id: `ai-${Date.now()}`,
      sender: 'assistant',
      text: finalAnswer.displayText,
      spokenText: finalAnswer.spokenText,
      metrics: finalAnswer.metrics,
      suggestedQuestions: finalAnswer.suggestedQuestions,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, assistantMsg]);

    // Speak aloud automatically
    speakText(finalAnswer.spokenText, lang);
  };

  // Toggle Microphone Speech Recognition
  const toggleSpeechRecognition = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.');
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
      recognition.continuous = false;
      recognition.interimResults = false;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setIsListening(false);
        if (transcript) {
          handleAskQuestion(transcript);
        }
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
      recognitionRef.current = recognition;
      setIsListening(true);
    } catch {
      setIsListening(false);
    }
  };

  return (
    <>
      {/* 1. FLOATING ACTION TRIGGER BUTTON (Bottom-Right) */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-40 flex items-center gap-3 animate-fade-in">
          {/* Conversational Pill Prompt */}
          <button
            onClick={() => setIsOpen(true)}
            className="hidden sm:flex items-center gap-2 bg-white/95 text-slate-800 text-xs font-semibold px-3.5 py-2 rounded-full shadow-lg border border-emerald-200 hover:border-emerald-400 transition-all cursor-pointer backdrop-blur-xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-600 animate-spin" style={{ animationDuration: '6s' }} />
            <span>पूछें: <em>"मालिक कौन है?"</em> या <em>"किसका कितना हिस्सा है?"</em></span>
          </button>

          {/* Glowing Circular Assistant Button */}
          <button
            onClick={() => setIsOpen(true)}
            aria-label="Open Bhoo-Mitra AI Assistant"
            className="w-14 h-14 rounded-full bg-gradient-to-tr from-emerald-700 via-teal-700 to-emerald-600 text-white flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all relative cursor-pointer ring-4 ring-emerald-500/20"
          >
            <Bot className="w-7 h-7" />
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-400 border-2 border-white animate-pulse" />
          </button>
        </div>
      )}

      {/* 2. SLIDE-UP ASSISTANT DRAWER / DIALOG */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-[92vw] sm:w-[420px] max-h-[640px] h-[85vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-6 duration-300">
          
          {/* Drawer Header */}
          <div className="bg-gradient-to-r from-emerald-800 to-teal-900 text-white p-4 flex items-center justify-between shrink-0 shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-xs border border-white/20">
                <Bot className="w-5 h-5 text-emerald-300" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-bold tracking-tight">भू-मित्र AI (Bhoo-Mitra)</h3>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                </div>
                <p className="text-[11px] text-emerald-200/90">
                  {lang === 'hi' ? 'नागरिक एवं राजस्व वॉइस सहायक' : 'Citizen & Revenue Voice AI'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Language Switch */}
              <button
                onClick={() => setLang(lang === 'hi' ? 'en' : 'hi')}
                className="px-2 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer border border-white/20"
                title="Switch Language (हिन्दी / English)"
              >
                <Languages className="w-3 h-3" />
                <span>{lang === 'hi' ? 'हिन्दी' : 'English'}</span>
              </button>

              {/* Stop Voice Audio if playing */}
              {isSpeaking && (
                <button
                  onClick={stopSpeaking}
                  className="p-1.5 rounded-lg bg-amber-400 text-slate-900 hover:bg-amber-300 transition-colors cursor-pointer animate-pulse"
                  title="आवाज रोकें (Stop audio)"
                >
                  <VolumeX className="w-4 h-4" />
                </button>
              )}

              {/* Minimize / Close */}
              <button
                onClick={() => {
                  stopSpeaking();
                  setIsOpen(false);
                }}
                className="p-1.5 rounded-lg hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
                title="Close"
              >
                <ChevronDown className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Listening Live Waveform Banner */}
          {isListening && (
            <div className="bg-red-50 border-b border-red-200 px-4 py-2.5 flex items-center justify-between text-xs text-red-900 animate-pulse">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-600 animate-ping" />
                <span className="font-semibold">
                  {lang === 'hi' ? 'सुन रहा हूँ... अपना प्रश्न बोलें:' : 'Listening... speak your question:'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-1 h-3 bg-red-600 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1 h-5 bg-red-600 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1 h-2 bg-red-600 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}

          {/* Quick-Tap Question Chips Bar */}
          <div className="bg-slate-50 border-b border-slate-200 p-2.5 overflow-x-auto flex items-center gap-1.5 shrink-0 scrollbar-none">
            {(lang === 'hi' ? [
              'इस ज़मीन का मालिक कौन है?',
              'किसका कितना हिस्सा है?',
              'राजेश यादव का कितना रकबा है?',
              'क्या कोई बैंक लोन है?',
              'क्या इसे बेचा जा सकता है?'
            ] : [
              'Who is the owner of this land?',
              'What amount of land is in his part?',
              'How much does Rajesh own?',
              'Is there any active bank loan?',
              'Can this land be sold?'
            ]).map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleAskQuestion(q)}
                className="whitespace-nowrap bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-900 border border-slate-200 hover:border-emerald-300 text-[11px] font-medium px-2.5 py-1 rounded-full shadow-2xs transition-all cursor-pointer shrink-0"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Scrollable Conversation Thread */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/60 text-xs">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'assistant' && (
                  <div className="w-7 h-7 rounded-lg bg-emerald-700 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl p-3.5 shadow-xs leading-relaxed space-y-2 ${
                    msg.sender === 'user'
                      ? 'bg-emerald-700 text-white rounded-br-xs'
                      : 'bg-white text-slate-800 border border-slate-200/80 rounded-bl-xs'
                  }`}
                >
                  {/* Message Text with simple linebreaks */}
                  <div className="whitespace-pre-line text-xs">
                    {msg.text}
                  </div>

                  {/* Highlight Metrics Badges */}
                  {msg.metrics && msg.metrics.length > 0 && (
                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                      {msg.metrics.map((m, mIdx) => (
                        <div key={mIdx} className="bg-emerald-50/80 border border-emerald-200 p-1.5 rounded-lg text-[11px]">
                          <span className="text-slate-500 block text-[10px]">{m.label}</span>
                          <span className="font-bold text-emerald-950 font-mono">{m.value}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Footer with Timestamp & Replay Audio Button */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px] text-slate-400">
                    <span>{msg.timestamp}</span>
                    {msg.spokenText && (
                      <button
                        onClick={() => speakText(msg.spokenText!, lang)}
                        className="text-emerald-700 hover:text-emerald-800 flex items-center gap-1 font-semibold cursor-pointer"
                        title="बोलकर दोबारा सुनाएं (Replay Voice)"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>सुनाएं</span>
                      </button>
                    )}
                  </div>
                </div>

                {msg.sender === 'user' && (
                  <div className="w-7 h-7 rounded-lg bg-slate-800 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}

            {isThinking && (
              <div className="flex items-center gap-2 text-slate-500 italic text-xs pl-9">
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-bounce" />
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-bounce" style={{ animationDelay: '300ms' }} />
                <span>{lang === 'hi' ? 'उत्तर तैयार कर रहा हूँ...' : 'Calculating verified answer...'}</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Bottom Input Area with Microphone and Text */}
          <div className="p-3 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0">
            {/* Tactile Microphone Button */}
            <button
              onClick={toggleSpeechRecognition}
              aria-label={isListening ? 'Stop listening' : 'Start voice query'}
              className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all cursor-pointer shadow-sm ${
                isListening
                  ? 'bg-red-600 text-white animate-pulse ring-4 ring-red-300'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300'
              }`}
              title={isListening ? 'रोकें (Stop listening)' : 'बोलकर पूछें (Tap to Speak)'}
            >
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5 text-emerald-700" />}
            </button>

            {/* Text Input Fallback */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAskQuestion(inputText);
              }}
              className="flex-1 flex items-center gap-1.5 bg-slate-100 rounded-xl px-3 py-1.5 border border-slate-200 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20"
            >
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={lang === 'hi' ? 'माइक दबाएं या सवाल लिखें...' : 'Ask by voice or type here...'}
                className="w-full bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="text-emerald-700 disabled:text-slate-300 p-1 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
