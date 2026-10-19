import React, { useState, useRef, useEffect } from 'react';
import { User, Classroom, Assignment } from '../types';
import { ApiService } from '../services/api';
import { 
  Bot, X, Send, Sparkles, RefreshCw, Minimize2, 
  ChevronUp, GraduationCap, BookOpen, Settings, Key, 
  ExternalLink, Check, AlertCircle, Zap
} from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface ChatbotWidgetProps {
  user: User;
  activeClassroom: Classroom | null;
  assignments: Assignment[];
}

export const ChatbotWidget: React.FC<ChatbotWidgetProps> = ({
  user,
  activeClassroom,
  assignments,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Google AI Studio API Key
  const [apiKey, setApiKey] = useState<string>(() => {
    return localStorage.getItem('gemini_api_key') || '';
  });
  const [tempApiKey, setTempApiKey] = useState('');
  const [keySavedToast, setKeySavedToast] = useState(false);

  // Daily Quota (50 queries / day)
  const [quota, setQuota] = useState({
    limit: 50,
    usedToday: 0,
    remaining: 50,
    hasServerKey: false,
  });

  const isTeacher = user.role === 'teacher' || user.role === 'admin';

  const defaultGreeting: ChatMessage = {
    id: 'welcome',
    role: 'assistant',
    content: isTeacher
      ? `👨‍🏫 **สวัสดีครับคุณครู ${user.name}!**\n\nผมคือ **AI ผู้ช่วยสอนและการบ้าน** ขับเคลื่อนด้วย Google Gemini (สิทธิ์ฟรี 50 ครั้ง/วัน)\n- ช่วยคิดโจทย์การบ้านที่สร้างสรรค์\n- ออกแบบเกณฑ์การให้คะแนน (Rubric)\n- ร่างข้อความ Feedback ให้คำแนะนำแก่นักเรียน`
      : `🎓 **สวัสดีครับน้อง ${user.name}!**\n\nพี่คือ **AI ผู้ช่วยการบ้าน** ขับเคลื่อนด้วย Google Gemini (สิทธิ์ฟรี 50 ครั้ง/วัน)\n- ช่วยอธิบายแนวคิดโจทย์ยากๆ ทีละขั้นตอน\n- ช่วยตรวจทานคำตอบหรือเรียบเรียงภาษา\n- แนะนำวิธีคิด สรุปบทเรียนก่อนส่งการบ้าน`,
    timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
  };

  const [messages, setMessages] = useState<ChatMessage[]>([defaultGreeting]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load Quota on open
  const fetchQuota = async () => {
    try {
      const q = await ApiService.getChatQuota();
      setQuota(q);
    } catch (e) {
      console.warn('Could not load AI quota:', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchQuota();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && !isMinimized && !isSettingsOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isMinimized, isSettingsOpen]);

  const handleSaveApiKey = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = tempApiKey.trim();
    setApiKey(cleanKey);
    localStorage.setItem('gemini_api_key', cleanKey);
    setKeySavedToast(true);
    setTimeout(() => {
      setKeySavedToast(false);
      setIsSettingsOpen(false);
    }, 1200);
  };

  const handleClearApiKey = () => {
    setApiKey('');
    setTempApiKey('');
    localStorage.removeItem('gemini_api_key');
  };

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || isLoading) return;

    // Check if key is configured (client key or server key)
    if (!apiKey && !quota.hasServerKey) {
      setIsSettingsOpen(true);
      setTempApiKey('');
      return;
    }

    const userMessage: ChatMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const chatPayload = [
        ...messages.filter((m) => m.id !== 'welcome').map((m) => ({
          role: m.role,
          content: m.content,
        })),
        { role: 'user' as const, content: text },
      ];

      const context = {
        classroom: activeClassroom ? `${activeClassroom.title} (${activeClassroom.subjectCode})` : undefined,
        assignment: assignments.length > 0 ? assignments[0].title : undefined,
      };

      const res = await ApiService.sendChatMessage(chatPayload, context, apiKey);

      if (res.remaining !== undefined) {
        setQuota((prev) => ({
          ...prev,
          limit: res.limit || 50,
          usedToday: res.usedToday || prev.usedToday + 1,
          remaining: res.remaining ?? prev.remaining,
        }));
      }

      if (res.needsKey) {
        setIsSettingsOpen(true);
      }

      const botMessage: ChatMessage = {
        id: `bot-${Date.now()}`,
        role: 'assistant',
        content: res.reply || 'ขออภัยครับ ไม่สามารถสร้างคำตอบได้ในขณะนี้ กรุณาลองใหม่อีกครั้งครับ',
        timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (err: any) {
      const errorMessage: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: '⚠️ เกิดข้อผิดพลาดในการเชื่อมต่อกับ AI กรุณาลองส่งใหม่อีกครั้งนะครับ',
        timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    setMessages([defaultGreeting]);
  };

  const quickPrompts = isTeacher
    ? [
        { label: '✍️ ช่วยคิดโจทย์การบ้าน', text: 'ช่วยเสนอแนวคิดการตั้งโจทย์การบ้านที่น่าสนใจและกระตุ้นความคิดวิเคราะห์ 3 ข้อ' },
        { label: '📋 ออกแบบเกณฑ์ Rubric', text: 'ช่วยแนะนำเกณฑ์การให้คะแนน (Rubric) แบบ 4 ระดับ สำหรับการบ้านวิชานี้หน่อยครับ' },
        { label: '💬 ร่าง Feedback ให้เด็ก', text: 'ช่วยแนะนำตัวอย่างคำติชมและข้อเสนอแนะเชิงบวก (Feedback) สำหรับตรวจงานนักเรียน 3 แบบ' },
      ]
    : [
        { label: '💡 ช่วยอธิบายแนวคิดข้อนี้', text: 'ช่วยอธิบายหลักการและขั้นตอนในการคิดแก้โจทย์แบบเข้าใจง่ายให้หน่อยครับ' },
        { label: '📝 ตรวจทานคำตอบภาษาไทย', text: 'ช่วยตรวจทานการสะกดคำ ไวยากรณ์ และการเรียบเรียงประโยคของข้อความนี้หน่อยครับ: ' },
        { label: '📖 สรุปเทคนิคทำความเข้าใจ', text: 'ช่วยสรุปเทคนิคการทำความเข้าใจเนื้อหาบทเรียนและการบ้านอย่างรวดเร็วให้หน่อยครับ' },
      ];

  const quotaPercent = Math.min(100, Math.round((quota.usedToday / quota.limit) * 100));

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {/* Floating Launcher Button */}
      {!isOpen && (
        <button
          onClick={() => {
            setIsOpen(true);
            setIsMinimized(false);
          }}
          className="group flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white font-bold rounded-2xl shadow-xl hover:shadow-indigo-300 hover:scale-105 active:scale-95 transition-all duration-200 border border-white/20"
          title="เปิด AI ผู้ช่วยการบ้าน (Google AI Studio)"
        >
          <div className="relative">
            <Sparkles className="w-5 h-5 animate-pulse text-amber-300" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-indigo-600"></span>
          </div>
          <div className="flex flex-col text-left">
            <span className="text-sm font-semibold tracking-wide leading-tight">AI ผู้ช่วยการบ้าน</span>
            <span className="text-[10px] text-indigo-100 font-normal">โควตาฟรี 50 ครั้ง/วัน</span>
          </div>
        </button>
      )}

      {/* Floating Chat Window */}
      {isOpen && (
        <div
          className={`bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col transition-all duration-200 overflow-hidden ${
            isMinimized
              ? 'w-72 h-14'
              : 'w-[92vw] sm:w-[440px] h-[600px] max-h-[85vh]'
          }`}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 px-4 py-3 text-white flex items-center justify-between select-none shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center backdrop-blur-xs border border-white/20">
                <Bot className="w-5 h-5 text-amber-300" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-sm leading-tight">AI ผู้ช่วยการบ้าน</h3>
                  <span className="text-[10px] bg-white/20 text-white px-1.5 py-0.2 rounded font-mono">Gemini</span>
                </div>
                <p className="text-[11px] text-indigo-100 flex items-center gap-1">
                  {isTeacher ? (
                    <><GraduationCap className="w-3 h-3"/> โหมดคุณครู</>
                  ) : (
                    <><BookOpen className="w-3 h-3"/> โหมดนักเรียน</>
                  )}
                  {activeClassroom ? ` • ${activeClassroom.title}` : ''}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {!isMinimized && (
                <>
                  <button
                    onClick={() => {
                      setTempApiKey(apiKey);
                      setIsSettingsOpen(!isSettingsOpen);
                    }}
                    className={`p-1.5 rounded-lg transition ${
                      isSettingsOpen || (!apiKey && !quota.hasServerKey)
                        ? 'bg-amber-400 text-slate-900 font-bold'
                        : 'text-indigo-200 hover:text-white hover:bg-white/10'
                    }`}
                    title="ตั้งค่า Google AI Studio API Key"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleClearChat}
                    className="p-1.5 text-indigo-200 hover:text-white hover:bg-white/10 rounded-lg transition"
                    title="ล้างการสนทนา"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </>
              )}
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1.5 text-indigo-200 hover:text-white hover:bg-white/10 rounded-lg transition"
                title={isMinimized ? 'ขยาย' : 'ย่อลง'}
              >
                {isMinimized ? <ChevronUp className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-indigo-200 hover:text-white hover:bg-white/10 rounded-lg transition"
                title="ปิด"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Daily Quota Bar */}
          {!isMinimized && (
            <div className="bg-indigo-50/90 border-b border-indigo-100 px-3.5 py-1.5 flex items-center justify-between text-xs text-indigo-900 shrink-0">
              <div className="flex items-center gap-1.5 font-medium">
                <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                <span>โควตาวันนี้: <strong>{quota.remaining}</strong>/{quota.limit} ครั้ง</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-20 bg-indigo-200/70 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      quota.remaining <= 5 ? 'bg-rose-500' : quota.remaining <= 15 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${100 - quotaPercent}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-500">ฟรี Google Studio</span>
              </div>
            </div>
          )}

          {/* API Key Missing Alert Banner */}
          {!isMinimized && !apiKey && !quota.hasServerKey && !isSettingsOpen && (
            <div
              onClick={() => {
                setTempApiKey('');
                setIsSettingsOpen(true);
              }}
              className="bg-amber-50 border-b border-amber-200 px-3.5 py-2 flex items-center justify-between text-xs text-amber-900 cursor-pointer hover:bg-amber-100 transition shrink-0"
            >
              <div className="flex items-center gap-2">
                <Key className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>ยังไม่ได้ใส่ Google AI Studio API Key (ฟรี 50 ครั้ง/วัน)</span>
              </div>
              <span className="text-[11px] font-bold text-indigo-600 underline shrink-0">ตั้งค่าเลย</span>
            </div>
          )}

          {/* Settings Modal (Overlay) */}
          {!isMinimized && isSettingsOpen && (
            <div className="p-4 bg-slate-50 border-b border-slate-200 shrink-0 text-xs text-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-sm text-slate-800">
                  <Key className="w-4 h-4 text-indigo-600" />
                  <span>ตั้งค่า Google AI Studio API Key</span>
                </div>
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-slate-500 text-[11px] leading-relaxed">
                Google AI Studio ให้ API Key สำหรับ Gemini ใช้งานได้ฟรี โดยระบบนี้จำกัดสิทธิ์ 50 ครั้ง/วันต่อผู้ใช้
              </p>

              <form onSubmit={handleSaveApiKey} className="space-y-2">
                <div className="relative">
                  <input
                    type="password"
                    placeholder="วาง API Key (AIzaSy...)"
                    value={tempApiKey}
                    onChange={(e) => setTempApiKey(e.target.value)}
                    className="w-full pl-3 pr-20 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-hidden font-mono bg-white"
                  />
                  <div className="absolute right-1 top-1 flex items-center gap-1">
                    {apiKey && (
                      <button
                        type="button"
                        onClick={handleClearApiKey}
                        className="px-2 py-1 text-[10px] text-rose-600 hover:bg-rose-50 rounded-lg"
                      >
                        ลบ
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={!tempApiKey.trim()}
                      className="px-2.5 py-1 text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg transition"
                    >
                      บันทึก
                    </button>
                  </div>
                </div>

                {keySavedToast && (
                  <p className="text-emerald-600 text-xs font-semibold flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> บันทึก API Key เรียบร้อยแล้ว!
                  </p>
                )}

                <div className="flex items-center justify-between pt-1 text-[11px]">
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-600 hover:underline flex items-center gap-1 font-semibold"
                  >
                    <span>ขอรับ API Key ฟรีจาก Google AI Studio</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  {apiKey && (
                    <span className="text-emerald-600 font-medium">✓ ตั้งค่าแล้ว</span>
                  )}
                </div>
              </form>
            </div>
          )}

          {/* Chat Body */}
          {!isMinimized && (
            <>
              {/* Messages Scroll Area */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-slate-50/60 text-sm">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      msg.role === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 leading-relaxed shadow-xs ${
                        msg.role === 'user'
                          ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-br-xs'
                          : 'bg-white text-slate-800 border border-slate-200/80 rounded-bl-xs'
                      }`}
                    >
                      <div className="whitespace-pre-line break-words text-xs sm:text-sm">
                        {msg.content}
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 px-1">
                      {msg.timestamp}
                    </span>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex items-center gap-2 text-slate-500 bg-white border border-slate-200 rounded-2xl px-4 py-2.5 w-fit shadow-xs">
                    <Sparkles className="w-4 h-4 text-indigo-500 animate-spin" />
                    <span className="text-xs font-medium">Gemini กำลังประมวลผลคำตอบ...</span>
                    <span className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                      <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                      <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce"></span>
                    </span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Prompt Chips */}
              <div className="px-3 py-2 bg-slate-100/70 border-t border-slate-200 overflow-x-auto flex gap-1.5 no-scrollbar shrink-0">
                {quickPrompts.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(p.text)}
                    disabled={isLoading || quota.remaining <= 0}
                    className="shrink-0 text-[11px] font-medium bg-white hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 border border-slate-200 px-2.5 py-1 rounded-full transition-colors active:scale-95 disabled:opacity-50"
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Input Area */}
              <div className="p-3 bg-white border-t border-slate-200 shrink-0">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSend();
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={
                      quota.remaining <= 0
                        ? 'โควตาวันนี้ครบ 50 ครั้งแล้ว (รีเซ็ตวันพรุ่งนี้)'
                        : isTeacher
                        ? 'ถาม AI: ช่วยคิดโจทย์, เกณฑ์คะแนน หรือ feedback...'
                        : 'ถาม AI: ให้ช่วยอธิบายโจทย์ หรือตรวจงาน...'
                    }
                    disabled={isLoading || quota.remaining <= 0}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || isLoading || quota.remaining <= 0}
                    className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md shadow-indigo-100 disabled:opacity-40 disabled:cursor-not-allowed transition active:scale-95 shrink-0"
                    title="ส่งข้อความ"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
                <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1.5 px-0.5">
                  <span>💡 ขับเคลื่อนด้วย Google Gemini API</span>
                  <span>รีเซ็ตโควตา 00:00 น.</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
