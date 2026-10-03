import React, { useState, useEffect, useRef } from 'react';
import { Establishment, QueueTicket, TabType } from '../types';
import { generateQrDataUrl, addTicket, callTicket } from '../utils/api';
import {
  playLuxuryChime,
  announceTicketCall,
  isVoiceEnabled,
  setVoiceEnabled,
  getIsAudioUnlocked,
  unlockAudioSystem,
} from '../utils/audio';

interface AffichageEcranTvViewProps {
  establishment: Establishment;
  queue: QueueTicket[];
  setQueue?: React.Dispatch<React.SetStateAction<QueueTicket[]>>;
  activeCalledTicket: QueueTicket | null;
  setActiveCalledTicket?: (ticket: QueueTicket | null) => void;
  onNavigate: (tab: TabType) => void;
  onShowToast: (msg: string) => void;
}

export const AffichageEcranTvView: React.FC<AffichageEcranTvViewProps> = ({
  establishment,
  queue,
  setQueue,
  activeCalledTicket,
  setActiveCalledTicket,
  onNavigate,
  onShowToast,
}) => {
  const [clockTime, setClockTime] = useState<string>('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  // Strict requirement: Keyboard input starts strictly EMPTY, never prefilled, max 3 digits
  const [tvInput, setTvInput] = useState<string>('');
  const tvInputRef = useRef<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);
  const [exitCodeInput, setExitCodeInput] = useState<string>('');
  const [exitError, setExitError] = useState<string | null>(null);

  // Vocal Announcements State
  const [voiceActive, setVoiceActive] = useState<boolean>(() => isVoiceEnabled());
  const [showAudioUnlockPrompt, setShowAudioUnlockPrompt] = useState<boolean>(() => !getIsAudioUnlocked());
  const lastAnnouncedTicketRef = useRef<number | null>(null);

  // Announce ticket whenever activeCalledTicket changes (real server event)
  useEffect(() => {
    if (activeCalledTicket && activeCalledTicket.id !== lastAnnouncedTicketRef.current) {
      lastAnnouncedTicketRef.current = activeCalledTicket.id;
      if (voiceActive) {
        announceTicketCall(activeCalledTicket.id, activeCalledTicket.desk);
      }
    }
  }, [activeCalledTicket, voiceActive]);

  const handleToggleVoice = () => {
    const nextState = !voiceActive;
    setVoiceActive(nextState);
    setVoiceEnabled(nextState);
    if (nextState) {
      unlockAudioSystem();
      setShowAudioUnlockPrompt(false);
      onShowToast('🔊 Annonces vocales activées');
      playLuxuryChime();
    } else {
      onShowToast('🔇 Annonces vocales désactivées');
    }
  };

  const handleUnlockAudio = () => {
    unlockAudioSystem();
    setShowAudioUnlockPrompt(false);
    onShowToast('🔊 Annonces vocales autorisées pour cet écran TV');
    playLuxuryChime();
  };

  // Keep ref synchronized
  useEffect(() => {
    tvInputRef.current = tvInput;
  }, [tvInput]);

  // Live atomic clock update
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const s = String(now.getSeconds()).padStart(2, '0');
      setClockTime(`${h}:${m}:${s}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Generate QR Code for this establishment
  useEffect(() => {
    if (!establishment?.id || !establishment.code) {
      setQrDataUrl('');
      return;
    }
    const origin = window.location.origin;
    const estCode = establishment.code || establishment.id.replace('#', '');
    const clientUrl = `${origin}?est=${encodeURIComponent(estCode)}&tab=suivi-client-mobile`;

    generateQrDataUrl(clientUrl).then((url) => {
      setQrDataUrl(url);
    });
  }, [establishment]);

  // Submit Ticket to Backend (FIFO order)
  const handleValidateTicket = async (overrideVal?: string) => {
    const val = (overrideVal !== undefined ? overrideVal : tvInputRef.current).trim();
    if (!val) return;

    const num = parseInt(val, 10);
    if (isNaN(num) || num < 1 || num > 999) {
      onShowToast('Numéro invalide (1 à 999)');
      setTvInput('');
      return;
    }

    if (!establishment?.id) {
      onShowToast('Établissement non sélectionné');
      return;
    }

    setIsSubmitting(true);
    setTvInput(''); // Clear immediately on submit

    try {
      const res = await addTicket(establishment.id, num, 'Borne TV', 'Accueil');
      if (setQueue) {
        setQueue(res.queue);
      }
      onShowToast(`Ticket #${num} ajouté à la file d’attente`);
    } catch (err: any) {
      onShowToast(err.message || `Le ticket ${num} est déjà dans la file d'attente.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Call Ticket (either typed number or next in FIFO)
  const handleCallTicketAction = async (targetId?: number) => {
    if (!establishment?.id) return;

    try {
      playLuxuryChime();
      const res = await callTicket(establishment.id, targetId, 'Guichet 1');
      if (setActiveCalledTicket) {
        setActiveCalledTicket(res.calledTicket);
      }
      if (setQueue) {
        setQueue(res.queue);
      }
      setTvInput('');
      onShowToast(`Ticket #${res.calledTicket.id} appelé au Guichet 1`);
    } catch (err: any) {
      onShowToast(`Erreur d'appel : ${err.message}`);
    }
  };

  // Global Keyboard Listener for TV Screen
  // TEST 1: Empty -> press 1 -> '1'
  // TEST 2: '1' -> press 2 -> '12'
  // TEST 3: '12' -> press 3 -> '123'
  // TEST 4: '123' -> press 4 -> remains '123' (max 3 digits)
  // TEST 5: '123' -> Backspace -> '12'
  // TEST 6: Empty -> NO automatic value (NEVER 14)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If user is inside an input element (e.g. exit modal), don't intercept
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      // Check numeric keys 0-9 (top-row or numpad)
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        setTvInput((prev) => {
          if (prev.length >= 3) return prev;
          return prev + e.key;
        });
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        setTvInput((prev) => prev.slice(0, -1));
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setTvInput('');
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const currentVal = tvInputRef.current.trim();
        if (currentVal.length > 0) {
          handleValidateTicket(currentVal);
        }
      } else if (e.code === 'Space') {
        e.preventDefault();
        const currentVal = tvInputRef.current.trim();
        if (currentVal.length > 0) {
          const num = parseInt(currentVal, 10);
          handleCallTicketAction(num);
        } else if (queue.length > 0) {
          handleCallTicketAction(queue[0].id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [establishment?.id, queue]);

  const handleExitSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanExit = exitCodeInput.trim().toUpperCase().replace(/^#/, '');
    const estCode = (establishment.code || '').toUpperCase().replace(/^#/, '');
    const staffCode = (establishment.staffCode || establishment.code || '').toUpperCase().replace(/^#/, '');

    if (cleanExit && (cleanExit === estCode || cleanExit === staffCode || cleanExit === 'ADMIN')) {
      setShowExitConfirm(false);
      setExitCodeInput('');
      setExitError(null);
      onNavigate('accueil');
    } else {
      setExitError('Code de sécurité incorrect.');
    }
  };

  // CRITICAL REQUIREMENT: Display MAXIMUM 3 tickets from the waiting queue! Never the 4th!
  const waitingDisplayTickets = queue.slice(0, 3);

  if (!establishment?.id || !establishment.code) {
    return (
      <div className="fixed inset-0 z-50 bg-[#0c0e12] text-white flex flex-col items-center justify-center p-8 text-center">
        <span className="material-symbols-outlined text-5xl text-[#f2ca50] mb-4">tv</span>
        <h1 className="font-['Syne'] text-3xl font-bold mb-2">Aucun établissement configuré</h1>
        <p className="text-[#a0a6b5] mb-6">Créez ou sélectionnez un établissement avant d’ouvrir son écran TV.</p>
        <button onClick={() => onNavigate('accueil')} className="px-5 py-3 rounded-xl bg-[#f2ca50] text-[#3c2f00] font-bold">Retour à l’accueil</button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#0c0e12] text-white flex flex-col justify-between p-2.5 sm:p-4 md:p-6 select-none font-['Outfit'] overflow-hidden h-screen max-h-screen">
      {/* Top Banner: Establishment Branding & Atomic Clock */}
      <div className="w-full flex items-center justify-between pb-2 sm:pb-3 md:pb-4 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2.5 sm:gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-xl sm:rounded-2xl bg-[#1e222a] border border-[#f2ca50]/40 flex items-center justify-center text-[#f2ca50] shadow-xl overflow-hidden shrink-0">
            {establishment.logoUrl ? (
              <img
                src={establishment.logoUrl}
                alt={establishment.name}
                className="w-full h-full object-contain p-0.5"
              />
            ) : (
              <span className="material-symbols-outlined text-[22px] sm:text-[28px] md:text-[32px]">
                {establishment.icon || 'apartment'}
              </span>
            )}
          </div>
          <div className="overflow-hidden">
            <h1 className="font-['Syne'] text-sm sm:text-xl md:text-2xl lg:text-3xl font-extrabold tracking-wide text-white truncate">
              {establishment.name}
            </h1>
            <p className="font-['Outfit'] text-[10px] sm:text-xs text-[#a0a6b5] truncate hidden xs:block">
              Affichage Salle d'Attente • Projection Haute Sérénité
            </p>
          </div>
        </div>

        {/* Live Atomic Clock, Voice Toggle & Exit Button */}
        <div className="flex items-center gap-2 sm:gap-3 md:gap-4 shrink-0">
          {/* Voice Announcement Toggle Button */}
          <button
            type="button"
            onClick={handleToggleVoice}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl border text-[11px] sm:text-xs font-semibold transition-all cursor-pointer shadow-md ${
              voiceActive
                ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/25'
                : 'bg-rose-500/15 border-rose-500/40 text-rose-300 hover:bg-rose-500/25'
            }`}
            title={voiceActive ? 'Désactiver les annonces vocales' : 'Activer les annonces vocales'}
          >
            <span className="material-symbols-outlined text-[15px] sm:text-[18px]">
              {voiceActive ? 'volume_up' : 'volume_off'}
            </span>
            <span className="hidden sm:inline">
              Voix : <strong>{voiceActive ? 'ON' : 'OFF'}</strong>
            </span>
          </button>

          <div className="flex flex-col items-end">
            <div className="font-['JetBrains_Mono'] text-sm sm:text-xl md:text-2xl font-bold text-[#f2ca50] tracking-wider drop-shadow-[0_0_10px_rgba(242,202,80,0.3)]">
              {clockTime}
            </div>
            <span className="font-['JetBrains_Mono'] text-[9px] sm:text-[10px] text-[#a0a6b5] uppercase tracking-wider hidden sm:inline">
              En direct
            </span>
          </div>

          <button
            onClick={() => setShowExitConfirm(true)}
            className="p-1.5 sm:p-2 rounded-xl bg-[#171a21] hover:bg-[#222631] border border-white/10 text-[#a0a6b5] hover:text-white transition-colors cursor-pointer"
            title="Quitter l'Écran TV"
          >
            <span className="material-symbols-outlined text-[18px] sm:text-[22px]">fullscreen_exit</span>
          </button>
        </div>
      </div>

      {/* Autoplay / Audio Activation Banner (displayed if browser requires first gesture) */}
      {showAudioUnlockPrompt && voiceActive && (
        <div className="w-full mt-2 p-2 sm:p-3 rounded-xl bg-gradient-to-r from-[#1e222a] via-[#242b38] to-[#1e222a] border border-[#f2ca50]/50 shadow-lg flex items-center justify-between gap-2 shrink-0 animate-slideDown text-xs">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-[#f2ca50]">campaign</span>
            <span className="text-white font-medium text-[11px] sm:text-xs">
              Autoriser la synthèse vocale des tickets
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleUnlockAudio}
              className="px-3 py-1 rounded-lg bg-[#f2ca50] hover:bg-[#ffe17d] text-[#3c2f00] font-bold text-[11px] cursor-pointer"
            >
              Activer
            </button>
            <button
              type="button"
              onClick={() => setShowAudioUnlockPrompt(false)}
              className="p-1 text-[#a0a6b5] hover:text-white text-xs cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Center 50/50 Side-by-Side Grid: Left Visitors (50%) | Right QR Code (50%) */}
      <div className="w-full flex-1 grid grid-cols-2 gap-2.5 sm:gap-4 md:gap-6 items-stretch py-1.5 sm:py-2.5 min-h-0 overflow-hidden">
        {/* =========================================================
            GAUCHE (50% de l'écran) : LES VISITEURS & APPEL EN COURS
        ========================================================= */}
        <div className="col-span-1 flex flex-col justify-between gap-2 bg-[#11141a] border border-white/10 rounded-2xl sm:rounded-3xl p-2.5 sm:p-4 md:p-5 shadow-xl min-h-0 overflow-hidden">
          {/* Active Called Ticket Hero */}
          {activeCalledTicket ? (
            <div className="relative bg-gradient-to-br from-[#2a2205] via-[#1c1704] to-[#14171d] border-2 border-[#f2ca50] rounded-xl sm:rounded-2xl p-2 sm:p-3.5 shadow-[0_0_25px_rgba(242,202,80,0.3)] flex flex-col items-center justify-center text-center animate-pulse flex-1 min-h-0">
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#f2ca50] text-[#3c2f00] font-['JetBrains_Mono'] text-[9px] sm:text-xs font-black uppercase tracking-wider mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#3c2f00] animate-ping" />
                <span>APPEL EN COURS</span>
              </div>

              <div className="font-['Syne'] text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-[#f2ca50] drop-shadow-[0_0_20px_rgba(242,202,80,0.6)] leading-none my-0.5">
                #{activeCalledTicket.id}
              </div>

              <div className="font-['Outfit'] text-[10px] sm:text-xs text-[#d0c5af]">
                Veuillez vous présenter au :
              </div>
              <div className="font-['Syne'] text-xs sm:text-base md:text-lg font-extrabold text-white">
                {activeCalledTicket.desk || 'Guichet 1'}
              </div>
            </div>
          ) : (
            <div className="bg-[#14171d] border border-white/5 rounded-xl sm:rounded-2xl p-3 sm:p-4 text-center flex flex-col items-center justify-center flex-1 min-h-0">
              <span className="material-symbols-outlined text-2xl sm:text-3xl text-[#a0a6b5] mb-1">
                hourglass_empty
              </span>
              <div className="font-['Syne'] text-xs sm:text-sm font-bold text-white">
                Aucun Appel Actif
              </div>
              <p className="font-['Outfit'] text-[9px] sm:text-xs text-[#a0a6b5] mt-0.5">
                Le prochain ticket sera projeté dès son appel.
              </p>
            </div>
          )}

          {/* Prochains Passages Header & List (Strict FIFO: Max 3) */}
          <div className="flex flex-col shrink-0">
            <div className="flex items-center justify-between mb-1">
              <span className="font-['JetBrains_Mono'] text-[9px] sm:text-xs text-[#f2ca50] uppercase tracking-wider font-semibold flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px] sm:text-[15px]">format_list_numbered</span>
                <span className="truncate">Prochains Passages</span>
              </span>
              <span className="font-['Outfit'] text-[9px] sm:text-xs text-[#a0a6b5]">
                {queue.length} en attente
              </span>
            </div>

            {/* Next Tickets Cards */}
            <div className="grid grid-cols-3 gap-1 sm:gap-2">
              {waitingDisplayTickets.map((t, index) => (
                <div
                  key={t.id}
                  className={`p-1 sm:p-2 rounded-xl border transition-all flex flex-col items-center justify-center text-center ${
                    index === 0
                      ? 'bg-[#1e222a] border-[#f2ca50]/50 shadow-md'
                      : 'bg-[#14171d] border-white/10'
                  }`}
                >
                  <span className="font-['JetBrains_Mono'] text-[7px] sm:text-[9px] text-[#a0a6b5] uppercase">
                    {index === 0 ? 'Suivant' : `Rang ${index + 1}`}
                  </span>
                  <span
                    className={`font-['Syne'] text-base sm:text-xl md:text-2xl font-extrabold my-0.5 ${
                      index === 0 ? 'text-[#f2ca50]' : 'text-white'
                    }`}
                  >
                    #{t.id}
                  </span>
                  <span className="font-['Outfit'] text-[7px] sm:text-[8px] text-[#a0a6b5] truncate">
                    {t.desk || 'Guichet'}
                  </span>
                </div>
              ))}

              {waitingDisplayTickets.length === 0 && (
                <div className="col-span-3 py-2 bg-[#14171d] border border-white/5 rounded-xl text-center text-[9px] sm:text-xs text-[#a0a6b5] font-['Outfit']">
                  File d'attente vide
                </div>
              )}
            </div>
          </div>
        </div>

        {/* =========================================================
            DROITE (50% de l'écran) : LE CODE QR (SCAN DIRECT ENTIER)
        ========================================================= */}
        <div className="col-span-1 flex flex-col items-center justify-between bg-[#11141a] border-2 border-[#f2ca50]/40 rounded-2xl sm:rounded-3xl p-2.5 sm:p-3.5 md:p-4 text-center shadow-2xl min-h-0 overflow-hidden">
          {/* Header */}
          <div className="flex flex-col items-center shrink-0">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#f2ca50]/15 border border-[#f2ca50]/40 text-[#f2ca50] font-['Syne'] text-[10px] sm:text-xs font-extrabold uppercase tracking-wide mb-1">
              <span className="material-symbols-outlined text-[14px] sm:text-[16px]">qr_code_scanner</span>
              <span>SCANNEZ POUR SUIVRE</span>
            </div>
            <p className="font-['Outfit'] text-[9px] sm:text-xs text-[#d0c5af] leading-tight max-w-xs">
              Ouvrez l'appareil photo de votre smartphone pour suivre votre rang en direct.
            </p>
          </div>

          {/* QR Code Container with guaranteed responsive sizing */}
          <div className="flex-1 w-full min-h-[150px] flex items-center justify-center py-1 sm:py-2">
            <div className="relative p-2.5 sm:p-3.5 bg-[#0c0e12] rounded-2xl border-2 border-[#f2ca50] shadow-[0_0_25px_rgba(242,202,80,0.3)] flex items-center justify-center max-w-[280px]">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="QR Code Suivi Visiteur"
                  className="w-36 h-36 xs:w-44 xs:h-44 sm:w-52 sm:h-52 md:w-56 md:h-56 lg:w-60 lg:h-60 max-w-full max-h-[35vh] object-contain rounded-xl block shadow-inner"
                />
              ) : (
                <div className="w-36 h-36 flex flex-col items-center justify-center gap-2 text-xs text-[#a0a6b5]">
                  <span className="w-5 h-5 border-2 border-[#f2ca50] border-t-transparent rounded-full animate-spin" />
                  <span>Génération QR Code...</span>
                </div>
              )}
            </div>
          </div>

          {/* Footer Badge */}
          <div className="font-['Outfit'] text-[8px] sm:text-[10px] text-[#d0c5af] bg-[#1e222a] px-2.5 py-0.5 rounded-full border border-white/10 flex items-center gap-1 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="truncate">Sans application requise • 100% Gratuit</span>
          </div>
        </div>
      </div>

      {/* Secure Exit Modal (Protected by Code Staff or Admin, never exposing secret codes publicly) */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#14171d] border border-[#f2ca50]/40 rounded-2xl p-6 shadow-2xl animate-scaleUp text-center">
            <div className="w-12 h-12 rounded-xl bg-[#1e222a] border border-[#f2ca50]/30 flex items-center justify-center text-[#f2ca50] mb-4 mx-auto">
              <span className="material-symbols-outlined text-[24px]">lock</span>
            </div>

            <h3 className="font-['Syne'] text-lg font-bold text-white mb-1">
              Sécurité Écran TV
            </h3>
            <p className="font-['Outfit'] text-xs text-[#a0a6b5] mb-4">
              Saisissez le Code de sécurité pour quitter le mode d'affichage public.
            </p>

            {exitError && (
              <div className="mb-4 p-2.5 bg-[#93000a]/20 border border-[#ffb4ab]/30 rounded-xl text-[#ffb4ab] text-xs font-['Outfit']">
                {exitError}
              </div>
            )}

            <form onSubmit={handleExitSubmit} className="flex flex-col gap-3">
              <div className="relative">
                <input
                  type="password"
                  value={exitCodeInput}
                  onChange={(e) => {
                    setExitCodeInput(e.target.value);
                    setExitError(null);
                  }}
                  placeholder="Code Staff ou Administrateur..."
                  autoFocus
                  className="w-full bg-[#1b1f27] border border-white/10 rounded-xl px-4 py-2.5 text-center text-sm font-['JetBrains_Mono'] text-[#f2ca50] placeholder-gray-500 focus:outline-none focus:border-[#f2ca50]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowExitConfirm(false);
                    setExitCodeInput('');
                    setExitError(null);
                  }}
                  className="py-2.5 bg-[#1b1f27] hover:bg-[#252a35] text-[#a0a6b5] rounded-xl text-xs font-['Outfit'] cursor-pointer"
                >
                  Rester en plein écran
                </button>
                <button
                  type="submit"
                  className="py-2.5 bg-[#f2ca50] hover:bg-[#ffe088] text-[#3c2f00] font-bold rounded-xl text-xs font-['Outfit'] shadow cursor-pointer"
                >
                  Déverrouiller & Quitter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
