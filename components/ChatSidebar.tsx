
import React, { useState, useRef, useEffect } from 'react';
import { Send, X, Bot, User, Sparkles } from 'lucide-react';
import { Transaction, FilterState, ChatMessage, DrillDownState } from '../types';
import { sendMessageToGemini } from '../services/gemini';

interface ChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  validTransactions: Transaction[]; // Includes all years/months, excludes hidden categories
  currentFilters: FilterState;
  drillDown: DrillDownState;
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({ isOpen, onClose, validTransactions, currentFilters, drillDown }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'bot', text: 'สวัสดีครับ! ผมคือ AI Assistant ถามข้อมูลการเงินได้เลย (ผมจะวิเคราะห์ข้อมูลตามหน้าจอที่คุณดูอยู่ครับ)' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setInput('');
    setIsLoading(true);

    // Call Gemini with the full dataset + current filter context + drillDown context
    const responseText = await sendMessageToGemini(userMsg, validTransactions, currentFilters, drillDown);
    
    setMessages(prev => [...prev, { role: 'bot', text: responseText }]);
    setIsLoading(false);
  };

  return (
    <div 
      className={`fixed top-0 right-0 w-[380px] h-full bg-white shadow-[-5px_0_15px_rgba(0,0,0,0.1)] z-50 transform transition-transform duration-300 flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
    >
      {/* Header */}
      <div className="bg-[#4A148C] text-white p-5 flex justify-between items-center">
        <div className="font-bold flex items-center gap-2">
          <Bot size={24} /> AI Assistant
        </div>
        <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-full">
          <X size={20} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 bg-[#F8F9FA] flex flex-col gap-4">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div 
              className={`max-w-[85%] p-3 rounded-xl text-sm leading-relaxed shadow-sm whitespace-pre-wrap ${
                msg.role === 'user' 
                  ? 'bg-[#4A148C] text-white rounded-br-none' 
                  : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white p-3 rounded-xl rounded-bl-none border border-gray-200 flex items-center gap-2">
              <Sparkles className="animate-spin text-[#4A148C]" size={16} />
              <span className="text-gray-400 text-xs">AI is analyzing...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-white border-t border-gray-100 flex gap-2">
        <input 
          type="text" 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="ถามคำถาม (e.g., สรุปรายจ่ายตรงนี้, รายการสูงสุดคือ?)..."
          className="flex-1 p-2.5 border border-gray-300 rounded-full text-sm focus:outline-none focus:border-[#4A148C]"
        />
        <button 
          onClick={handleSend}
          disabled={isLoading}
          className="w-10 h-10 bg-[#4A148C] text-white rounded-full flex items-center justify-center hover:bg-[#7c43bd] disabled:bg-gray-300 transition-colors"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
};

export default ChatSidebar;
