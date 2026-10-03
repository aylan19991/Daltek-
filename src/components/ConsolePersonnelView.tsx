import React, { useState, useEffect, useRef } from 'react';
import { QueueTicket, Establishment, OperatorAccount, TabType } from '../types';
import {
  playLuxuryChime,
  announceTicketCall,
  isVoiceEnabled,
  setVoiceEnabled,
  unlockAudioSystem,
} from '../utils/audio';
import { addTicket, callTicket, dismissCall, removeTicket } from '../utils/api';

interface ConsolePersonnelViewProps {
  establishment: Establishment;
  operator: OperatorAccount | null;
  queue: QueueTicket[];
  setQueue: React.Dispatch<React.SetStateAction<QueueTicket[]>>;
  activeCalledTicket: QueueTicket | null;
  setActiveCalledTicket: (ticket: QueueTicket | null) => void;
  isOnline: boolean;
  setIsOnline: (online: boolean) => void;
  onNavigate: (tab: TabType) => void;
  onShowToast: (msg: string) => void;
}

export const ConsolePersonnelView: React.FC<ConsolePersonnelViewProps> = ({
  establishment,
  operator,
  queue,
  setQueue,
  activeCalledTicket,
  setActiveCalledTicket,
  isOnline,
  setIsOnline,
  onNavigate,
  onShowToast,
}) => {
  // CRITICAL REQUIREMENT: Ticket input starts strictly EMPTY (NEVER prefilled with 14)!
  const [currentInput, setCurrentInput] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [voiceActive, setVoiceActive] = useState<boolean>(() => isVoiceEnabled());

  const handleToggleVoice = () => {
    const next = !voiceActive;
    setVoiceActive(next);
    setVoiceEnabled(next);
    if (next) {
      unlockAudioSystem();
      onShowToast('🔊 Annonces vocales activées');
      playLuxuryChime();
    } else {
      onShowToast('🔇 Annonces vocales désactivées');
    }
  };

  // Submit Ticket to Server (Strict FIFO)
  const submitTicket = async (overrideVal?: string) => {
    const val = (overrideVal !== undefined ? overrideVal : currentInput).trim();
    if (!val) return;

    const num = parseInt(val, 10);
    if (isNaN(num) || num < 1 || num > 999) {
      onShowToast('Numéro de ticket invalide (1 à 999)');
      setCurrentInput('');
      return;
    }

    if (!isOnline) {
      onShowToast('Connexion requise pour injecter un ticket');
      return;
    }

    // Clear input immediately
    setCurrentInput('');
    setIsSubmitting(true);
    try {
      const deskName = operator?.assignedDesk || 'Guichet 1';
      const res = await addTicket(establishment.id, num, 'Standard', deskName);
      setQueue(res.queue);
      onShowToast(`Ticket #${num} injecté dans la file (${res.queue.length} en attente)`);
    } catch (err: any) {
      onShowToast(err.message || `Le ticket ${num} est déjà dans la file.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Requirement 8: Après 5 secondes sans modification, validation automatique
  useEffect(() => {
    const val = currentInput.trim();
    if (!val) return;
    const timer = setTimeout(() => {
      submitTicket(val);
    }, 5000);
    return () => clearTimeout(timer);
  }, [currentInput]);

  // Global Keyboard listener: 0..9, Backspace, Delete, Escape, Enter, Space
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is inside a form input/textarea elsewhere
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      // Max 3 digits (1..999)
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        setCurrentInput((prev) => {
          if (prev.length >= 3) return prev;
          return prev + e.key;
        });
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        setCurrentInput((prev) => prev.slice(0, -1));
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setCurrentInput('');
      } else if (e.key === 'Enter') {
        e.preventDefault();
        submitTicket(currentInput);
      } else if (e.code === 'Space') {
        e.preventDefault();
        if (currentInput.trim()) {
          handleCallTicket(parseInt(currentInput.trim(), 10));
        } else if (queue.length > 0) {
          handleCallTicket(queue[0].id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentInput, queue, isOnline, establishment?.id]);

  // Virtual Keypad handlers (strictly maximum 3 digits)
  const handleDigit = (digit: string) => {
    setCurrentInput((prev) => {
      if (prev.length >= 3) return prev;
      return prev + digit;
    });
  };

  const handleBackspace = () => {
    setCurrentInput((prev) => prev.slice(0, -1));
  };

  // Calling Ticket (Calls Server API & Realtime broadcast)
  const handleCallTicket = async (ticketId?: number) => {
    if (!isOnline) {
      onShowToast('Action impossible hors-ligne');
      return;
    }

    try {
      if ('vibrate' in navigator) {
        navigator.vibrate([150, 80, 150]);
      }

      const deskName = operator?.assignedDesk || 'Guichet 1';
      const res = await callTicket(establishment.id, ticketId, deskName);
      setActiveCalledTicket(res.calledTicket);
      setQueue(res.queue);
      
      // Announce ticket verbally if voice is enabled
      if (voiceActive) {
        announceTicketCall(res.calledTicket.id, deskName);
      } else {
        playLuxuryChime();
      }

      onShowToast(`Ticket #${res.calledTicket.id} appelé au ${deskName} • Synchronisé en direct`);
    } catch (err: any) {
      onShowToast(`Erreur d'appel : ${err.message}`);
    }
  };

  // Complete / Dismiss Call
  const handleDismissCall = async () => {
    try {
      await dismissCall(establishment.id);
      setActiveCalledTicket(null);
      onShowToast('Prise en charge terminée • Guichet libéré');
    } catch (err: any) {
      onShowToast(`Erreur : ${err.message}`);
    }
  };

  // Cancel / Remove Ticket
  const handleRemoveTicket = async (ticketId: number) => {
    try {
      const res = await removeTicket(establishment.id, ticketId);
      setQueue(res.queue);
      onShowToast(`Ticket #${ticketId} retiré de la file d'attente`);
    } catch (err: any) {
      onShowToast(`Erreur : ${err.message}`);
    }
  };

  const nextHeroTicket = queue.length > 0 ? queue[0] : null;

  return (
    <div className="w-full flex flex-col gap-6 animate-fadeIn">
      {/* Offline Alert Banner if Internet lost */}
      {!isOnline && (
        <div className="w-full bg-[#93000a]/30 border border-[#ffb4ab]/40 p-4 rounded-2xl flex items-center justify-between gap-4 text-[#ffb4ab]">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[24px]">cloud_off</span>
            <div>
              <div className="font-['Syne'] font-bold text-sm">
                Connexion Réseau Interrompue
              </div>
              <div className="font-['Outfit'] text-xs text-[#d0c5af]">
                Les opérations critiques sont verrouillées pour éviter tout doublon d'appel.
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              setIsOnline(true);
              onShowToast('Tentative de reconnexion au serveur...');
            }}
            className="px-3.5 py-1.5 bg-[#f2ca50] text-[#3c2f00] rounded-xl text-xs font-bold font-['Outfit'] cursor-pointer"
          >
            Reconnexion
          </button>
        </div>
      )}

      {/* Establishment & Operator Header Bar */}
      <div className="bg-[#14171d] border border-white/10 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-[#1e222a] border border-[#f2ca50]/30 flex items-center justify-center text-[#f2ca50] shadow-inner overflow-hidden">
            {establishment.logoUrl ? (
              <img
                src={establishment.logoUrl}
                alt={establishment.name}
                className="w-full h-full object-contain p-1"
              />
            ) : (
              <span className="material-symbols-outlined text-[26px]">
                {establishment.icon || 'apartment'}
              </span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="font-['Syne'] text-lg font-bold text-white">
                {establishment.name}
              </h2>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-['Outfit'] text-xs font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Connecté</span>
              </span>
            </div>
            <div className="font-['Outfit'] text-xs text-[#a0a6b5] mt-0.5">
              {operator ? `${operator.name} • ${operator.assignedDesk}` : 'Poste Guichetier • Guichet 1'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Voice Announcements Toggle */}
          <button
            type="button"
            onClick={handleToggleVoice}
            className={`px-3 py-2 border rounded-xl text-xs font-['Outfit'] font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              voiceActive
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25'
                : 'bg-rose-500/15 border-rose-500/30 text-rose-300 hover:bg-rose-500/25'
            }`}
            title={voiceActive ? 'Désactiver les annonces vocales' : 'Activer les annonces vocales'}
          >
            <span className="material-symbols-outlined text-[16px]">
              {voiceActive ? 'volume_up' : 'volume_off'}
            </span>
            <span>{voiceActive ? 'Voix ON' : 'Voix OFF'}</span>
          </button>

          <button
            onClick={() => onNavigate('affichage-ecran-tv')}
            className="px-3.5 py-2 bg-[#1b1f27] hover:bg-[#252a35] border border-white/10 rounded-xl text-xs font-['Outfit'] text-white flex items-center gap-2 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px] text-[#f2ca50]">tv</span>
            <span>Ouvrir Écran TV</span>
          </button>

          <button
            onClick={() => onNavigate('connexion-etablissement')}
            className="px-3.5 py-2 bg-[#1b1f27] hover:bg-[#252a35] border border-white/10 rounded-xl text-xs font-['Outfit'] text-[#ffb4ab] flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Changer de session ou déconnexion"
          >
            <span className="material-symbols-outlined text-[16px]">logout</span>
            <span>Quitter</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Left Keypad & Injection | Right Waiting Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Ticket Input (Keypad & 5s Auto-Confirmation) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="bg-[#14171d] border border-white/10 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="font-['JetBrains_Mono'] text-xs text-[#f2ca50] uppercase tracking-wider font-semibold">
                  Injection Directe de Ticket
                </span>
                <span className="text-[11px] font-['JetBrains_Mono'] text-[#a0a6b5]">
                  Max 3 Chiffres (1..999)
                </span>
              </div>

              {/* Numerical Display Screen (Starts EMPTY) */}
              <div className="relative bg-[#0c0e12] border border-white/10 rounded-2xl p-5 mb-4 shadow-inner flex flex-col items-center justify-center min-h-[120px]">
                <div className="font-['JetBrains_Mono'] text-5xl font-bold tracking-wider text-white">
                  {currentInput ? (
                    <span className="text-[#f2ca50] drop-shadow-[0_0_12px_rgba(242,202,80,0.5)]">
                      {currentInput}
                    </span>
                  ) : (
                    <span className="text-gray-700 select-none">---</span>
                  )}
                </div>

                <div className="text-[11px] font-['Outfit'] text-[#a0a6b5] mt-2">
                  {currentInput
                    ? 'Appuyez sur Entrée ou cliquez sur Injecter'
                    : 'Composez un numéro (1 à 999) au pavé ou clavier'}
                </div>
              </div>

              {/* Keypad Grid (3x4) */}
              <div className="grid grid-cols-3 gap-2.5 mb-4">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <button
                    key={digit}
                    onClick={() => handleDigit(digit)}
                    disabled={!isOnline || currentInput.length >= 3}
                    className="h-14 bg-[#1b1f27] hover:bg-[#252a35] active:bg-[#f2ca50] active:text-[#3c2f00] border border-white/5 rounded-xl font-['JetBrains_Mono'] text-2xl font-bold text-white transition-all shadow cursor-pointer disabled:opacity-40"
                  >
                    {digit}
                  </button>
                ))}

                {/* Bottom row: Backspace, 0, Validate */}
                <button
                  onClick={handleBackspace}
                  disabled={!currentInput}
                  className="h-14 bg-[#1b1f27] hover:bg-[#252a35] active:bg-rose-500/20 border border-white/5 rounded-xl flex items-center justify-center text-[#ffb4ab] transition-all cursor-pointer disabled:opacity-40"
                  title="Effacer le dernier chiffre"
                >
                  <span className="material-symbols-outlined text-[24px]">backspace</span>
                </button>

                <button
                  onClick={() => handleDigit('0')}
                  disabled={!isOnline || currentInput.length >= 3 || currentInput.length === 0}
                  className="h-14 bg-[#1b1f27] hover:bg-[#252a35] active:bg-[#f2ca50] active:text-[#3c2f00] border border-white/5 rounded-xl font-['JetBrains_Mono'] text-2xl font-bold text-white transition-all shadow cursor-pointer disabled:opacity-40"
                >
                  0
                </button>

                <button
                  onClick={() => submitTicket()}
                  disabled={!currentInput || !isOnline || isSubmitting}
                  className="h-14 bg-[#f2ca50] hover:bg-[#ffe088] active:bg-[#d4af37] text-[#3c2f00] rounded-xl font-['Outfit'] font-bold flex items-center justify-center gap-1.5 transition-all shadow cursor-pointer disabled:opacity-40"
                  title="Valider immédiatement (Entrée)"
                >
                  <span className="material-symbols-outlined text-[22px]">check</span>
                  <span className="text-xs uppercase tracking-wider">OK</span>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] font-['JetBrains_Mono'] text-[#a0a6b5] pt-3 border-t border-white/5">
              <span>Touches physiques supportées</span>
              <span className="text-[#f2ca50]">Entrée = Validation</span>
            </div>
          </div>

          {/* Active Called Ticket Card */}
          {activeCalledTicket && (
            <div className="bg-gradient-to-br from-[#1e2024] to-[#14171d] border border-[#f2ca50]/50 rounded-2xl p-5 shadow-2xl animate-scaleUp">
              <div className="flex items-center justify-between mb-3">
                <span className="px-2.5 py-0.5 rounded-full bg-[#f2ca50]/20 text-[#f2ca50] font-['JetBrains_Mono'] text-[11px] font-bold uppercase tracking-wider">
                  Ticket Actuellement Appelé
                </span>
                <span className="font-['JetBrains_Mono'] text-xs text-[#a0a6b5]">
                  Appelé à {activeCalledTicket.calledAt || activeCalledTicket.time}
                </span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="font-['Syne'] text-4xl font-extrabold text-[#f2ca50]">
                    #{activeCalledTicket.id}
                  </div>
                  <div className="font-['Outfit'] text-xs text-white mt-1">
                    Affecté au : <span className="font-semibold text-[#f2ca50]">{activeCalledTicket.desk}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => handleCallTicket(activeCalledTicket.id)}
                    className="px-3.5 py-1.5 bg-[#1b1f27] hover:bg-[#252a35] border border-[#f2ca50]/30 rounded-lg text-xs font-['Outfit'] text-[#f2ca50] flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">volume_up</span>
                    <span>Rappeler</span>
                  </button>

                  <button
                    onClick={handleDismissCall}
                    className="px-3.5 py-1.5 bg-[#f2ca50] hover:bg-[#ffe088] text-[#3c2f00] rounded-lg text-xs font-['Outfit'] font-bold flex items-center gap-1.5 cursor-pointer shadow"
                  >
                    <span className="material-symbols-outlined text-[16px]">check_circle</span>
                    <span>Libérer Guichet</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Waiting Queue (Strict FIFO) */}
        <div className="lg:col-span-7 flex flex-col gap-5">
          {/* Next Ticket Hero Action Card */}
          <div className="bg-[#14171d] border border-white/10 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <span className="font-['JetBrains_Mono'] text-xs text-[#f2ca50] uppercase tracking-wider font-semibold">
                Prochain Passage (Ordre Strict FIFO)
              </span>
              <span className="font-['JetBrains_Mono'] text-xs text-[#a0a6b5]">
                {queue.length} en attente
              </span>
            </div>

            {nextHeroTicket ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-[#1b1f27] rounded-xl border border-[#f2ca50]/30">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-[#0c0e12] border border-[#f2ca50]/40 flex items-center justify-center font-['Syne'] text-3xl font-extrabold text-[#f2ca50] shadow-inner">
                    #{nextHeroTicket.id}
                  </div>
                  <div>
                    <div className="font-['Outfit'] text-sm font-semibold text-white">
                      Ticket #{nextHeroTicket.id} en tête de file
                    </div>
                    <div className="font-['JetBrains_Mono'] text-xs text-[#a0a6b5] mt-0.5">
                      Ajouté à {nextHeroTicket.arrivedAt || nextHeroTicket.time} • Prochain par ordre d’arrivée
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleCallTicket(nextHeroTicket.id)}
                  disabled={!isOnline}
                  className="px-6 py-3.5 bg-[#f2ca50] hover:bg-[#ffe088] active:bg-[#d4af37] text-[#3c2f00] font-['Outfit'] text-sm font-bold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
                >
                  <span className="material-symbols-outlined text-[20px]">campaign</span>
                  <span>Appeler #{nextHeroTicket.id}</span>
                </button>
              </div>
            ) : (
              <div className="p-8 bg-[#1b1f27] rounded-xl border border-white/5 text-center flex flex-col items-center justify-center">
                <span className="material-symbols-outlined text-[36px] text-gray-600 mb-2">
                  queue
                </span>
                <div className="font-['Syne'] text-base font-bold text-white mb-1">
                  File d'Attente Complètement Vide
                </div>
                <div className="font-['Outfit'] text-xs text-[#a0a6b5]">
                  Utilisez le pavé numérique à gauche pour ajouter un premier ticket.
                </div>
              </div>
            )}
          </div>

          {/* Full Queue List */}
          <div className="bg-[#14171d] border border-white/10 rounded-2xl p-6 shadow-xl flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-['Syne'] text-base font-bold text-white">
                File Active Temps Réel
              </h3>
              <span className="font-['Outfit'] text-xs text-[#a0a6b5]">
                Règle FIFO : 1er arrivé, 1er appelé
              </span>
            </div>

            <div className="flex-1 overflow-y-auto max-h-[380px] flex flex-col gap-2.5 pr-1">
              {queue.map((ticket, index) => (
                <div
                  key={ticket.id}
                  className={`p-4 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                    index === 0
                      ? 'bg-[#1e222a] border-[#f2ca50]/40 shadow'
                      : 'bg-[#171a21] border-white/5 hover:border-white/15'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <span
                      className={`w-7 h-7 rounded-lg flex items-center justify-center font-['JetBrains_Mono'] text-xs font-bold ${
                        index === 0
                          ? 'bg-[#f2ca50] text-[#3c2f00]'
                          : 'bg-[#222631] text-[#a0a6b5]'
                      }`}
                    >
                      {index + 1}
                    </span>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-['Syne'] text-lg font-bold text-white">
                          Ticket #{ticket.id}
                        </span>
                        {index === 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-[#f2ca50]/15 text-[#f2ca50] font-['JetBrains_Mono'] text-[10px] font-bold uppercase">
                            PROCHAIN
                          </span>
                        )}
                      </div>
                      <div className="font-['JetBrains_Mono'] text-[11px] text-[#a0a6b5]">
                        Ajouté à {ticket.arrivedAt || ticket.time}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCallTicket(ticket.id)}
                      className="px-3 py-1.5 bg-[#f2ca50] hover:bg-[#ffe088] text-[#3c2f00] rounded-lg text-xs font-['Outfit'] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">call</span>
                      <span>Appeler</span>
                    </button>

                    <button
                      onClick={() => handleRemoveTicket(ticket.id)}
                      className="p-1.5 text-[#ffb4ab] hover:bg-[#93000a]/20 rounded-lg transition-colors cursor-pointer"
                      title="Annuler ce ticket"
                    >
                      <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                  </div>
                </div>
              ))}

              {queue.length === 0 && (
                <div className="py-8 text-center text-xs text-[#a0a6b5] font-['Outfit']">
                  Aucun ticket n'est présent dans la file.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
