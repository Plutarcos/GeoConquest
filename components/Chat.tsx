import React, { useState, useEffect, useRef } from 'react';
import { Send, MessageSquare, X, Minimize2, Maximize2 } from 'lucide-react';
import { ChatMessage, Language, Player } from '../types';
import { TRANSLATIONS } from '../constants';

interface ChatProps {
  messages: ChatMessage[];
  player: Player;
  language: Language;
  onSendMessage: (text: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

const Chat: React.FC<ChatProps> = ({ messages, player, language, onSendMessage, isOpen, onClose }) => {
  const [inputText, setInputText] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const t = TRANSLATIONS[language];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen && !isMinimized) {
      scrollToBottom();
    }
  }, [messages, isOpen, isMinimized]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) {
      onSendMessage(inputText.trim());
      setInputText('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed z-[1200] transition-all duration-300 ${
        // Mobile styles
        "bottom-[80px] left-4 right-4 md:left-4 md:right-auto md:w-80 md:bottom-20"
      }`}>
      
      <div className={`bg-panel-bg backdrop-blur-xl border border-neon-blue/40 rounded-xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${isMinimized ? 'h-12' : 'h-80'}`}>
        
        {/* Header */}
        <div className="bg-black/40 p-2 px-3 flex items-center justify-between border-b border-gray-700 cursor-pointer" onClick={() => setIsMinimized(!isMinimized)}>
           <div className="flex items-center gap-2 text-neon-blue font-bold text-sm">
             <MessageSquare size={16} />
             <span>{t.chat}</span>
           </div>
           <div className="flex items-center gap-2">
             <button onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }} className="text-gray-400 hover:text-white">
               {isMinimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
             </button>
             <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="text-gray-400 hover:text-red-400">
               <X size={16} />
             </button>
           </div>
        </div>

        {/* Messages Area */}
        {!isMinimized && (
          <>
            <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
              {messages.length === 0 && (
                <div className="text-gray-500 text-xs text-center italic mt-4 opacity-50">System online. No visible activity.</div>
              )}
              {messages.map((msg) => (
                <div key={msg.id} className={`flex flex-col ${msg.sender === player.username ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[85%] rounded-lg px-3 py-1.5 text-xs ${
                    msg.isSystem 
                      ? 'bg-yellow-500/20 text-yellow-200 border border-yellow-500/30 w-full text-center font-mono' 
                      : msg.sender === player.username 
                        ? 'bg-neon-blue/20 text-white border border-neon-blue/30 rounded-br-none' 
                        : 'bg-gray-700/50 text-gray-200 border border-gray-600 rounded-bl-none'
                  }`}>
                    {!msg.isSystem && msg.sender !== player.username && (
                      <span className="block text-[10px] font-bold text-neon-green mb-0.5">{msg.sender}</span>
                    )}
                    {msg.text}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <form onSubmit={handleSubmit} className="p-2 border-t border-gray-700 bg-black/20 flex gap-2">
              <input 
                type="text" 
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={t.sendMessage}
                className="flex-1 bg-black/50 border border-gray-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-neon-blue font-mono"
              />
              <button 
                type="submit" 
                disabled={!inputText.trim()}
                className="bg-neon-blue/80 hover:bg-neon-blue text-black p-1.5 rounded transition disabled:opacity-50"
              >
                <Send size={14} />
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default Chat;