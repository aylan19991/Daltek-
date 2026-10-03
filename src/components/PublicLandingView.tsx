import React, { useState, useEffect } from 'react';
import { TabType, Establishment } from '../types';
import { ChatbotAide } from './ChatbotAide';

interface PublicLandingViewProps {
  onNavigate: (tab: TabType, establishment?: Establishment) => void;
  establishments: Establishment[];
  isOnline: boolean;
  onShowToast: (msg: string) => void;
}

export const PublicLandingView: React.FC<PublicLandingViewProps> = ({
  onNavigate,
  establishments,
  isOnline,
  onShowToast,
}) => {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [userPlatformLabel, setUserPlatformLabel] = useState<string>('Natif');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ua = navigator.userAgent.toLowerCase();
    const plat = (navigator as any).userAgentData?.platform?.toLowerCase() || navigator.platform.toLowerCase();
    if (/android/i.test(ua)) {
      setUserPlatformLabel('Android');
    } else if (/iphone|ipad|ipod/i.test(ua) || (plat.includes('mac') && navigator.maxTouchPoints > 1)) {
      setUserPlatformLabel('iOS');
    } else if (/win/i.test(plat) || /windows/i.test(ua)) {
      setUserPlatformLabel('Windows');
    } else if (/mac/i.test(plat) || /macintosh/i.test(ua)) {
      setUserPlatformLabel('macOS');
    }
  }, []);

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col items-center gap-10 py-4 animate-fadeIn font-['Outfit']">
      {/* Hero Header */}
      <div className="text-center flex flex-col items-center max-w-3xl">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#1e2024] border border-[#f2ca50]/30 shadow-inner mb-5">
          <span className="w-2 h-2 rounded-full bg-[#f2ca50] animate-pulse" />
          <span className="font-['JetBrains_Mono'] text-[11px] text-[#f2ca50] tracking-widest uppercase font-semibold">
            DALTEK • Gestion des files d’attente
          </span>
        </div>

        <h1 className="font-['Syne'] text-4xl sm:text-6xl font-extrabold text-white tracking-tight mb-3 leading-tight">
          DAL<span className="text-[#f2ca50]">TEK</span>
        </h1>

        <p className="font-['Outfit'] text-lg sm:text-2xl text-[#d0c5af] font-light mb-3">
          Gestion universelle des files d’attente pour tous les établissements
        </p>

        <p className="font-['Outfit'] text-xs sm:text-sm text-[#a0a6b5] max-w-2xl leading-relaxed mb-6">
          Une plateforme conçue pour garantir la sérénité des flux d'accueil dans tous les secteurs :
          banques, hôpitaux, restaurants, administrations, magasins et services.
        </p>

        {/* Action Buttons Row: INSTALLER DALTEK & ? Aide DALTEK */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          {/* Main Native Install Button */}
          <button
            type="button"
            onClick={() => onNavigate('installer-daltek')}
            className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#f2ca50] via-[#ffd56b] to-[#e5be42] hover:from-[#ffe17d] hover:to-[#f2ca50] text-[#3c2f00] font-['Syne'] font-extrabold text-xs sm:text-sm tracking-wide transition-all shadow-[0_4px_20px_rgba(242,202,80,0.25)] hover:shadow-[0_6px_25px_rgba(242,202,80,0.4)] hover:scale-105 active:scale-95 cursor-pointer group"
            title="Installer les applications DALTEK (WebAPK, Android APK, Windows, macOS, iOS)"
          >
            <span className="material-symbols-outlined text-[19px] group-hover:-translate-y-0.5 transition-transform">
              install_mobile
            </span>
            <span>INSTALLER DALTEK</span>
            <span className="text-[10px] font-['JetBrains_Mono'] px-1.5 py-0.5 rounded bg-[#3c2f00]/15 text-[#3c2f00] font-bold uppercase tracking-wider">
              {userPlatformLabel}
            </span>
          </button>

          {/* Aide Button in Hero Header */}
          <button
            type="button"
            onClick={() => setIsChatOpen(true)}
            className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-[#1b1f27] hover:bg-[#252a35] border border-[#f2ca50]/50 hover:border-[#f2ca50] text-[#f2ca50] hover:text-white transition-all shadow-md cursor-pointer group text-xs sm:text-sm font-semibold"
            title="Ouvrir le chatbot d'aide DALTEK"
          >
            <span className="w-5 h-5 rounded-lg bg-[#f2ca50] text-[#3c2f00] flex items-center justify-center font-bold text-xs">
              ?
            </span>
            <span>? Aide DALTEK</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          </button>
        </div>
      </div>

      {/* Main 2 Primary Action Portals (Simplified Accueil) */}
      <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Portal 1: Suivre mon ticket (Client) */}
        <div
          onClick={() => onNavigate('suivi-client-mobile')}
          className="group relative bg-[#14171d] hover:bg-[#191d24] border border-white/10 hover:border-[#f2ca50]/50 rounded-2xl p-7 sm:p-8 transition-all duration-300 cursor-pointer shadow-xl flex flex-col justify-between overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#f2ca50]/5 rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform" />
          <div>
            <div className="w-14 h-14 rounded-2xl bg-[#1e222a] border border-[#f2ca50]/20 flex items-center justify-center mb-5 group-hover:border-[#f2ca50]/60 transition-colors">
              <span className="material-symbols-outlined text-[#f2ca50] text-[30px]">smartphone</span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className="font-['JetBrains_Mono'] text-[11px] text-[#f2ca50] tracking-widest uppercase font-semibold">
                Accès Visiteur Libre
              </span>
            </div>
            <h3 className="font-['Syne'] text-2xl font-bold text-white mb-2 group-hover:text-[#f2ca50] transition-colors">
              Suivre mon ticket
            </h3>
            <p className="font-['Outfit'] text-sm text-[#a0a6b5] leading-relaxed mb-6">
              Sans compte ni application. Entrez votre numéro ou scannez le QR code de la salle d’attente pour suivre votre rang en temps réel.
            </p>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-white/5">
            <span className="font-['Outfit'] text-xs font-medium text-[#d0c5af]">
              Consulter mon rang en direct
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#1e2024] group-hover:bg-[#f2ca50] group-hover:text-[#3c2f00] flex items-center justify-center text-white transition-colors">
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </div>
          </div>
        </div>

        {/* Portal 2: Se connecter — Staff (Personnel) */}
        <div
          onClick={() => onNavigate('connexion-etablissement')}
          className="group relative bg-[#14171d] hover:bg-[#191d24] border border-white/10 hover:border-[#f2ca50]/50 rounded-2xl p-7 sm:p-8 transition-all duration-300 cursor-pointer shadow-xl flex flex-col justify-between overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#f2ca50]/5 rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform" />
          <div>
            <div className="w-14 h-14 rounded-2xl bg-[#1e222a] border border-[#f2ca50]/20 flex items-center justify-center mb-5 group-hover:border-[#f2ca50]/60 transition-colors">
              <span className="material-symbols-outlined text-[#f2ca50] text-[30px]">badge</span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className="font-['JetBrains_Mono'] text-[11px] text-[#f2ca50] tracking-widest uppercase font-semibold">
                Guichets & Opérateurs
              </span>
            </div>
            <h3 className="font-['Syne'] text-2xl font-bold text-white mb-2 group-hover:text-[#f2ca50] transition-colors">
              Se connecter — Staff
            </h3>
            <p className="font-['Outfit'] text-sm text-[#a0a6b5] leading-relaxed mb-6">
              Espace réservé au personnel. Saisissez votre Code Staff pour accéder directement à la console d'appel de votre établissement.
            </p>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-white/5">
            <span className="font-['Outfit'] text-xs font-medium text-[#d0c5af]">
              Accéder à mon guichet
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#1e2024] group-hover:bg-[#f2ca50] group-hover:text-[#3c2f00] flex items-center justify-center text-white transition-colors">
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Action Button for Chatbot in bottom right corner */}
      <button
        type="button"
        onClick={() => setIsChatOpen(true)}
        className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-40 px-3.5 sm:px-4 py-2.5 rounded-full bg-[#1b1f27]/95 hover:bg-[#232834] border border-[#f2ca50]/50 hover:border-[#f2ca50] text-white font-['Outfit'] text-xs font-bold shadow-[0_8px_30px_rgba(0,0,0,0.7)] flex items-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer backdrop-blur-md group"
        title="Ouvrir l'assistant d'aide DALTEK"
      >
        <span className="w-5 h-5 rounded-full bg-[#f2ca50] text-[#3c2f00] flex items-center justify-center font-bold text-xs shadow-sm">
          ?
        </span>
        <span className="text-[#f2ca50] group-hover:text-white transition-colors">? Aide DALTEK</span>
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
      </button>

      {/* Chatbot Aide Component Drawer */}
      <ChatbotAide
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
      />
    </div>
  );
};
