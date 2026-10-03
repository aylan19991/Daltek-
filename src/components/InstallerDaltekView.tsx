import React, { useState, useEffect } from 'react';
import { TabType } from '../types';

interface InstallerDaltekViewProps {
  onNavigate: (tab: TabType) => void;
  onShowToast: (msg: string) => void;
}

interface PlatformFileItem {
  status: 'DISPONIBLE' | 'EN_PREPARATION' | 'NON_SIGNE' | 'NON_DISPONIBLE';
  label: string;
  name: string;
  exists?: boolean;
  size?: string | null;
  url?: string | null;
  description: string;
  available?: boolean;
}

interface PlatformsStatus {
  version: string;
  releaseDate: string;
  android: {
    webApk: PlatformFileItem;
    apk: PlatformFileItem;
    projectZip: PlatformFileItem;
  };
  windows: {
    exe: PlatformFileItem;
    msi?: PlatformFileItem;
    projectZip: PlatformFileItem;
  };
  macos: {
    dmg: PlatformFileItem;
    projectZip: PlatformFileItem;
  };
  ios: {
    appStore: PlatformFileItem;
    projectZip: PlatformFileItem;
  };
}

export const InstallerDaltekView: React.FC<InstallerDaltekViewProps> = ({
  onNavigate,
  onShowToast,
}) => {
  const [detectedOS, setDetectedOS] = useState<'android' | 'windows' | 'macos' | 'ios'>('android');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallablePWA, setIsInstallablePWA] = useState<boolean>(false);
  const [isPwaInstalled, setIsPwaInstalled] = useState<boolean>(false);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);

  // Platform server-verified files status (default strictly reflects genuine disk availability)
  const [status, setStatus] = useState<PlatformsStatus>({
    version: '1.2.0',
    releaseDate: '2026-09-26',
    android: {
      webApk: {
        status: 'DISPONIBLE',
        label: '✓ DISPONIBLE',
        name: 'DALTEK Web App / WebAPK',
        description: 'Installation instantanée Google Chrome / Android',
        available: true,
      },
      apk: {
        status: 'EN_PREPARATION',
        label: '⏳ EN PRÉPARATION',
        name: 'DALTEK-Android.apk',
        exists: false,
        size: null,
        url: null,
        description: 'Build Release Gradle signé en cours de pipeline CI/CD',
      },
      projectZip: {
        status: 'DISPONIBLE',
        label: '✓ DISPONIBLE',
        name: 'DALTEK-Android.zip',
        exists: true,
        size: '147 Ko',
        url: '/api/download/DALTEK-Android.zip',
        description: 'Projet complet compilable Android Studio (Kotlin & Gradle)',
      },
    },
    windows: {
      exe: {
        status: 'EN_PREPARATION',
        label: '⏳ EN PRÉPARATION',
        name: 'DALTEK-Windows.exe',
        exists: false,
        size: null,
        url: null,
        description: 'Exécutable natif C# WinUI / .NET 8 (Signature Authenticode requise pour SmartScreen)',
      },
      projectZip: {
        status: 'DISPONIBLE',
        label: '✓ DISPONIBLE',
        name: 'DALTEK-Windows.zip',
        exists: true,
        size: '57 Ko',
        url: '/api/download/DALTEK-Windows.zip',
        description: 'Solution Visual Studio .NET 8 / WPF C# avec script de signature Authenticode',
      },
    },
    macos: {
      dmg: {
        status: 'EN_PREPARATION',
        label: '⏳ EN PRÉPARATION',
        name: 'DALTEK-macOS.dmg',
        exists: false,
        size: null,
        url: null,
        description: 'Image disque universelle (Apple Silicon & Intel) en préparation de notarisation',
      },
      projectZip: {
        status: 'DISPONIBLE',
        label: '✓ DISPONIBLE',
        name: 'DALTEK-macOS.zip',
        exists: true,
        size: '139 Ko',
        url: '/api/download/DALTEK-macOS.zip',
        description: 'Projet Xcode natif macOS Swift & SwiftUI prêt à être compilé',
      },
    },
    ios: {
      appStore: {
        status: 'EN_PREPARATION',
        label: '⏳ EN PRÉPARATION',
        name: 'App Store / TestFlight',
        exists: false,
        size: null,
        url: null,
        description: 'Publication officielle Apple en cours de soumission',
      },
      projectZip: {
        status: 'DISPONIBLE',
        label: '✓ DISPONIBLE',
        name: 'DALTEK-iOS.zip',
        exists: true,
        size: '369 Ko',
        url: '/api/download/DALTEK-iOS.zip',
        description: 'Projet Xcode Swift 5.9 & SwiftUI prêt à être compilé',
      },
    },
  });

  // OS detection
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ua = navigator.userAgent.toLowerCase();
    const platform = (navigator as any).userAgentData?.platform?.toLowerCase() || navigator.platform.toLowerCase();

    if (/android/i.test(ua)) {
      setDetectedOS('android');
    } else if (/iphone|ipad|ipod/i.test(ua) || (platform.includes('mac') && navigator.maxTouchPoints > 1)) {
      setDetectedOS('ios');
    } else if (/mac/i.test(platform) || /macintosh/i.test(ua)) {
      setDetectedOS('macos');
    } else if (/win/i.test(platform) || /windows/i.test(ua)) {
      setDetectedOS('windows');
    }

    // Check PWA display mode
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsPwaInstalled(true);
    }

    // PWA beforeinstallprompt handler
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallablePWA(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  // Fetch real file statuses from server
  useEffect(() => {
    fetch('/api/platforms/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.android) {
          setStatus(data);
        }
      })
      .catch((err) => {
        console.warn('Could not load /api/platforms/status:', err);
      });
  }, []);

  // Handle direct file download
  const handleDownload = (url: string | null | undefined, fileName: string) => {
    if (!url) return;
    setDownloadingFile(fileName);
    onShowToast(`Téléchargement de ${fileName} en cours...`);

    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', fileName);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => {
      setDownloadingFile(null);
    }, 1500);
  };

  // Trigger PWA installation
  const handleInstallPWA = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        onShowToast('Installation de DALTEK Web App acceptée !');
        setIsPwaInstalled(true);
      }
      setDeferredPrompt(null);
      setIsInstallablePWA(false);
    } else {
      // Fallback instruction toast
      onShowToast("Pour installer sur Android : Ouvrez le menu de votre navigateur (⋮) puis sélectionnez « Ajouter à l'écran d'accueil » ou « Installer l'application ».");
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col gap-10 animate-fadeIn font-['Outfit'] pb-20">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-[#161a22] to-[#0e1117] border border-[#f2ca50]/25 p-8 sm:p-12 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#f2ca50]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex flex-col items-center md:items-start text-center md:text-left gap-4 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#f2ca50]/10 border border-[#f2ca50]/30 text-[#f2ca50] text-xs font-semibold tracking-wide">
              <span className="w-2 h-2 rounded-full bg-[#f2ca50] animate-pulse" />
              CENTRE DE DISTRIBUTION OFFICIEL DALTEK
            </div>

            <h1 className="font-['Syne'] text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
              INSTALLER <span className="text-[#f2ca50]">DALTEK</span>
            </h1>

            <p className="text-base sm:text-lg text-[#c5c8d4] font-medium leading-relaxed">
              « Utilisez DALTEK sur votre appareil avec la version adaptée à votre plateforme. »
            </p>

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-2">
              <div className="px-3 py-1.5 rounded-xl bg-black/40 border border-white/10 text-xs text-[#a0a6b5] flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-emerald-400">devices</span>
                <span>Votre appareil détecté : <strong className="text-white capitalize">{detectedOS}</strong></span>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-black/40 border border-white/10 text-xs text-[#a0a6b5] flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-[#f2ca50]">verified</span>
                <span>Version officielle : <strong className="text-white">DALTEK {status.version}</strong></span>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-black/40 border border-white/10 text-xs text-[#a0a6b5] flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-sky-400">cloud_sync</span>
                <span>Backend unifié temps réel</span>
              </div>
            </div>
          </div>

          {/* Master Emblem Preview */}
          <div className="relative group shrink-0">
            <div className="w-40 h-40 sm:w-48 sm:h-48 rounded-3xl bg-[#0c0e12] border-2 border-[#f2ca50]/40 p-3 shadow-2xl flex items-center justify-center">
              <img
                src="/daltek-logo.png"
                alt="Logo officiel DALTEK"
                className="w-full h-full object-contain rounded-2xl drop-shadow-[0_10px_20px_rgba(242,202,80,0.25)]"
              />
            </div>
            <div className="absolute -bottom-3 inset-x-0 mx-auto w-max px-3 py-1 rounded-full bg-[#f2ca50] text-[#07090d] text-[11px] font-bold tracking-wider uppercase shadow-md">
              DALTEK CORE
            </div>
          </div>
        </div>
      </div>

      {/* Grid of Platforms */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* =========================================
            1. ANDROID
        ========================================= */}
        <div
          className={`flex flex-col rounded-3xl bg-[#14171e] border ${
            detectedOS === 'android' ? 'border-[#3ddc84]/50 shadow-[0_0_30px_rgba(61,220,132,0.15)] ring-1 ring-[#3ddc84]/40' : 'border-white/10'
          } p-6 sm:p-8 relative overflow-hidden transition-all duration-300`}
        >
          {detectedOS === 'android' && (
            <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-[#3ddc84]/20 border border-[#3ddc84]/40 text-[#3ddc84] text-[11px] font-bold tracking-wide uppercase">
              Recommandé pour cet appareil
            </div>
          )}

          {/* Platform Header */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-[#3ddc84]/10 border border-[#3ddc84]/30 flex items-center justify-center text-[#3ddc84] shadow-inner shrink-0">
              <span className="material-symbols-outlined text-[32px]">android</span>
            </div>
            <div>
              <h2 className="font-['Syne'] text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                ANDROID
              </h2>
              <p className="text-xs text-[#a0a6b5]">
                Pour smartphones, tablettes de guichet et bornes d'accueil Android
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-5 flex-1">
            {/* 2A. WebAPK / Web App */}
            <div className="p-4 rounded-2xl bg-[#1a1e27] border border-white/5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#3ddc84] text-[20px]">language</span>
                  <h3 className="font-['Syne'] text-sm font-bold text-white uppercase tracking-wider">
                    Web App / WebAPK
                  </h3>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {status.android.webApk.label}
                </span>
              </div>
              <p className="text-xs text-[#c5c8d4] leading-relaxed">
                Installation directe via Google Chrome ou navigateur Android compatible. Génère automatiquement le WebAPK officiel avec icône dorée DALTEK, fonctionnement hors-ligne et notifications push synchronisées.
              </p>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-[#8e95a5]">Sans téléchargement de fichier APK externe</span>
                <button
                  onClick={handleInstallPWA}
                  className="px-4 py-2 rounded-xl bg-[#3ddc84] hover:bg-[#34c776] text-[#07090d] text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">install_mobile</span>
                  <span>{isPwaInstalled ? 'Application Déjà Installée' : 'Installer Web App / WebAPK'}</span>
                </button>
              </div>
            </div>

            {/* 2B. APK Android Natif */}
            <div className="p-4 rounded-2xl bg-[#1a1e27] border border-white/5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#f2ca50] text-[20px]">apk_install</span>
                  <h3 className="font-['Syne'] text-sm font-bold text-white uppercase tracking-wider">
                    APK Android Natif
                  </h3>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  status.android.apk.exists
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}>
                  {status.android.apk.exists ? '✓ DISPONIBLE' : '⏳ EN PRÉPARATION'}
                </span>
              </div>
              <p className="text-xs text-[#c5c8d4] leading-relaxed">
                Package APK compilé pour déploiement direct sans passer par le Play Store. Package officiel <code className="text-[#a0a6b5] font-mono text-[11px]">com.daltek.app</code> (Android 7.0+ à Android 15+).
              </p>
              <div className="flex items-center justify-between pt-1 text-xs text-[#8e95a5]">
                {status.android.apk.exists ? (
                  <>
                    <span>Taille : <strong className="text-white">{status.android.apk.size}</strong></span>
                    <button
                      onClick={() => handleDownload(status.android.apk.url, status.android.apk.name)}
                      disabled={downloadingFile === status.android.apk.name}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#f2ca50] to-[#e5b820] hover:from-[#e5b820] hover:to-[#cca316] text-[#07090d] font-bold text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[16px]">download</span>
                      <span>Télécharger DALTEK-Android.apk</span>
                    </button>
                  </>
                ) : (
                  <div className="w-full flex items-center justify-between p-2.5 rounded-xl bg-[#222834]/60 border border-white/5">
                    <span className="text-xs text-amber-300 font-medium flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">hourglass_top</span>
                      Version native en préparation
                    </span>
                    <span className="text-[11px] text-[#8e95a5]">Projet compilable disponible ci-dessous</span>
                  </div>
                )}
              </div>
            </div>

            {/* 2C. ZIP Projet Android */}
            <div className="p-4 rounded-2xl bg-[#1a1e27] border border-white/5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#38bdf8] text-[20px]">folder_zip</span>
                  <h3 className="font-['Syne'] text-sm font-bold text-white uppercase tracking-wider">
                    Projet Android ZIP
                  </h3>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {status.android.projectZip.label}
                </span>
              </div>
              <p className="text-xs text-[#c5c8d4] leading-relaxed">
                Archive complète <code className="text-[#38bdf8] font-mono text-[11px]">DALTEK-Android.zip</code> prête à être ouverte et compilée dans Android Studio (Gradle, Kotlin, Manifest, icônes, configurations Release & Debug, aucun secret serveur inclus).
              </p>
              <div className="flex items-center justify-between pt-1 text-xs text-[#8e95a5]">
                <span>Taille réelle : <strong className="text-white">{status.android.projectZip.size || '146 Ko'}</strong></span>
                <button
                  onClick={() => handleDownload(status.android.projectZip.url, status.android.projectZip.name)}
                  disabled={downloadingFile === status.android.projectZip.name}
                  className="px-4 py-2 rounded-xl bg-[#222834] hover:bg-[#2c3342] text-white border border-white/10 font-medium text-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px]">folder_zip</span>
                  <span>Télécharger DALTEK-Android.zip</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* =========================================
            2. WINDOWS
        ========================================= */}
        <div
          className={`flex flex-col rounded-3xl bg-[#14171e] border ${
            detectedOS === 'windows' ? 'border-[#00a4ef]/50 shadow-[0_0_30px_rgba(0,164,239,0.15)] ring-1 ring-[#00a4ef]/40' : 'border-white/10'
          } p-6 sm:p-8 relative overflow-hidden transition-all duration-300`}
        >
          {detectedOS === 'windows' && (
            <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-[#00a4ef]/20 border border-[#00a4ef]/40 text-[#00a4ef] text-[11px] font-bold tracking-wide uppercase">
              Recommandé pour cet appareil
            </div>
          )}

          {/* Platform Header */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-[#00a4ef]/10 border border-[#00a4ef]/30 flex items-center justify-center text-[#00a4ef] shadow-inner shrink-0">
              <span className="material-symbols-outlined text-[32px]">desktop_windows</span>
            </div>
            <div>
              <h2 className="font-['Syne'] text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                WINDOWS
              </h2>
              <p className="text-xs text-[#a0a6b5]">
                Pour ordinateurs de bureau, PC de guichet et postes multi-écrans TV
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-5 flex-1">
            {/* 3A. Application Windows Native Installer */}
            <div className="p-4 rounded-2xl bg-[#1a1e27] border border-white/5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#00a4ef] text-[20px]">system_update</span>
                  <h3 className="font-['Syne'] text-sm font-bold text-white uppercase tracking-wider">
                    Installateur Windows (.exe)
                  </h3>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  status.windows.exe.exists
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}>
                  {status.windows.exe.exists ? '✓ DISPONIBLE' : '⏳ EN PRÉPARATION'}
                </span>
              </div>
              <p className="text-xs text-[#c5c8d4] leading-relaxed">
                Véritable installateur Windows (<code className="text-[#00a4ef] font-mono text-[11px]">DALTEK-Windows-Setup.exe</code>) intégrant l'exécutable natif 64-bit, la création du raccourci dans le menu Démarrer et sur le bureau, le support multi-écrans TV/Guichet et la synchronisation temps réel avec le serveur.
              </p>
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 text-xs text-[#8e95a5]">
                {status.windows.exe.exists ? (
                  <>
                    <span>Taille : <strong className="text-white">{status.windows.exe.size}</strong></span>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => handleDownload(status.windows.exe.url, status.windows.exe.name)}
                        disabled={downloadingFile === status.windows.exe.name}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#00a4ef] to-[#0078d4] hover:from-[#0078d4] hover:to-[#005a9e] text-white font-bold text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-[16px]">download</span>
                        <span>Télécharger DALTEK-Windows-Setup.exe</span>
                      </button>
                      {status.windows.msi?.exists && (
                        <button
                          onClick={() => handleDownload('/api/download/DALTEK-Windows.msi', 'DALTEK-Windows.msi')}
                          disabled={downloadingFile === 'DALTEK-Windows.msi'}
                          className="px-3 py-2 rounded-xl bg-[#222834] hover:bg-[#2c3342] text-white border border-white/10 font-medium text-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-[16px]">inventory_2</span>
                          <span>Format .msi ({status.windows.msi.size})</span>
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="w-full flex items-center justify-between p-2.5 rounded-xl bg-[#222834]/60 border border-white/5">
                    <span className="text-xs text-amber-300 font-medium flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">hourglass_top</span>
                      Version native en préparation
                    </span>
                    <span className="text-[11px] text-[#8e95a5]">Projet C# Visual Studio disponible ci-dessous</span>
                  </div>
                )}
              </div>
            </div>

            {/* 3C. Projet Windows ZIP */}
            <div className="p-4 rounded-2xl bg-[#1a1e27] border border-white/5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#38bdf8] text-[20px]">folder_zip</span>
                  <h3 className="font-['Syne'] text-sm font-bold text-white uppercase tracking-wider">
                    Projet Windows ZIP
                  </h3>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {status.windows.projectZip.label}
                </span>
              </div>
              <p className="text-xs text-[#c5c8d4] leading-relaxed">
                Archive complète <code className="text-[#38bdf8] font-mono text-[11px]">DALTEK-Windows.zip</code> contenant le code source complet Visual Studio / .NET 8, App.xaml, MainWindow.xaml, script de signature <code className="text-[#a0a6b5] font-mono text-[11px]">Sign-Authenticode.ps1</code> et icône <code className="text-[#a0a6b5] font-mono text-[11px]">daltek.ico</code>.
              </p>
              <div className="flex items-center justify-between pt-1 text-xs text-[#8e95a5]">
                <span>Taille réelle : <strong className="text-white">{status.windows.projectZip.size || '56 Ko'}</strong></span>
                <button
                  onClick={() => handleDownload(status.windows.projectZip.url, status.windows.projectZip.name)}
                  disabled={downloadingFile === status.windows.projectZip.name}
                  className="px-4 py-2 rounded-xl bg-[#222834] hover:bg-[#2c3342] text-white border border-white/10 font-medium text-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px]">folder_zip</span>
                  <span>Télécharger DALTEK-Windows.zip</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* =========================================
            3. macOS
        ========================================= */}
        <div
          className={`flex flex-col rounded-3xl bg-[#14171e] border ${
            detectedOS === 'macos' ? 'border-slate-300/50 shadow-[0_0_30px_rgba(255,255,255,0.1)] ring-1 ring-slate-300/30' : 'border-white/10'
          } p-6 sm:p-8 relative overflow-hidden transition-all duration-300`}
        >
          {detectedOS === 'macos' && (
            <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-white/20 border border-white/40 text-white text-[11px] font-bold tracking-wide uppercase">
              Recommandé pour cet appareil
            </div>
          )}

          {/* Platform Header */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white shadow-inner shrink-0">
              <span className="material-symbols-outlined text-[32px]">laptop_mac</span>
            </div>
            <div>
              <h2 className="font-['Syne'] text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                macOS
              </h2>
              <p className="text-xs text-[#a0a6b5]">
                Pour MacBook, Mac mini, Mac Studio et iMac (Apple Silicon & Intel)
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-5 flex-1">
            {/* 4A. Application macOS */}
            <div className="p-4 rounded-2xl bg-[#1a1e27] border border-white/5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-slate-200 text-[20px]">album</span>
                  <h3 className="font-['Syne'] text-sm font-bold text-white uppercase tracking-wider">
                    Application macOS (.dmg / .app)
                  </h3>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  status.macos.dmg.exists
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}>
                  {status.macos.dmg.exists ? '✓ DISPONIBLE' : '⏳ EN PRÉPARATION'}
                </span>
              </div>
              <p className="text-xs text-[#c5c8d4] leading-relaxed">
                Image disque universelle (Universal Binary pour puces Apple Silicon M1/M2/M3/M4 et processeurs Intel), avec support du multi-écrans pour téléviseur d'accueil déporté.
              </p>
              <div className="flex items-center justify-between pt-1 text-xs text-[#8e95a5]">
                {status.macos.dmg.exists ? (
                  <>
                    <span>Taille : <strong className="text-white">{status.macos.dmg.size}</strong></span>
                    <button
                      onClick={() => handleDownload(status.macos.dmg.url, status.macos.dmg.name)}
                      disabled={downloadingFile === status.macos.dmg.name}
                      className="px-4 py-2 rounded-xl bg-white hover:bg-slate-200 text-[#07090d] font-bold text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[16px]">download</span>
                      <span>Télécharger DALTEK.dmg</span>
                    </button>
                  </>
                ) : (
                  <div className="w-full flex items-center justify-between p-2.5 rounded-xl bg-[#222834]/60 border border-white/5">
                    <span className="text-xs text-amber-300 font-medium flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">hourglass_top</span>
                      Version native en préparation
                    </span>
                    <span className="text-[11px] text-[#8e95a5]">Projet macOS disponible ci-dessous</span>
                  </div>
                )}
              </div>
            </div>

            {/* 4B. ZIP Projet macOS */}
            <div className="p-4 rounded-2xl bg-[#1a1e27] border border-white/5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#38bdf8] text-[20px]">folder_zip</span>
                  <h3 className="font-['Syne'] text-sm font-bold text-white uppercase tracking-wider">
                    Projet macOS ZIP
                  </h3>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {status.macos.projectZip.label}
                </span>
              </div>
              <p className="text-xs text-[#c5c8d4] leading-relaxed">
                Archive complète <code className="text-[#38bdf8] font-mono text-[11px]">DALTEK-macOS.zip</code> contenant le projet Xcode natif Swift &amp; SwiftUI, <code className="text-[#a0a6b5] font-mono text-[11px]">DALTEK-macOS/Info.plist</code>, entitlements Sandbox, icône d'application 512px et scripts de notarisation Apple (<code className="text-[#a0a6b5] font-mono text-[11px]">xcrun notarytool</code>).
              </p>
              <div className="flex items-center justify-between pt-1 text-xs text-[#8e95a5]">
                <span>Taille réelle : <strong className="text-white">{status.macos.projectZip.size || '139 Ko'}</strong></span>
                <button
                  onClick={() => handleDownload(status.macos.projectZip.url, status.macos.projectZip.name)}
                  disabled={downloadingFile === status.macos.projectZip.name}
                  className="px-4 py-2 rounded-xl bg-[#222834] hover:bg-[#2c3342] text-white border border-white/10 font-medium text-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px]">folder_zip</span>
                  <span>Télécharger DALTEK-macOS.zip</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* =========================================
            4. IPHONE / IPAD
        ========================================= */}
        <div
          className={`flex flex-col rounded-3xl bg-[#14171e] border ${
            detectedOS === 'ios' ? 'border-[#f2ca50]/50 shadow-[0_0_30px_rgba(242,202,80,0.15)] ring-1 ring-[#f2ca50]/30' : 'border-white/10'
          } p-6 sm:p-8 relative overflow-hidden transition-all duration-300`}
        >
          {detectedOS === 'ios' && (
            <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-[#f2ca50]/20 border border-[#f2ca50]/40 text-[#f2ca50] text-[11px] font-bold tracking-wide uppercase">
              Recommandé pour cet appareil
            </div>
          )}

          {/* Platform Header */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-[#f2ca50]/10 border border-[#f2ca50]/30 flex items-center justify-center text-[#f2ca50] shadow-inner shrink-0">
              <span className="material-symbols-outlined text-[32px]">phone_iphone</span>
            </div>
            <div>
              <h2 className="font-['Syne'] text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                iPHONE / iPAD
              </h2>
              <p className="text-xs text-[#a0a6b5]">
                Pour iPhone des visiteurs, iPad au guichet et tablettes d'accueil
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-5 flex-1">
            {/* 5A. Distribution officielle Apple */}
            <div className="p-4 rounded-2xl bg-[#1a1e27] border border-white/5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#f2ca50] text-[20px]">storefront</span>
                  <h3 className="font-['Syne'] text-sm font-bold text-white uppercase tracking-wider">
                    Distribution App Store / TestFlight
                  </h3>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  ⏳ EN PRÉPARATION
                </span>
              </div>

              {/* Honest Apple Store Status */}
              <div className="p-3 rounded-xl bg-[#222834] border border-white/10 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-[#f2ca50] text-xs font-bold font-['Syne']">
                  <span className="material-symbols-outlined text-[18px]">hourglass_top</span>
                  <span>Version iPhone/iPad en préparation</span>
                </div>
                <p className="text-xs text-[#c5c8d4] leading-relaxed">
                  Conformément aux directives officielles Apple, la distribution sur iOS et iPadOS s'effectuera exclusivement via l'<strong>App Store</strong> et <strong>TestFlight</strong> (aucun faux profil d'entreprise ni faux fichier IPA corrompu). La soumission est en cours d'examen auprès d'Apple Developer.
                </p>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-[#8e95a5]">En attendant : utilisation immédiate via navigateur</span>
                <button
                  onClick={() => onNavigate('suivi-client-mobile')}
                  className="px-3.5 py-2 rounded-xl bg-[#f2ca50]/15 hover:bg-[#f2ca50]/25 text-[#f2ca50] border border-[#f2ca50]/30 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">touch_app</span>
                  <span>Suivi Ticket Visiteur Web</span>
                </button>
              </div>
            </div>

            {/* 5B. ZIP Projet iOS */}
            <div className="p-4 rounded-2xl bg-[#1a1e27] border border-white/5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#38bdf8] text-[20px]">folder_zip</span>
                  <h3 className="font-['Syne'] text-sm font-bold text-white uppercase tracking-wider">
                    Projet iOS ZIP
                  </h3>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {status.ios.projectZip.label}
                </span>
              </div>
              <p className="text-xs text-[#c5c8d4] leading-relaxed">
                Archive officielle <code className="text-[#38bdf8] font-mono text-[11px]">DALTEK-iOS.zip</code> avec l'architecture native Swift & SwiftUI, Info.plist, autorisations APNs push et connexion au backend DALTEK. Prêt pour compilation locale dans Xcode ou déploiement MDM.
              </p>
              <div className="flex items-center justify-between pt-1 text-xs text-[#8e95a5]">
                <span>Taille réelle : <strong className="text-white">{status.ios.projectZip.size || '369 Ko'}</strong></span>
                <button
                  onClick={() => handleDownload(status.ios.projectZip.url, status.ios.projectZip.name)}
                  disabled={downloadingFile === status.ios.projectZip.name}
                  className="px-4 py-2 rounded-xl bg-[#222834] hover:bg-[#2c3342] text-white border border-white/10 font-medium text-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px]">folder_zip</span>
                  <span>Télécharger DALTEK-iOS.zip</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Synchronization Guarantee Footer Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-[#12151c] border border-white/10 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#f2ca50]/10 border border-[#f2ca50]/30 flex items-center justify-center text-[#f2ca50] shrink-0">
            <span className="material-symbols-outlined text-[28px]">hub</span>
          </div>
          <div>
            <h3 className="font-['Syne'] text-lg font-bold text-white">
              Une Seule File Active • Une Seule Base de Données • Synchronisation Immédiate
            </h3>
            <p className="text-xs text-[#a0a6b5] mt-1 max-w-3xl">
              Que vous utilisiez DALTEK sur le Web, sur le WebAPK Android, ou depuis les applications natives compilées : toutes les interfaces sont connectées au même serveur temps réel. Aucun ticket n'est jamais isolé sur un appareil.
            </p>
          </div>
        </div>

        <button
          onClick={() => onNavigate('accueil')}
          className="px-5 py-2.5 rounded-xl bg-[#222834] hover:bg-[#2c3342] text-white border border-white/10 text-xs font-semibold tracking-wide shrink-0 transition-colors cursor-pointer"
        >
          Retour à l'accueil
        </button>
      </div>
    </div>
  );
};
