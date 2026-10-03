import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full bg-[#0c0e12] border-t border-white/5 py-4 shadow-[0_-1px_12px_rgba(0,0,0,0.4)]">
      <div className="w-full px-4 md:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 font-['JetBrains_Mono'] text-[11px] text-[#a0a6b5]">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#53e97d]"></span>
          <span>DALTEK HIGH-CONCIERGE QUEUE ENGINE v4.2.8</span>
          <span className="hidden md:inline">• PARIS HIGH-SECURITY CLOUD GATEWAY</span>
        </div>
        <div>
          <span>© 2024 DALTEK SYSTEMS. PROTOCOLE TEMPS RÉEL ACTIF.</span>
        </div>
      </div>
    </footer>
  );
};
