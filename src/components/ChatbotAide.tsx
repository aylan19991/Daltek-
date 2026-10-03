import React, { useState, useEffect, useRef } from 'react';
import { sendChatMessage } from '../utils/api';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
}

interface ChatbotAideProps {
  isOpen: boolean;
  onClose: () => void;
}

const SUGGESTIONS = [
  'Comment fonctionne DALTEK ?',
  'Comment suivre mon ticket ?',
  'Est-ce que je peux créer un ticket en tant que client ?',
  'Comment utiliser le QR code ?',
  'Que se passe-t-il lorsque c\'est mon tour ?',
  'Comment fonctionne l\'espace Staff ?',
  'Comment fonctionne l\'écran TV ?',
  'Comment installer DALTEK sur Android ?',
  'Comment créer un établissement ?',
  'Comment importer un symbole/logo ?',
];

export const ChatbotAide: React.FC<ChatbotAideProps> = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      text: "Bonjour ! Je suis l'assistant officiel DALTEK. Je suis là pour vous expliquer simplement et clairement le fonctionnement de la file d'attente, du suivi de ticket, de l'espace Staff et de l'écran TV. Comment puis-je vous aider aujourd'hui ?",
      timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isLoading]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text,
      timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);

    try {
      const history = messages
        .filter((m) => !m.id.startsWith('welcome') && !m.id.startsWith('err'))
        .slice(-8)
        .map((m) => ({ role: m.role, text: m.text }));

      const reply = await sendChatMessage(text, history);

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        role: 'model',
        text: reply,
        timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      console.error('Chat error:', err);
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'model',
        text: "Pour rappel : sur DALTEK, le client suit son ticket en temps réel via le QR code sans créer de compte, et le personnel gère les appels depuis l'espace Staff avec son Code Staff.",
        timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  const handleReset = () => {
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'model',
        text: "Conversation réinitialisée. N'hésitez pas à poser une nouvelle question sur l'utilisation de DALTEK !",
        timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  return (
    <div className="fixed inset-0 z-50 pointer-events-none flex items-end justify-end p-3 sm:p-6 animate-fadeIn font-['Outfit']">
      {/* Mobile Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/50 backdrop-blur-xs sm:hidden pointer-events-auto"
      />

      {/* Chat Window Container */}
      <div className="pointer-events-auto relative w-full sm:w-[420px] max-h-[85vh] sm:max-h-[620px] h-[580px] bg-[#14171d] border border-[#f2ca50]/40 rounded-2xl sm:rounded-3xl shadow-[0_12px_45px_rgba(0,0,0,0.65)] flex flex-col overflow-hidden animate-scaleUp">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#1b1f27] via-[#1e232d] to-[#1b1f27] border-b border-white/10 px-4 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative w-9 h-9 rounded-xl bg-[#f2ca50]/15 border border-[#f2ca50]/30 flex items-center justify-center text-[#f2ca50] shadow-inner">
              <span className="material-symbols-outlined text-[20px]">smart_toy</span>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#14171d] animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-['Syne'] text-sm font-bold text-white leading-none">
                  Aide DALTEK
                </h3>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#f2ca50]/20 text-[#f2ca50] font-['JetBrains_Mono'] font-bold">
                  IA
                </span>
              </div>
              <p className="text-[11px] text-[#a0a6b5] mt-0.5 leading-none">
                Assistant explicatif & guide d'utilisation
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleReset}
              className="p-1.5 rounded-lg text-[#a0a6b5] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              title="Réinitialiser la conversation"
            >
              <span className="material-symbols-outlined text-[18px]">refresh</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#a0a6b5] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              title="Fermer la fenêtre d'aide"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* Message Thread */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-[#0e1116]/80 text-xs">
          {messages.map((m) => {
            const isUser = m.role === 'user';
            return (
              <div
                key={m.id}
                className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'} animate-fadeIn`}
              >
                {!isUser && (
                  <div className="w-7 h-7 rounded-lg bg-[#1b1f27] border border-[#f2ca50]/30 flex items-center justify-center text-[#f2ca50] shrink-0 mt-0.5">
                    <span className="material-symbols-outlined text-[15px]">smart_toy</span>
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 leading-relaxed shadow-md ${
                    isUser
                      ? 'bg-[#f2ca50] text-[#3c2f00] font-medium rounded-br-xs'
                      : 'bg-[#181b22] text-[#e0e3eb] border border-white/10 rounded-bl-xs'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{m.text}</div>
                  <div
                    className={`text-[9px] mt-1 text-right ${
                      isUser ? 'text-[#3c2f00]/70' : 'text-[#a0a6b5]'
                    }`}
                  >
                    {m.timestamp}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Typing Indicator */}
          {isLoading && (
            <div className="flex gap-2.5 justify-start animate-fadeIn">
              <div className="w-7 h-7 rounded-lg bg-[#1b1f27] border border-[#f2ca50]/30 flex items-center justify-center text-[#f2ca50] shrink-0">
                <span className="material-symbols-outlined text-[15px]">smart_toy</span>
              </div>
              <div className="bg-[#181b22] border border-white/10 rounded-2xl rounded-bl-xs px-3.5 py-2.5 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#f2ca50] animate-bounce" />
                <span
                  className="w-2 h-2 rounded-full bg-[#f2ca50] animate-bounce"
                  style={{ animationDelay: '0.15s' }}
                />
                <span
                  className="w-2 h-2 rounded-full bg-[#f2ca50] animate-bounce"
                  style={{ animationDelay: '0.3s' }}
                />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggestion Chips */}
        <div className="bg-[#14171d] border-t border-white/5 px-3 py-2 shrink-0">
          <div className="text-[10px] text-[#a0a6b5] mb-1.5 flex items-center gap-1">
            <span className="material-symbols-outlined text-[12px] text-[#f2ca50]">tips_and_updates</span>
            <span>Questions fréquentes :</span>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                disabled={isLoading}
                onClick={() => handleSend(s)}
                className="whitespace-nowrap px-2.5 py-1 rounded-full bg-[#1b1f27] hover:bg-[#252a35] active:bg-[#f2ca50]/20 border border-white/10 hover:border-[#f2ca50]/40 text-[#d0c5af] text-[11px] transition-colors cursor-pointer shrink-0 disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Input Bar */}
        <div className="p-3 bg-[#171a21] border-t border-white/10 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              placeholder="Posez une question sur DALTEK..."
              className="flex-1 bg-[#101318] border border-white/10 focus:border-[#f2ca50] rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none transition-colors"
            />
            <button
              type="submit"
              disabled={isLoading || !inputValue.trim()}
              className="w-9 h-9 rounded-xl bg-[#f2ca50] hover:bg-[#ffe088] active:bg-[#d4af37] text-[#3c2f00] flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 shrink-0 shadow"
              title="Envoyer la question"
            >
              <span className="material-symbols-outlined text-[18px]">send</span>
            </button>
          </form>
          <div className="text-[10px] text-gray-500 text-center mt-1.5 font-['JetBrains_Mono']">
            Assistant explicatif • Aucun code secret n'est révélé
          </div>
        </div>
      </div>
    </div>
  );
};
