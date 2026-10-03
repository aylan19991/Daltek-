import React, { useState, useEffect, useRef } from 'react';
import { Establishment, QueueTicket, TabType } from '../types';
import { playLuxuryChime } from '../utils/audio';

interface SuiviClientMobileViewProps {
  establishment: Establishment;
  queue: QueueTicket[];
  activeCalledTicket: QueueTicket | null;
  onNavigate: (tab: TabType) => void;
  onShowToast: (msg: string) => void;
}

export const SuiviClientMobileView: React.FC<SuiviClientMobileViewProps> = ({
  establishment,
  queue,
  activeCalledTicket,
  onNavigate,
  onShowToast,
}) => {
  const [trackedTicketNumber, setTrackedTicketNumber] = useState<number | null>(null);
  const [ticketInput, setTicketInput] = useState<string>('');
  const [showChangeModal, setShowChangeModal] = useState<boolean>(false);
  const [newTicketInput, setNewTicketInput] = useState<string>('');
  const [notificationsGranted, setNotificationsGranted] = useState<boolean>(false);

  // Track previous state for notification triggers
  const prevPositionRef = useRef<number | null>(null);
  const prevCalledRef = useRef<boolean>(false);

  // Request browser notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'granted') {
      setNotificationsGranted(true);
    }
  }, []);

  // 5-second auto-validation after inactivity
  useEffect(() => {
    if (!ticketInput.trim()) return;
    const timer = setTimeout(() => {
      const num = parseInt(ticketInput.trim(), 10);
      if (!isNaN(num) && num >= 1 && num <= 999) {
        setTrackedTicketNumber(num);
        setTicketInput('');
        prevPositionRef.current = null;
        prevCalledRef.current = false;
        onShowToast(`Suivi activé automatiquement pour le ticket #${num}`);
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [ticketInput, onShowToast]);

  const enableNotifications = async () => {
    if ('Notification' in window) {
      const res = await Notification.requestPermission();
      if (res === 'granted') {
        setNotificationsGranted(true);
        onShowToast('Alertes navigateur activées pour cette page');
        new Notification('DALTEK • Notifications Activées', {
          body: `Vous recevrez des alertes navigateur pendant que cette page de suivi est ouverte pour ${establishment.name}.`,
          icon: '/favicon.ico',
        });
      }
    }
  };

  // Helper to send alert
  const sendAlert = (title: string, body: string, vibrate = false) => {
    playLuxuryChime();
    if (vibrate && 'vibrate' in navigator) {
      navigator.vibrate([200, 100, 200, 100, 300]);
    }
    onShowToast(`${title} • ${body}`);
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/favicon.ico' });
    }
  };

  // Check queue status for tracked ticket
  const isCalled = activeCalledTicket && trackedTicketNumber !== null && activeCalledTicket.id === trackedTicketNumber;
  const indexInQueue = trackedTicketNumber !== null ? queue.findIndex((t) => t.id === trackedTicketNumber) : -1;
  const isInQueue = indexInQueue !== -1;
  const peopleAhead = indexInQueue; // index 0 means 0 people ahead (next!)

  // Real-time transition listener for the tracked ticket
  useEffect(() => {
    if (trackedTicketNumber === null) return;

    // Check if called
    if (isCalled && !prevCalledRef.current) {
      sendAlert(
        'DALTEK • C’EST VOTRE TOUR !',
        `Veuillez vous présenter immédiatement au ${activeCalledTicket?.desk || 'Guichet'}.`,
        true
      );
      prevCalledRef.current = true;
      return;
    }

    if (!isCalled) {
      prevCalledRef.current = false;
    }

    // Check position transitions
    if (isInQueue) {
      const currentPos = peopleAhead;
      const prevPos = prevPositionRef.current;

      if (prevPos !== null && prevPos !== currentPos) {
        if (currentPos === 2) {
          sendAlert(
            'DALTEK • Rappel Imminent',
            'Il ne reste que 2 personnes avant votre tour. Préparez-vous à vous approcher.'
          );
        } else if (currentPos === 0) {
          sendAlert(
            'DALTEK • Vous êtes le prochain !',
            'Votre tour est imminent. Tenez-vous prêt face aux guichets.',
            true
          );
        }
      }
      prevPositionRef.current = currentPos;
    }
  }, [trackedTicketNumber, queue, activeCalledTicket, isCalled, isInQueue, peopleAhead]);

  // Handle Initial Ticket Tracking Submit
  const handleTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = ticketInput.trim();
    if (!val) return;

    const num = parseInt(val, 10);
    if (isNaN(num) || num < 1 || num > 999) {
      onShowToast('Numéro de ticket invalide (1 à 999)');
      return;
    }

    setTrackedTicketNumber(num);
    setTicketInput('');
    prevPositionRef.current = null;
    prevCalledRef.current = false;
    onShowToast(`Suivi activé pour le ticket #${num}`);
  };

  // Handle Switch Ticket (Cancels old ticket tracking immediately!)
  const handleSwitchTicketSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = newTicketInput.trim();
    if (!val) return;

    const num = parseInt(val, 10);
    if (isNaN(num) || num < 1 || num > 999) {
      onShowToast('Numéro invalide');
      return;
    }

    // Stop previous ticket notifications & activate new
    setTrackedTicketNumber(num);
    setShowChangeModal(false);
    setNewTicketInput('');
    prevPositionRef.current = null;
    prevCalledRef.current = false;
    onShowToast(`Suivi transféré vers le Ticket #${num}`);
  };

  // Stop tracking
  const handleStopTracking = () => {
    setTrackedTicketNumber(null);
    prevPositionRef.current = null;
    prevCalledRef.current = false;
    onShowToast('Suivi de ticket interrompu');
  };

  if (!establishment?.id || !establishment.code) {
    return (
      <div className="w-full max-w-xl mx-auto py-16 text-center">
        <h1 className="font-['Syne'] text-2xl font-bold text-white mb-3">Établissement introuvable</h1>
        <p className="text-sm text-[#a0a6b5] mb-6">Le QR code ne correspond à aucun établissement configuré. Demandez un QR code valide à l’accueil.</p>
        <button onClick={() => onNavigate('accueil')} className="rounded-xl bg-[#f2ca50] px-4 py-3 font-bold text-[#3c2f00]">Retour à l’accueil</button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-xl mx-auto py-4 animate-fadeIn font-['Outfit']">
      {/* Return to home link */}
      <button
        onClick={() => onNavigate('accueil')}
        className="flex items-center gap-1.5 text-xs text-[#a0a6b5] hover:text-white transition-colors mb-5"
      >
        <span className="material-symbols-outlined text-[16px]">arrow_back</span>
        <span>Retour à l'accueil DALTEK</span>
      </button>

      {/* Establishment Header */}
      <div className="bg-[#14171d] border border-white/10 rounded-2xl p-5 mb-6 flex items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-[#1e222a] border border-[#f2ca50]/30 flex items-center justify-center text-[#f2ca50] overflow-hidden">
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
            <div className="flex items-center gap-2">
              <h2 className="font-['Syne'] text-base md:text-lg font-bold text-white">
                {establishment.name}
              </h2>
            </div>
            <div className="text-xs text-[#a0a6b5]">File d'attente en temps réel</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-['JetBrains_Mono'] text-xs text-[#d0c5af] hidden sm:inline">
            Suivi en direct
          </span>
        </div>
      </div>

      {/* View 1: When No Ticket is being tracked yet */}
      {trackedTicketNumber === null ? (
        <div className="bg-[#14171d] border border-white/10 rounded-3xl p-7 md:p-9 shadow-2xl relative overflow-hidden">
          <div className="w-14 h-14 rounded-2xl bg-[#1e222a] border border-[#f2ca50]/30 flex items-center justify-center text-[#f2ca50] mb-5">
            <span className="material-symbols-outlined text-[30px]">confirmation_number</span>
          </div>

          <h3 className="font-['Syne'] text-2xl font-bold text-white mb-2">
            Suivi de Votre Ticket
          </h3>
          <p className="text-xs sm:text-sm text-[#a0a6b5] leading-relaxed mb-6">
            Saisissez le numéro inscrit sur votre ticket papier ou remis par l'accueil pour être alerté en direct sans attendre debout dans la file.
          </p>

          <form onSubmit={handleTrackSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-['JetBrains_Mono'] uppercase tracking-wider text-[#d0c5af] mb-2">
                Numéro de Ticket (1 à 999)
              </label>
              <input
                type="text"
                maxLength={3}
                value={ticketInput}
                onChange={(e) => setTicketInput(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="Numéro du ticket"
                className="w-full bg-[#1b1f27] border border-white/10 rounded-2xl px-5 py-4 text-center font-['JetBrains_Mono'] text-3xl font-bold text-[#f2ca50] placeholder-gray-600 focus:outline-none focus:border-[#f2ca50] transition-colors shadow-inner"
                autoFocus
                required
              />
            </div>

            <button
              type="submit"
              className="w-full mt-2 py-4 bg-[#f2ca50] hover:bg-[#ffe088] active:bg-[#d4af37] text-[#3c2f00] font-['Outfit'] text-sm font-bold rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Suivre mon ticket</span>
              <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
            </button>
          </form>

          {/* Notification permission button if not yet enabled */}
          {!notificationsGranted && (
            <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-xs text-[#a0a6b5]">
              <span>Alertes sonores & vibrations</span>
              <button
                type="button"
                onClick={enableNotifications}
                className="text-[#f2ca50] hover:underline flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[15px]">notifications</span>
                <span>Activer les alertes</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        /* View 2: Active Ticket Tracking */
        <div className="flex flex-col gap-5">
          {/* Active Calling State Hero */}
          {isCalled ? (
            <div className="bg-gradient-to-br from-[#2a2205] via-[#1c1704] to-[#14171d] border-2 border-[#f2ca50] rounded-3xl p-8 shadow-[0_0_60px_rgba(242,202,80,0.35)] text-center animate-pulse flex flex-col items-center">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#f2ca50] text-[#3c2f00] font-['JetBrains_Mono'] text-xs font-black uppercase tracking-widest mb-4">
                <span className="material-symbols-outlined text-[18px]">campaign</span>
                <span>C'EST VOTRE TOUR !</span>
              </div>

              <div className="text-xs text-[#d0c5af] font-['JetBrains_Mono'] uppercase tracking-wider mb-1">
                TICKET APPELÉ
              </div>
              <div className="font-['Syne'] text-8xl font-black text-[#f2ca50] drop-shadow-[0_0_25px_rgba(242,202,80,0.6)] mb-2">
                #{trackedTicketNumber}
              </div>

              <div className="text-sm sm:text-base text-white font-medium mb-1">
                Veuillez vous présenter immédiatement au :
              </div>
              <div className="font-['Syne'] text-2xl sm:text-3xl font-extrabold text-[#f2ca50] mb-6">
                {activeCalledTicket?.desk || 'Guichet Principal'}
              </div>

              <div className="p-3 bg-[#0c0e12]/80 border border-[#f2ca50]/30 rounded-xl text-xs text-[#d0c5af]">
                Carillon sonore diffusé • Prise en charge en cours
              </div>
            </div>
          ) : isInQueue ? (
            /* In Queue Waiting State */
            <div className="bg-[#14171d] border border-white/10 rounded-3xl p-7 md:p-8 shadow-2xl flex flex-col items-center text-center">
              {/* Position Header Banner */}
              {peopleAhead === 0 ? (
                <div className="w-full p-4 rounded-2xl bg-[#f2ca50]/15 border border-[#f2ca50]/40 text-[#f2ca50] mb-6 animate-scaleUp">
                  <div className="font-['Syne'] text-base font-bold flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-[20px]">priority_high</span>
                    <span>VOUS ÊTES LE PROCHAIN !</span>
                  </div>
                  <div className="text-xs text-[#d0c5af] mt-0.5">
                    Votre passage est imminent. Tenez-vous prêt face aux guichets.
                  </div>
                </div>
              ) : peopleAhead === 2 ? (
                <div className="w-full p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 mb-6">
                  <div className="font-semibold text-xs flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">notifications_active</span>
                    <span>2 personnes avant vous • Préparez-vous à vous approcher</span>
                  </div>
                </div>
              ) : peopleAhead === 1 ? (
                <div className="w-full p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-300 mb-6">
                  <div className="font-semibold text-xs flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">notifications_active</span>
                    <span>Plus qu'une seule personne avant vous !</span>
                  </div>
                </div>
              ) : null}

              <div className="text-xs font-['JetBrains_Mono'] text-[#a0a6b5] uppercase tracking-wider mb-1">
                Mon Ticket en Suivi
              </div>
              <div className="font-['Syne'] text-6xl md:text-7xl font-extrabold text-white mb-6">
                #{trackedTicketNumber}
              </div>

              {/* Position Grid - Strictly Real Position without any average time estimation */}
              <div className="w-full grid grid-cols-2 gap-3 mb-6">
                <div className="bg-[#1b1f27] border border-white/5 rounded-2xl p-4 flex flex-col items-center">
                  <div className="font-['JetBrains_Mono'] text-3xl font-extrabold text-[#f2ca50]">
                    {peopleAhead}
                  </div>
                  <div className="text-xs text-[#a0a6b5] mt-1">
                    {peopleAhead <= 1 ? 'Personne avant vous' : 'Personnes avant vous'}
                  </div>
                </div>

                <div className="bg-[#1b1f27] border border-white/5 rounded-2xl p-4 flex flex-col items-center">
                  <div className="font-['JetBrains_Mono'] text-3xl font-extrabold text-emerald-400">
                    #{peopleAhead + 1}
                  </div>
                  <div className="text-xs text-[#a0a6b5] mt-1">
                    Position dans la file
                  </div>
                </div>
              </div>

              <div className="text-xs text-[#a0a6b5] leading-relaxed max-w-sm mb-4">
                Cette page s'actualise en temps réel. Vous recevrez une alerte sonore et visuelle dès que votre ticket sera appelé.
              </div>
            </div>
          ) : (
            /* Ticket Not Found in Queue - Exact requirement 13 */
            <div className="bg-[#14171d] border border-white/10 rounded-3xl p-8 text-center flex flex-col items-center">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-[28px]">search_off</span>
              </div>
              <h4 className="font-['Syne'] text-lg font-bold text-white mb-2">
                Ticket introuvable
              </h4>
              <p className="text-sm text-[#f2ca50] font-medium max-w-sm mb-6">
                « Nous n’avons pas pu trouver votre ticket. Veuillez réinitialiser la page. »
              </p>
              <button
                onClick={handleStopTracking}
                className="px-5 py-2.5 rounded-xl bg-[#f2ca50] text-[#3c2f00] font-bold text-xs hover:bg-[#ffe088] transition-colors cursor-pointer"
              >
                Réinitialiser la page
              </button>
            </div>
          )}

          {/* Action Buttons: Changer de Ticket / Arrêter le suivi */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setShowChangeModal(true)}
              className="py-3 bg-[#1e222a] hover:bg-[#252a35] border border-white/10 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px] text-[#f2ca50]">swap_horiz</span>
              <span>Changer de ticket</span>
            </button>

            <button
              onClick={handleStopTracking}
              className="py-3 bg-[#1e222a] hover:bg-[#252a35] border border-white/10 text-[#a0a6b5] hover:text-[#ffb4ab] rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
              <span>Arrêter le suivi</span>
            </button>
          </div>
        </div>
      )}

      {/* Modal: Changer de Ticket (14 -> 13) */}
      {showChangeModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#14171d] border border-[#f2ca50]/40 rounded-2xl p-6 shadow-2xl animate-scaleUp">
            <h3 className="font-['Syne'] text-lg font-bold text-white mb-1">
              Changer de Ticket
            </h3>
            <p className="text-xs text-[#a0a6b5] mb-4">
              Le suivi du Ticket #{trackedTicketNumber} sera immédiatement arrêté au profit du nouveau ticket.
            </p>

            <form onSubmit={handleSwitchTicketSubmit} className="flex flex-col gap-4">
              <input
                type="text"
                maxLength={3}
                value={newTicketInput}
                onChange={(e) => setNewTicketInput(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="Nouveau numéro (1 à 999)"
                className="w-full bg-[#1b1f27] border border-white/10 rounded-xl px-4 py-3 text-center font-['JetBrains_Mono'] text-2xl font-bold text-[#f2ca50] focus:outline-none focus:border-[#f2ca50]"
                autoFocus
                required
              />

              <div className="grid grid-cols-2 gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setShowChangeModal(false)}
                  className="py-2.5 bg-[#1b1f27] hover:bg-[#252a35] text-[#a0a6b5] rounded-xl text-xs"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="py-2.5 bg-[#f2ca50] hover:bg-[#ffe088] text-[#3c2f00] font-bold rounded-xl text-xs shadow"
                >
                  Valider
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
