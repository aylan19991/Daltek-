import React, { useState } from 'react';
import { Establishment, OperatorAccount, TabType } from '../types';
import { loginStaff } from '../utils/api';

interface ConnexionEtablissementViewProps {
  establishments: Establishment[];
  selectedEstablishment: Establishment;
  setSelectedEstablishment: (est: Establishment) => void;
  onLoginSuccess: (operator: OperatorAccount, establishment: Establishment) => void;
  onNavigate: (tab: TabType) => void;
  onShowToast: (msg: string) => void;
}

export const ConnexionEtablissementView: React.FC<ConnexionEtablissementViewProps> = ({
  establishments,
  selectedEstablishment,
  setSelectedEstablishment,
  onLoginSuccess,
  onNavigate,
  onShowToast,
}) => {
  const [staffCode, setStaffCode] = useState<string>('');
  const [showCode, setShowCode] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = staffCode.trim();
    if (!cleanCode) {
      setErrorMessage('Veuillez saisir votre Code Staff.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await loginStaff(cleanCode);
      onShowToast(`Session active : ${res.operator.name} (${res.establishment.name})`);
      setSelectedEstablishment(res.establishment);
      onLoginSuccess(res.operator, res.establishment);
    } catch (err: any) {
      setErrorMessage(err.message || 'Code Staff incorrect ou introuvable.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto py-6 animate-fadeIn">
      {/* Return to Home link */}
      <button
        onClick={() => onNavigate('accueil')}
        className="flex items-center gap-1.5 text-xs font-['Outfit'] text-[#a0a6b5] hover:text-white transition-colors mb-6 cursor-pointer"
      >
        <span className="material-symbols-outlined text-[16px]">arrow_back</span>
        <span>Retour à l'accueil DALTEK</span>
      </button>

      <div className="bg-[#14171d] border border-white/10 rounded-2xl p-7 md:p-8 shadow-2xl relative overflow-hidden">
        <div className="w-12 h-12 rounded-xl bg-[#1e222a] border border-[#f2ca50]/30 flex items-center justify-center mb-5 text-[#f2ca50]">
          <span className="material-symbols-outlined text-[26px]">badge</span>
        </div>

        <h2 className="font-['Syne'] text-2xl font-bold text-white mb-1">
          Connexion Staff
        </h2>
        <p className="font-['Outfit'] text-xs text-[#a0a6b5] mb-6">
          Saisissez votre code personnel ou le code de votre établissement pour ouvrir la console d'appel.
        </p>

        {errorMessage && (
          <div className="mb-5 p-3.5 bg-[#93000a]/20 border border-[#ffb4ab]/30 rounded-xl flex items-center gap-3 text-[#ffb4ab] text-xs font-['Outfit']">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-['JetBrains_Mono'] uppercase tracking-wider text-[#d0c5af] mb-2">
              Code Staff
            </label>
            <div className="relative">
              <input
                type={showCode ? 'text' : 'password'}
                value={staffCode}
                onChange={(e) => setStaffCode(e.target.value.toUpperCase())}
                placeholder="Saisissez votre code Staff..."
                autoFocus
                className="w-full bg-[#1b1f27] border border-white/10 rounded-xl px-4 py-3.5 pr-12 text-base font-['JetBrains_Mono'] font-bold text-[#f2ca50] placeholder-gray-500 focus:outline-none focus:border-[#f2ca50] transition-colors shadow-inner"
                required
              />
              <button
                type="button"
                onClick={() => setShowCode(!showCode)}
                className="absolute right-3.5 top-3.5 text-[#a0a6b5] hover:text-white transition-colors cursor-pointer"
                title={showCode ? 'Masquer le code' : 'Afficher le code'}
              >
                <span className="material-symbols-outlined text-[20px]">
                  {showCode ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
            <p className="text-[11px] text-[#a0a6b5] mt-1.5 font-['Outfit']">
              L'établissement est identifié automatiquement par votre code.
            </p>
          </div>

          <button
            type="submit"
            disabled={isLoading || !staffCode.trim()}
            className="w-full mt-2 py-3.5 bg-[#f2ca50] hover:bg-[#ffe088] active:bg-[#d4af37] text-[#3c2f00] font-['Outfit'] text-sm font-bold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
          >
            {isLoading ? (
              <>
                <span className="w-4 h-4 border-2 border-[#3c2f00] border-t-transparent rounded-full animate-spin" />
                <span>Connexion en cours...</span>
              </>
            ) : (
              <>
                <span>Accéder à la Console Staff</span>
                <span className="material-symbols-outlined text-[18px]">login</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-[11px] text-[#a0a6b5]">
          <span>Isolation Établissement Active</span>
          <span className="font-['JetBrains_Mono'] text-[#f2ca50]">DALTEK CORE</span>
        </div>
      </div>
    </div>
  );
};
