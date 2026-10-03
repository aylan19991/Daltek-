import React, { useState, useEffect, useCallback } from 'react';
import { TabType, Establishment, OperatorAccount, QueueTicket, AuditEvent, AuthSession } from './types';
import {
  fetchEstablishments,
  fetchOperators,
  fetchAuditLogs,
  fetchQueue,
  fetchCurrentSession,
  logout,
  clearStoredToken,
} from './utils/api';
import { useRealtime } from './utils/useRealtime';
import { announceTicketCall, playLuxuryChime } from './utils/audio';

import { PublicLandingView } from './components/PublicLandingView';
import { ConnexionEtablissementView } from './components/ConnexionEtablissementView';
import { AdministrationCentraleView } from './components/AdministrationCentraleView';
import { ConsolePersonnelView } from './components/ConsolePersonnelView';
import { AffichageEcranTvView } from './components/AffichageEcranTvView';
import { SuiviClientMobileView } from './components/SuiviClientMobileView';
import { InstallerDaltekView } from './components/InstallerDaltekView';

const DEFAULT_ESTABLISHMENT: Establishment = {
  id: '',
  code: '',
  slug: '',
  name: 'Aucun établissement configuré',
  location: '',
  contract: '',
  counters: 0,
  counterLabel: 'Guichets',
  operators: 0,
  activeQueueCount: 0,
  lastCallText: '',
  icon: 'apartment',
  isContractActive: false,
};

export default function App() {
  // Navigation & Space
  const [activeTab, setActiveTab] = useState<TabType>('accueil');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Core Data
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [selectedEstablishment, setSelectedEstablishment] = useState<Establishment>(DEFAULT_ESTABLISHMENT);
  const [operators, setOperators] = useState<OperatorAccount[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEvent[]>([]);

  // Queue state for active establishment
  const [queue, setQueue] = useState<QueueTicket[]>([]);
  const [activeCalledTicket, setActiveCalledTicket] = useState<QueueTicket | null>(null);

  // Authentication & Session
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(false);
  const [currentStaffOperator, setCurrentStaffOperator] = useState<OperatorAccount | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(false);

  // Toast notification helper
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 4000);
  }, []);

  // 1. Initial Load: Fetch establishments, operators, session, and parse URL query params
  useEffect(() => {
    const initApp = async () => {
      try {
        // Fetch session
        const session: AuthSession = await fetchCurrentSession();
        if (session.role === 'admin') {
          setIsAdminLoggedIn(true);
        } else if (session.role === 'staff' && session.operator) {
          setCurrentStaffOperator(session.operator);
          if (session.establishment) {
            setSelectedEstablishment(session.establishment);
          }
        }

        // Fetch establishments from authoritative backend
        const estList = await fetchEstablishments();
        setIsOnline(true);
        if (estList.length > 0) {
          setEstablishments(estList);

          // Check URL query params for initial route / establishment code
          const params = new URLSearchParams(window.location.search);
          const estCodeParam = params.get('est');
          const tabParam = params.get('tab');

          let targetEst = session.role === 'staff' && session.establishment ? session.establishment : estList[0];
          if (session.role !== 'staff' && estCodeParam) {
            const found = estList.find(
              (e) =>
                (e.code && e.code.toUpperCase() === estCodeParam.toUpperCase()) ||
                e.id.replace('#', '').toUpperCase() === estCodeParam.toUpperCase()
            );
            if (found) targetEst = found;
            else targetEst = DEFAULT_ESTABLISHMENT;
          }
          setSelectedEstablishment(targetEst);

          if (session.role === 'staff') {
            setActiveTab('console-personnel');
          } else if (tabParam) {
            if (tabParam === 'tv' || tabParam === 'affichage-ecran-tv') {
              setActiveTab('affichage-ecran-tv');
            } else if (tabParam === 'suivi' || tabParam === 'suivi-client' || tabParam === 'suivi-client-mobile') {
              setActiveTab('suivi-client-mobile');
            } else if (tabParam === 'console' || tabParam === 'console-personnel') {
              setActiveTab('console-personnel');
            } else if (tabParam === 'admin' || tabParam === 'administration-centrale') {
              setActiveTab('administration-centrale');
            } else if (tabParam === 'connexion-etablissement') {
              setActiveTab('connexion-etablissement');
            }
          }
        }

        // Fetch operators & audit
        const [ops, logs] = await Promise.all([
          fetchOperators().catch(() => []),
          fetchAuditLogs().catch(() => []),
        ]);
        setOperators(ops);
        setAuditLogs(logs);
      } catch (err) {
        console.error('Initialization error:', err);
        setIsOnline(false);
      }
    };

    initApp();
  }, []);

  // 2. Fetch queue when selected establishment changes
  useEffect(() => {
    if (!selectedEstablishment?.id) return;

    fetchQueue(selectedEstablishment.id)
      .then((data) => {
        setQueue(data.queue || []);
        setActiveCalledTicket(data.activeCalledTicket || null);
      })
      .catch((err) => {
        console.error('Error fetching queue:', err);
      });
  }, [selectedEstablishment?.id]);

  // 3. Realtime SSE Connection for Selected Establishment
  useRealtime(selectedEstablishment?.id, {
    onQueueUpdate: (newQueue, activeTicket) => {
      setQueue(newQueue);
      if (activeTicket !== undefined) {
        setActiveCalledTicket(activeTicket);
      }
    },
    onTicketCalled: (calledTicket, newQueue) => {
      setActiveCalledTicket(calledTicket);
      setQueue(newQueue);
      if (calledTicket?.id) {
        announceTicketCall(calledTicket.id, calledTicket.desk);
      }
    },
    onEstablishmentUpdate: (updatedEst) => {
      const prevId = (updatedEst as any).previousId;
      setSelectedEstablishment((prev) => (prev && (prev.id === updatedEst.id || prev.id === prevId) ? updatedEst : prev));
      setEstablishments((prev) => prev.map((e) => (e.id === updatedEst.id || e.id === prevId ? updatedEst : e)));
    },
    onStatusChange: (online) => {
      setIsOnline(online);
    },
  });

  // Navigation Helper
  const navigateTo = (tab: TabType, targetEst?: Establishment) => {
    if (currentStaffOperator && targetEst && targetEst.id !== currentStaffOperator.establishmentId) {
      showToast('Accès limité à votre établissement');
      return;
    }
    if (targetEst) {
      setSelectedEstablishment(targetEst);
    }
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Staff Login Success Handler
  const handleStaffLoginSuccess = (operator: OperatorAccount, est: Establishment) => {
    setCurrentStaffOperator(operator);
    setSelectedEstablishment(est);
    setActiveTab('console-personnel');
  };

  // Logout Handler
  const handleLogout = async () => {
    await logout();
    clearStoredToken();
    setIsAdminLoggedIn(false);
    setCurrentStaffOperator(null);
    showToast('Session fermée avec succès');
    setActiveTab('accueil');
  };

  return (
    <div className="min-h-screen bg-[#0c0e12] text-white flex flex-col font-['Outfit'] selection:bg-[#f2ca50] selection:text-[#3c2f00]">
      {/* Toast Notification Container */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-[9999] max-w-md bg-[#1e222a] border border-[#f2ca50]/50 text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-slideDown">
          <span className="material-symbols-outlined text-[#f2ca50] text-[22px]">info</span>
          <span className="text-xs sm:text-sm font-medium leading-snug">{toastMessage}</span>
        </div>
      )}

      {/* Main Global Navigation (Hidden when in Fullscreen TV Mode) */}
      {activeTab !== 'affichage-ecran-tv' && (
        <header className="sticky top-0 z-40 bg-[#0c0e12]/90 backdrop-blur-md border-b border-white/10 px-4 sm:px-8 py-3.5">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            {/* Brand Logo & Name */}
            <div
              onClick={() => navigateTo('accueil')}
              className="flex items-center gap-3 cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-xl bg-[#0c0e12] border border-[#f2ca50]/40 flex items-center justify-center shadow-md group-hover:border-[#f2ca50] transition-colors overflow-hidden">
                <img src="/daltek-logo.png" alt="DALTEK" className="w-full h-full object-contain p-0.5 rounded-xl" />
              </div>
              <div className="flex flex-col">
                <span className="font-['Syne'] text-xl font-extrabold tracking-tight text-white leading-none">
                  DAL<span className="text-[#f2ca50]">TEK</span>
                </span>
                <span className="font-['JetBrains_Mono'] text-[9px] text-[#a0a6b5] tracking-widest uppercase">
                  Gestion de file DALTEK
                </span>
              </div>
            </div>

            {/* Middle Nav Links */}
            <nav className="hidden lg:flex items-center gap-1 bg-[#14171d] p-1 rounded-xl border border-white/5 text-xs font-medium">
              <button
                onClick={() => navigateTo('accueil')}
                className={`px-3.5 py-2 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'accueil'
                    ? 'bg-[#f2ca50] text-[#3c2f00] font-bold'
                    : 'text-[#a0a6b5] hover:text-white'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">home</span>
                <span>Accueil</span>
              </button>

              <button
                onClick={() => navigateTo('connexion-etablissement')}
                className={`px-3.5 py-2 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'connexion-etablissement' || activeTab === 'console-personnel'
                    ? 'bg-[#f2ca50] text-[#3c2f00] font-bold'
                    : 'text-[#a0a6b5] hover:text-white'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">badge</span>
                <span>
                  {currentStaffOperator ? `Guichet (${currentStaffOperator.name})` : 'Connexion Établissement'}
                </span>
              </button>

              <button
                onClick={() => navigateTo('suivi-client-mobile')}
                className={`px-3.5 py-2 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'suivi-client-mobile'
                    ? 'bg-[#f2ca50] text-[#3c2f00] font-bold'
                    : 'text-[#a0a6b5] hover:text-white'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">smartphone</span>
                <span>Suivre un ticket</span>
              </button>

              <button
                onClick={() => navigateTo('affichage-ecran-tv')}
                className="px-3.5 py-2 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 text-[#a0a6b5] hover:text-white"
              >
                <span className="material-symbols-outlined text-[16px]">tv</span>
                <span>Écran TV</span>
              </button>

              <button
                onClick={() => navigateTo('installer-daltek')}
                className={`px-3.5 py-2 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'installer-daltek'
                    ? 'bg-[#f2ca50] text-[#3c2f00] font-bold'
                    : 'text-[#f2ca50] hover:bg-[#f2ca50]/10'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">install_mobile</span>
                <span>Installer DALTEK</span>
              </button>

              <button
                onClick={() => navigateTo('administration-centrale')}
                className={`px-3.5 py-2 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'administration-centrale'
                    ? 'bg-[#f2ca50] text-[#3c2f00] font-bold'
                    : 'text-[#a0a6b5] hover:text-white'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">shield_person</span>
                <span>Administration</span>
              </button>
            </nav>

            {/* Right Status & Active Establishment Dropdown */}
            <div className="flex items-center gap-3">
              {/* Active Establishment Selector Pill */}
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#14171d] border border-white/10 text-xs">
                {selectedEstablishment.logoUrl ? (
                  <img
                    src={selectedEstablishment.logoUrl}
                    alt={selectedEstablishment.name}
                    className="w-4 h-4 object-contain rounded"
                  />
                ) : (
                  <span className="material-symbols-outlined text-[#f2ca50] text-[16px]">
                    {selectedEstablishment.icon || 'apartment'}
                  </span>
                )}
                <select
                  disabled={!!currentStaffOperator}
                  value={selectedEstablishment.id}
                  onChange={(e) => {
                    const found = establishments.find((est) => est.id === e.target.value);
                    if (found) setSelectedEstablishment(found);
                  }}
                  className="bg-transparent text-white font-medium text-xs focus:outline-none cursor-pointer"
                >
                  {(currentStaffOperator ? establishments.filter((est) => est.id === currentStaffOperator.establishmentId) : establishments).map((est) => (
                    <option key={est.id} value={est.id} className="bg-[#14171d] text-white">
                      {est.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Online / Realtime Status indicator */}
              <div
                title={isOnline ? 'Connexion serveur active' : 'Connexion hors-ligne'}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#14171d] border border-white/5"
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                  }`}
                />
                <span className="font-['JetBrains_Mono'] text-[10px] text-[#a0a6b5] hidden md:inline">
                  {isOnline ? 'SERVEUR OK' : 'OFFLINE'}
                </span>
              </div>

              {/* Quick Logout if Logged In */}
              {(isAdminLoggedIn || currentStaffOperator) && (
                <button
                  onClick={handleLogout}
                  title="Déconnexion"
                  className="p-2 rounded-xl bg-[#93000a]/20 hover:bg-[#93000a]/30 text-[#ffb4ab] border border-[#ffb4ab]/20 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">logout</span>
                </button>
              )}
            </div>
          </div>

          {/* Mobile Tab Navigation Bar */}
          <div className="flex lg:hidden items-center justify-around gap-1 mt-3 pt-2 border-t border-white/5 overflow-x-auto text-[11px]">
            <button
              onClick={() => navigateTo('accueil')}
              className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1 ${
                activeTab === 'accueil' ? 'bg-[#f2ca50] text-[#3c2f00] font-bold' : 'text-[#a0a6b5]'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">home</span>
              <span>Accueil</span>
            </button>
            <button
              onClick={() => navigateTo('connexion-etablissement')}
              className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1 ${
                activeTab === 'connexion-etablissement' || activeTab === 'console-personnel'
                  ? 'bg-[#f2ca50] text-[#3c2f00] font-bold'
                  : 'text-[#a0a6b5]'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">badge</span>
              <span>Guichet</span>
            </button>
            <button
              onClick={() => navigateTo('suivi-client-mobile')}
              className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1 ${
                activeTab === 'suivi-client-mobile' ? 'bg-[#f2ca50] text-[#3c2f00] font-bold' : 'text-[#a0a6b5]'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">smartphone</span>
              <span>Suivi</span>
            </button>
            <button
              onClick={() => navigateTo('affichage-ecran-tv')}
              className="px-2.5 py-1.5 rounded-lg flex items-center gap-1 text-[#a0a6b5] hover:text-white"
            >
              <span className="material-symbols-outlined text-[15px]">tv</span>
              <span>TV</span>
            </button>
            <button
              onClick={() => navigateTo('installer-daltek')}
              className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1 ${
                activeTab === 'installer-daltek' ? 'bg-[#f2ca50] text-[#3c2f00] font-bold' : 'text-[#f2ca50]'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">install_mobile</span>
              <span>Installer</span>
            </button>
            <button
              onClick={() => navigateTo('administration-centrale')}
              className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1 ${
                activeTab === 'administration-centrale' ? 'bg-[#f2ca50] text-[#3c2f00] font-bold' : 'text-[#a0a6b5]'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">shield_person</span>
              <span>Admin</span>
            </button>
          </div>
        </header>
      )}

      {/* Main Dynamic View Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-8 py-6">
        {activeTab === 'accueil' && (
          <PublicLandingView
            onNavigate={navigateTo}
            establishments={establishments}
            isOnline={isOnline}
            onShowToast={showToast}
          />
        )}

        {activeTab === 'connexion-etablissement' && (
          <ConnexionEtablissementView
            establishments={establishments}
            selectedEstablishment={selectedEstablishment}
            setSelectedEstablishment={setSelectedEstablishment}
            onLoginSuccess={handleStaffLoginSuccess}
            onNavigate={navigateTo}
            onShowToast={showToast}
          />
        )}

        {activeTab === 'console-personnel' && (
          <ConsolePersonnelView
            establishment={selectedEstablishment}
            operator={currentStaffOperator}
            queue={queue}
            setQueue={setQueue}
            activeCalledTicket={activeCalledTicket}
            setActiveCalledTicket={setActiveCalledTicket}
            isOnline={isOnline}
            setIsOnline={setIsOnline}
            onNavigate={navigateTo}
            onShowToast={showToast}
          />
        )}

        {activeTab === 'affichage-ecran-tv' && (
          <AffichageEcranTvView
            establishment={selectedEstablishment}
            queue={queue}
            setQueue={setQueue}
            activeCalledTicket={activeCalledTicket}
            setActiveCalledTicket={setActiveCalledTicket}
            onNavigate={navigateTo}
            onShowToast={showToast}
          />
        )}

        {activeTab === 'suivi-client-mobile' && (
          <SuiviClientMobileView
            establishment={selectedEstablishment}
            queue={queue}
            activeCalledTicket={activeCalledTicket}
            onNavigate={navigateTo}
            onShowToast={showToast}
          />
        )}

        {activeTab === 'installer-daltek' && (
          <InstallerDaltekView
            onNavigate={navigateTo}
            onShowToast={showToast}
          />
        )}

        {activeTab === 'administration-centrale' && (
          <AdministrationCentraleView
            establishments={establishments}
            setEstablishments={setEstablishments}
            selectedEstablishment={selectedEstablishment}
            setSelectedEstablishment={setSelectedEstablishment}
            operators={operators}
            setOperators={setOperators}
            auditLogs={auditLogs}
            setAuditLogs={setAuditLogs}
            isAdminLoggedIn={isAdminLoggedIn}
            setIsAdminLoggedIn={setIsAdminLoggedIn}
            onNavigate={navigateTo}
            onShowToast={showToast}
          />
        )}
      </main>

      {/* Global Footer (Hidden in TV Mode) */}
      {activeTab !== 'affichage-ecran-tv' && (
        <footer className="w-full border-t border-white/5 py-6 px-4 sm:px-8 mt-auto bg-[#0a0c0f]">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#a0a6b5]">
            <div className="flex items-center gap-2">
              <span className="font-['Syne'] font-bold text-white">DALTEK</span>
              <span>• Système Universel d'Orchestration & Files d'Attente</span>
            </div>
            <div className="flex items-center gap-4 text-[11px] font-['JetBrains_Mono']">
              <span>Chiffrement PBKDF2</span>
              <span>•</span>
              <span>Isolation Multi-Établissements</span>
              <span>•</span>
              <span>Synchronisation par événements SSE</span>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
