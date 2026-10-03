import React, { useState, useEffect, useRef } from 'react';
import { Establishment, OperatorAccount, AuditEvent, TabType } from '../types';
import {
  checkAdminStatus,
  setupAdmin,
  loginAdmin,
  changeAdminCode,
  createEstablishment,
  updateEstablishment,
  deleteEstablishment,
  createOperator,
  updateOperator,
  deleteOperator,
  setOperatorStatus,
  generateQrDataUrl,
} from '../utils/api';

interface AdministrationCentraleViewProps {
  establishments: Establishment[];
  setEstablishments: React.Dispatch<React.SetStateAction<Establishment[]>>;
  selectedEstablishment: Establishment;
  setSelectedEstablishment: (est: Establishment) => void;
  operators: OperatorAccount[];
  setOperators: React.Dispatch<React.SetStateAction<OperatorAccount[]>>;
  auditLogs: AuditEvent[];
  setAuditLogs: React.Dispatch<React.SetStateAction<AuditEvent[]>>;
  isAdminLoggedIn: boolean;
  setIsAdminLoggedIn: (val: boolean) => void;
  onNavigate: (tab: TabType, establishment?: Establishment) => void;
  onShowToast: (msg: string) => void;
}

type AdminSubTab = 'etablissements' | 'fiche' | 'personnel' | 'audit' | 'parametres';

export const AdministrationCentraleView: React.FC<AdministrationCentraleViewProps> = ({
  establishments,
  setEstablishments,
  selectedEstablishment,
  setSelectedEstablishment,
  operators,
  setOperators,
  auditLogs,
  setAuditLogs,
  isAdminLoggedIn,
  setIsAdminLoggedIn,
  onNavigate,
  onShowToast,
}) => {
  // Auth state
  const [isConfigured, setIsConfigured] = useState<boolean>(true);
  const [adminCodeInput, setAdminCodeInput] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(false);

  // Admin Sub-Tab
  const [subTab, setSubTab] = useState<AdminSubTab>('etablissements');

  // Delete confirmation modal state
  const [establishmentToDelete, setEstablishmentToDelete] = useState<Establishment | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Password visibility toggles
  const [showAdminCode, setShowAdminCode] = useState<boolean>(false);
  const [showCurrentCode, setShowCurrentCode] = useState<boolean>(false);
  const [showNewCode, setShowNewCode] = useState<boolean>(false);

  // Establishment Modals & Forms
  const [showNewEstModal, setShowNewEstModal] = useState<boolean>(false);
  const [newEstName, setNewEstName] = useState<string>('');
  const [newEstCode, setNewEstCode] = useState<string>('');
  const [newEstStaffCode, setNewEstStaffCode] = useState<string>('');
  const [newEstIcon, setNewEstIcon] = useState<string>('apartment');
  const [newEstLogoUrl, setNewEstLogoUrl] = useState<string>('');

  const estFileInputRef = useRef<HTMLInputElement | null>(null);
  const ficheFileInputRef = useRef<HTMLInputElement | null>(null);

  // Edit Establishment Modal State
  const [editingEst, setEditingEst] = useState<Establishment | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editIcon, setEditIcon] = useState<string>('apartment');
  const [editLogoUrl, setEditLogoUrl] = useState<string>('');
  const [editNewCode, setEditNewCode] = useState<string>('');
  const [showEditCode, setShowEditCode] = useState<boolean>(false);
  const [editIsContractActive, setEditIsContractActive] = useState<boolean>(true);
  const [editIsSaving, setEditIsSaving] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);
  const editFileInputRef = useRef<HTMLInputElement | null>(null);

  // Operator Creation Modal
  const [showNewOpModal, setShowNewOpModal] = useState<boolean>(false);
  const [newOpStaffCode, setNewOpStaffCode] = useState<string>('');
  const [newOpName, setNewOpName] = useState<string>('');
  const [newOpDesk, setNewOpDesk] = useState<string>('Guichet 1');
  const [newOpEstablishmentId, setNewOpEstablishmentId] = useState<string>(selectedEstablishment.id);

  // Password Change in Settings
  const [currentAdminCode, setCurrentAdminCode] = useState<string>('');
  const [newAdminCode, setNewAdminCode] = useState<string>('');
  const [paramSuccessMsg, setParamSuccessMsg] = useState<string | null>(null);
  const [paramErrorMsg, setParamErrorMsg] = useState<string | null>(null);

  // QR Code preview for current establishment
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  // Check admin status on mount
  useEffect(() => {
    checkAdminStatus()
      .then((status) => {
        setIsConfigured(status.isConfigured);
      })
      .catch((err) => {
        console.error('Failed to check admin status:', err);
      });
  }, []);

  // Generate QR Code when establishment changes
  useEffect(() => {
    const origin = window.location.origin;
    const estCode = selectedEstablishment.code || selectedEstablishment.id.replace('#', '');
    const clientUrl = `${origin}?est=${encodeURIComponent(estCode)}&tab=suivi-client-mobile`;

    generateQrDataUrl(clientUrl).then((url) => {
      setQrDataUrl(url);
    });
  }, [selectedEstablishment]);

  // Handle Admin Login or Initial Setup
  const handleAdminAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminCodeInput.trim()) {
      setAuthError('Veuillez renseigner le code administrateur');
      return;
    }

    setAuthLoading(true);
    setAuthError(null);

    try {
      if (!isConfigured) {
        // Initial setup
        await setupAdmin(adminCodeInput.trim());
        setIsAdminLoggedIn(true);
        setIsConfigured(true);
        onShowToast('Administrateur Principal configuré avec succès !');
      } else {
        // Normal login
        await loginAdmin(adminCodeInput.trim());
        setIsAdminLoggedIn(true);
        onShowToast('Authentification Administrateur validée');
      }
      setAdminCodeInput('');
    } catch (err: any) {
      setAuthError(err.message || 'Code administrateur incorrect');
    } finally {
      setAuthLoading(false);
    }
  };

  // Real Native Logo File Upload
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, isFiche = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.type)) {
      onShowToast('Formats acceptés : PNG, JPG, JPEG, WEBP');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      if (isFiche) {
        try {
          const updated = await updateEstablishment(selectedEstablishment.id, { logoUrl: dataUrl });
          setSelectedEstablishment(updated);
          setEstablishments((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
          onShowToast(`Logo mis à jour pour ${updated.name}`);
        } catch (err: any) {
          onShowToast(`Erreur mise à jour logo : ${err.message}`);
        }
      } else {
        setNewEstLogoUrl(dataUrl);
        onShowToast('Symbole importé avec succès');
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle Create Establishment (Requirement 3: NOM, CODE, SYMBOLE/LOGO ONLY)
  const handleCreateEstablishment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEstName.trim() || !newEstCode.trim()) {
      onShowToast('Le nom et le code de l’établissement sont obligatoires');
      return;
    }

    try {
      const cleanCode = newEstCode.trim().toUpperCase().replace(/^#/, '');
      const created = await createEstablishment({
        name: newEstName.trim(),
        code: cleanCode,
        staffCode: cleanCode,
        icon: 'apartment',
        logoUrl: newEstLogoUrl.trim() || undefined,
        isContractActive: true,
      });

      setEstablishments((prev) => [...prev, created]);
      setSelectedEstablishment(created);
      setShowNewEstModal(false);
      onShowToast(`Établissement "${created.name}" créé avec succès !`);

      // Reset form
      setNewEstName('');
      setNewEstCode('');
      setNewEstStaffCode('');
      setNewEstLogoUrl('');
    } catch (err: any) {
      onShowToast(`Erreur : ${err.message}`);
    }
  };

  // Open Edit Modal for a specific establishment (Strict Isolation)
  const handleOpenEdit = (est: Establishment) => {
    setEditingEst(est);
    setEditName(est.name);
    setEditIcon(est.icon || 'apartment');
    setEditLogoUrl(est.logoUrl || '');
    setEditNewCode('');
    setShowEditCode(false);
    setEditIsContractActive(est.isContractActive);
    setEditError(null);
  };

  // Handle Logo File Selection for Edit Modal (Device File Picker: PC, Mobile, Tablet)
  const handleEditFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'].includes(file.type)) {
      setEditError('Formats acceptés : PNG, JPG, JPEG, WEBP, SVG');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setEditError("L'image ne doit pas dépasser 5 Mo");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setEditLogoUrl(dataUrl);
      setEditError(null);
    };
    reader.readAsDataURL(file);
  };

  // Save Modifications to Backend with Realtime Broadcast & Instant UI Update
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEst) return;
    if (!editName.trim()) {
      setEditError("Le nom de l'établissement est obligatoire");
      return;
    }

    setEditIsSaving(true);
    setEditError(null);

    try {
      const payload: Partial<Establishment> = {
        name: editName.trim(),
        icon: editIcon,
        logoUrl: editLogoUrl,
        isContractActive: editIsContractActive,
      };
      if (editNewCode.trim()) {
        payload.code = editNewCode.trim().toUpperCase().replace(/^#/, '');
      }

      const updated = await updateEstablishment(editingEst.id, payload);

      // Instant local state update for zero-lag response
      setEstablishments((prev) =>
        prev.map((e) => (e.id === editingEst.id ? updated : e))
      );

      if (selectedEstablishment.id === editingEst.id) {
        setSelectedEstablishment(updated);
      }

      onShowToast(`Établissement "${updated.name}" modifié avec succès !`);
      setEditingEst(null);
    } catch (err: any) {
      setEditError(err.message || "Erreur lors de la modification de l'établissement");
    } finally {
      setEditIsSaving(false);
    }
  };

  // Handle Real Server-side Deletion with Explicit Confirmation
  const confirmDeleteEstablishment = async () => {
    if (!establishmentToDelete) return;

    setIsDeleting(true);
    const target = establishmentToDelete;

    try {
      await deleteEstablishment(target.id);
      setEstablishments((prev) => prev.filter((e) => e.id !== target.id));
      if (selectedEstablishment.id === target.id) {
        const remaining = establishments.filter((e) => e.id !== target.id);
        if (remaining.length > 0) {
          setSelectedEstablishment(remaining[0]);
        }
      }
      onShowToast(`L'établissement "${target.name}" a été définitivement supprimé.`);
      setEstablishmentToDelete(null);
    } catch (err: any) {
      onShowToast(`Erreur lors de la suppression : ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle Toggle Contract
  const handleToggleContract = async (est: Establishment) => {
    try {
      const updated = await updateEstablishment(est.id, {
        isContractActive: !est.isContractActive,
      });
      setEstablishments((prev) => prev.map((e) => (e.id === est.id ? updated : e)));
      if (selectedEstablishment.id === est.id) {
        setSelectedEstablishment(updated);
      }
      onShowToast(`Statut de ${est.name} : ${updated.isContractActive ? 'Actif' : 'Suspendu'}`);
    } catch (err: any) {
      onShowToast(`Erreur : ${err.message}`);
    }
  };

  // Handle Create Operator (Requirement 5: CODE STAFF ONLY, NO PASSWORD)
  const handleCreateOperator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOpName.trim()) {
      onShowToast('Le nom du membre du personnel est obligatoire');
      return;
    }

    try {
      const codeStaff = (newOpStaffCode || `STF-${crypto.randomUUID().slice(0, 4)}`).trim().toUpperCase();
      const created = await createOperator({
        name: newOpName.trim(),
        staffCode: codeStaff,
        assignedDesk: newOpDesk.trim() || 'Guichet 1',
        establishmentId: newOpEstablishmentId,
      });

      setOperators((prev) => [...prev, created]);
      setShowNewOpModal(false);
      onShowToast(`Personnel créé avec succès : ${created.name}`);

      setNewOpName('');
      setNewOpStaffCode('');
    } catch (err: any) {
      onShowToast(`Erreur : ${err.message}`);
    }
  };

  // Handle Delete Operator
  const handleDeleteOperator = async (id: string, name: string) => {
    if (!window.confirm(`Voulez-vous vraiment supprimer le compte de ${name} ?`)) return;
    try {
      await deleteOperator(id);
      setOperators((prev) => prev.filter((o) => o.id !== id));
      onShowToast(`Compte ${name} supprimé`);
    } catch (err: any) {
      onShowToast(`Erreur : ${err.message}`);
    }
  };

  // Handle Toggle Operator Status
  const handleToggleOperatorStatus = async (op: OperatorAccount) => {
    const nextStatus = op.status === 'online' ? 'paused' : op.status === 'paused' ? 'offline' : 'online';
    try {
      await setOperatorStatus(op.id, nextStatus);
      setOperators((prev) =>
        prev.map((o) => (o.id === op.id ? { ...o, status: nextStatus } : o))
      );
      onShowToast(`Statut de ${op.name} mis à jour : ${nextStatus}`);
    } catch (err: any) {
      onShowToast(`Erreur : ${err.message}`);
    }
  };

  // Handle Change Admin Code
  const handleChangeCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setParamErrorMsg(null);
    setParamSuccessMsg(null);

    if (!currentAdminCode.trim() || !newAdminCode.trim()) {
      setParamErrorMsg('Veuillez renseigner le code actuel et le nouveau code');
      return;
    }

    try {
      await changeAdminCode(currentAdminCode.trim(), newAdminCode.trim());
      setParamSuccessMsg('Code administrateur mis à jour avec succès');
      setCurrentAdminCode('');
      setNewAdminCode('');
      onShowToast('Code administrateur maître actualisé');
    } catch (err: any) {
      setParamErrorMsg(err.message || 'Échec de la modification du code');
    }
  };

  // ==========================================
  // VIEW: ADMIN LOGIN OR INITIAL SETUP SCREEN
  // ==========================================
  if (!isAdminLoggedIn) {
    return (
      <div className="w-full max-w-md mx-auto py-12 animate-fadeIn">
        <button
          onClick={() => onNavigate('accueil')}
          className="flex items-center gap-1.5 text-xs font-['Outfit'] text-[#a0a6b5] hover:text-white transition-colors mb-6"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          <span>Retour à l'accueil DALTEK</span>
        </button>

        <div className="bg-[#14171d] border border-[#f2ca50]/30 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
          <div className="w-14 h-14 rounded-2xl bg-[#1e222a] border border-[#f2ca50]/40 flex items-center justify-center mb-6 text-[#f2ca50] shadow-inner">
            <span className="material-symbols-outlined text-[32px]">shield_person</span>
          </div>

          <h2 className="font-['Syne'] text-2xl font-bold text-white mb-2">
            {!isConfigured ? 'Configuration Initiale DALTEK' : 'Administration DALTEK'}
          </h2>

          <p className="font-['Outfit'] text-xs sm:text-sm text-[#a0a6b5] mb-6 leading-relaxed">
            {!isConfigured
              ? 'Définissez le code d’accès maître unique pour l’Administrateur Principal. Ce code sera requis pour toute action de gouvernance.'
              : 'Espace sécurisé réservé à l’Administrateur Principal. Saisissez votre code d’accès pour gérer les établissements et le personnel.'}
          </p>

          {authError && (
            <div className="mb-5 p-3.5 bg-[#93000a]/20 border border-[#ffb4ab]/30 rounded-xl flex items-center gap-3 text-[#ffb4ab] text-xs font-['Outfit']">
              <span className="material-symbols-outlined text-[18px]">lock_reset</span>
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleAdminAuthSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-['JetBrains_Mono'] uppercase tracking-wider text-[#d0c5af] mb-1.5">
                {!isConfigured ? 'Nouveau Code Administrateur' : 'Code Administrateur'}
              </label>
              <div className="relative">
                <input
                  type={showAdminCode ? 'text' : 'password'}
                  value={adminCodeInput}
                  onChange={(e) => setAdminCodeInput(e.target.value)}
                  placeholder="Entrez votre code secret"
                  className="w-full bg-[#1b1f27] border border-white/10 rounded-xl px-4 py-3 pr-12 text-sm font-['JetBrains_Mono'] text-white placeholder-gray-500 focus:outline-none focus:border-[#f2ca50] transition-colors"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowAdminCode(!showAdminCode)}
                  className="absolute right-3.5 top-3.5 text-[#a0a6b5] hover:text-white transition-colors cursor-pointer"
                  title={showAdminCode ? 'Masquer' : 'Afficher'}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {showAdminCode ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full mt-2 py-3.5 bg-[#f2ca50] hover:bg-[#ffe088] active:bg-[#d4af37] text-[#3c2f00] font-['Outfit'] text-sm font-bold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {authLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-[#3c2f00] border-t-transparent rounded-full animate-spin" />
                  <span>Vérification sécurisée...</span>
                </>
              ) : (
                <>
                  <span>{!isConfigured ? 'Définir & Accéder au Système' : 'Se connecter'}</span>
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-white/5 text-center">
            <span className="font-['JetBrains_Mono'] text-[10px] text-[#a0a6b5]">
              Vérification serveur intégrale • Chiffrement PBKDF2-SHA512
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW: AUTHENTICATED ADMIN DASHBOARD
  // ==========================================
  return (
    <div className="w-full flex flex-col gap-8 animate-fadeIn">
      {/* Top Admin Bar */}
      <div className="bg-[#14171d] border border-white/10 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#1e222a] border border-[#f2ca50]/40 flex items-center justify-center text-[#f2ca50]">
            <span className="material-symbols-outlined text-[28px]">shield_person</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-['Syne'] text-xl font-bold text-white">
                Dashboard Administrateur Principal
              </h2>
              <span className="px-2 py-0.5 rounded bg-[#f2ca50]/10 border border-[#f2ca50]/30 text-[#f2ca50] font-['JetBrains_Mono'] text-[10px] font-bold">
                ROOT PRIVILEGES
              </span>
            </div>
            <p className="font-['Outfit'] text-xs text-[#a0a6b5]">
              Contrôle universel des établissements, personnels, QR codes et synchronisations temps réel.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('accueil')}
            className="px-3.5 py-2 bg-[#1b1f27] hover:bg-[#252a35] border border-white/10 rounded-lg text-xs font-['Outfit'] text-[#d0c5af] flex items-center gap-2 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">home</span>
            <span>Accueil Public</span>
          </button>
          <button
            onClick={() => {
              setIsAdminLoggedIn(false);
              onShowToast('Session administrateur fermée');
            }}
            className="px-3.5 py-2 bg-[#93000a]/20 hover:bg-[#93000a]/30 border border-[#ffb4ab]/30 rounded-lg text-xs font-['Outfit'] text-[#ffb4ab] flex items-center gap-2 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">logout</span>
            <span>Déconnexion</span>
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs (Inspired by Chef Kebda) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-white/10">
        {[
          { id: 'etablissements', label: 'Établissements', icon: 'apartment', count: establishments.length },
          { id: 'fiche', label: 'Fiche Établissement', icon: 'badge', count: null },
          { id: 'personnel', label: 'Personnel & Comptes', icon: 'group', count: operators.length },
          { id: 'audit', label: 'Journal des Modifications', icon: 'history', count: auditLogs.length },
          { id: 'parametres', label: 'Paramètres & Sécurité', icon: 'settings', count: null },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSubTab(tab.id as AdminSubTab)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-['Outfit'] text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
              subTab === tab.id
                ? 'bg-[#f2ca50] text-[#3c2f00] shadow-md font-bold'
                : 'bg-[#15181f] text-[#a0a6b5] hover:text-white hover:bg-[#1c202a]'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.count !== null && (
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-['JetBrains_Mono'] ${
                  subTab === tab.id ? 'bg-[#3c2f00]/20 text-[#3c2f00]' : 'bg-[#222631] text-[#f2ca50]'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ========================================== */}
      {/* SUB-TAB 1: ÉTABLISSEMENTS                  */}
      {/* ========================================== */}
      {subTab === 'etablissements' && (
        <div className="flex flex-col gap-6">
          {/* Header with "+ Ajouter un établissement" */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-['Syne'] text-lg font-bold text-white">
                Gestion des Établissements & Files
              </h3>
              <p className="font-['Outfit'] text-xs text-[#a0a6b5]">
                Chaque établissement dispose d'une étanchéité absolue : ses propres tickets, son propre personnel et son QR code unique.
              </p>
            </div>
            <button
              onClick={() => setShowNewEstModal(true)}
              className="px-4 py-2.5 bg-[#f2ca50] hover:bg-[#ffe088] active:bg-[#d4af37] text-[#3c2f00] font-['Outfit'] text-xs sm:text-sm font-bold rounded-xl transition-all shadow flex items-center gap-2 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">add_circle</span>
              <span>+ Ajouter un établissement</span>
            </button>
          </div>

          {/* Establishments Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {establishments.map((est) => {
              const estOps = operators.filter((o) => o.establishmentId === est.id);
              return (
                <div
                  key={est.id}
                  className="bg-[#14171d] border border-white/10 hover:border-[#f2ca50]/40 rounded-2xl p-6 shadow-xl flex flex-col justify-between transition-all"
                >
                  <div>
                    {/* Top Status & Interactive Establishment Info */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div
                        onClick={() => handleOpenEdit(est)}
                        className="flex items-center gap-3 cursor-pointer group flex-1"
                        title={`Modifier l'établissement ${est.name}`}
                      >
                        <div className="relative w-12 h-12 rounded-xl bg-[#1e222a] border border-[#f2ca50]/20 group-hover:border-[#f2ca50] flex items-center justify-center text-[#f2ca50] overflow-hidden transition-all shadow-md shrink-0">
                          {est.logoUrl ? (
                            <img src={est.logoUrl} alt={est.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="material-symbols-outlined text-[26px]">{est.icon || 'apartment'}</span>
                          )}
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <span className="material-symbols-outlined text-white text-[18px]">edit</span>
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h4 className="font-['Syne'] text-base font-bold text-white group-hover:text-[#f2ca50] transition-colors leading-tight">
                              {est.name}
                            </h4>
                            <span className="material-symbols-outlined text-[14px] text-[#a0a6b5] group-hover:text-[#f2ca50] opacity-0 group-hover:opacity-100 transition-opacity">
                              edit
                            </span>
                          </div>
                          <span className="text-[11px] text-[#a0a6b5] font-['Outfit']">
                            Site opérationnel • Modifier
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleToggleContract(est)}
                        title="Activer/Suspendre le contrat"
                        className={`px-2 py-1 rounded text-[10px] font-['JetBrains_Mono'] font-bold uppercase transition-colors shrink-0 ${
                          est.isContractActive
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {est.isContractActive ? 'Actif' : 'Suspendu'}
                      </button>
                    </div>

                    {/* Stats pills */}
                    <div className="grid grid-cols-2 gap-2 bg-[#1b1f27] p-3 rounded-xl border border-white/5 mb-4 text-center">
                      <div>
                        <div className="font-['JetBrains_Mono'] text-sm font-bold text-[#f2ca50]">
                          {estOps.length}
                        </div>
                        <div className="font-['Outfit'] text-[10px] text-[#a0a6b5]">
                          Personnel
                        </div>
                      </div>
                      <div>
                        <div className="font-['JetBrains_Mono'] text-sm font-bold text-emerald-400">
                          {est.activeQueueCount}
                        </div>
                        <div className="font-['Outfit'] text-[10px] text-[#a0a6b5]">
                          En attente
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex flex-col gap-2 pt-3 border-t border-white/5">
                    {/* Row 1: Modifier + Fiche & QR */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleOpenEdit(est)}
                        className="py-2 px-3 bg-[#f2ca50] hover:bg-[#ffe088] text-[#3c2f00] font-['Outfit'] font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow"
                        title={`Modifier ${est.name}`}
                      >
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                        <span>Modifier</span>
                      </button>

                      <button
                        onClick={() => {
                          setSelectedEstablishment(est);
                          setSubTab('fiche');
                        }}
                        className="py-2 px-3 bg-[#1e222a] hover:bg-[#252a35] border border-white/10 rounded-lg text-xs font-['Outfit'] text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        title="Voir la fiche et le QR code"
                      >
                        <span className="material-symbols-outlined text-[15px] text-[#f2ca50]">
                          badge
                        </span>
                        <span>Fiche & QR</span>
                      </button>
                    </div>

                    {/* Row 2: Console Staff + Mode TV */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => onNavigate('console-personnel', est)}
                        className="py-2 px-3 bg-[#1e222a] hover:bg-[#252a35] border border-white/10 rounded-lg text-xs font-['Outfit'] text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        title="Ouvrir la console du personnel"
                      >
                        <span className="material-symbols-outlined text-[15px] text-[#f2ca50]">
                          counter_1
                        </span>
                        <span>Console Staff</span>
                      </button>

                      <button
                        onClick={() => onNavigate('affichage-ecran-tv', est)}
                        className="py-2 px-3 bg-[#1e222a] hover:bg-[#252a35] border border-white/10 rounded-lg text-xs font-['Outfit'] text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        title="Lancer l'écran TV public"
                      >
                        <span className="material-symbols-outlined text-[15px] text-[#f2ca50]">tv</span>
                        <span>Mode TV</span>
                      </button>
                    </div>

                    {/* Row 3: Supprimer */}
                    <button
                      onClick={() => setEstablishmentToDelete(est)}
                      className="w-full py-1.5 bg-[#93000a]/10 hover:bg-[#93000a]/25 border border-[#ffb4ab]/20 rounded-lg text-xs font-['Outfit'] text-[#ffb4ab] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      title="Supprimer cet établissement"
                    >
                      <span className="material-symbols-outlined text-[15px]">delete</span>
                      <span>Supprimer</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* SUB-TAB 2: FICHE ÉTABLISSEMENT             */}
      {/* ========================================== */}
      {subTab === 'fiche' && (
        <div className="flex flex-col gap-6">
          {/* Establishment Selector Dropdown */}
          <div className="bg-[#14171d] border border-white/10 rounded-2xl p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[#f2ca50] text-[24px]">apartment</span>
              <span className="font-['Outfit'] text-sm font-semibold text-white">
                Établissement sélectionné :
              </span>
            </div>
            <select
              value={selectedEstablishment.id}
              onChange={(e) => {
                const found = establishments.find((est) => est.id === e.target.value);
                if (found) setSelectedEstablishment(found);
              }}
              className="bg-[#1b1f27] border border-white/10 rounded-xl px-4 py-2 text-xs sm:text-sm font-['Outfit'] text-white focus:outline-none focus:border-[#f2ca50]"
            >
              {establishments.map((est) => (
                <option key={est.id} value={est.id}>
                  {est.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Details & Staff */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              {/* Identity Card */}
              <div className="bg-[#14171d] border border-white/10 rounded-2xl p-6 shadow-xl">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-[#1e222a] border border-[#f2ca50]/30 flex items-center justify-center text-[#f2ca50] overflow-hidden">
                      {selectedEstablishment.logoUrl ? (
                        <img
                          src={selectedEstablishment.logoUrl}
                          alt={selectedEstablishment.name}
                          className="w-full h-full object-contain p-1"
                        />
                      ) : (
                        <span className="material-symbols-outlined text-[32px]">
                          {selectedEstablishment.icon || 'apartment'}
                        </span>
                      )}
                    </div>
                    <div>
                      <h3 className="font-['Syne'] text-xl font-bold text-white">
                        {selectedEstablishment.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-[#a0a6b5] font-['Outfit']">
                          Établissement actif • File opérationnelle
                        </span>
                      </div>
                    </div>
                  </div>

                  <span
                    className={`px-3 py-1 rounded-full text-xs font-['JetBrains_Mono'] font-bold ${
                      selectedEstablishment.isContractActive
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    {selectedEstablishment.isContractActive ? 'CONTRAT ACTIF' : 'SUSPENDU'}
                  </span>
                </div>

                {/* Hidden input for fiche logo update */}
                <input
                  type="file"
                  ref={ficheFileInputRef}
                  onChange={(e) => handleFileSelect(e, true)}
                  accept="image/png, image/jpeg, image/jpg, image/webp"
                  className="hidden"
                />

                <div className="flex items-center justify-between bg-[#1b1f27] p-3 rounded-xl border border-white/5 text-xs font-['Outfit'] mb-4">
                  <div className="flex items-center gap-2 text-[#a0a6b5]">
                    <span className="material-symbols-outlined text-[#f2ca50] text-[18px]">verified</span>
                    <span>Établissement indépendant • Isolation stricte de file</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => ficheFileInputRef.current?.click()}
                    className="px-3 py-1.5 bg-[#1e222a] hover:bg-[#252a35] border border-[#f2ca50]/30 rounded-lg text-xs text-[#f2ca50] font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">upload_file</span>
                    <span>{selectedEstablishment.logoUrl ? 'Changer le symbole' : 'Importer un symbole'}</span>
                  </button>
                </div>

                {/* Direct Action Buttons */}
                <div className="flex flex-wrap gap-3 mt-6 pt-4 border-t border-white/5 items-center justify-between">
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => handleOpenEdit(selectedEstablishment)}
                      className="px-4 py-2.5 bg-[#f2ca50] hover:bg-[#ffe088] text-[#3c2f00] font-['Outfit'] text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow"
                      title="Modifier le nom, logo, code ou statut de cet établissement"
                    >
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                      <span>Modifier l'établissement</span>
                    </button>

                    <button
                      onClick={() => onNavigate('console-personnel', selectedEstablishment)}
                      className="px-4 py-2.5 bg-[#1e222a] hover:bg-[#252a35] border border-white/10 text-white font-['Outfit'] text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px] text-[#f2ca50]">counter_1</span>
                      <span>Ouvrir Console Personnel</span>
                    </button>

                    <button
                      onClick={() => onNavigate('affichage-ecran-tv', selectedEstablishment)}
                      className="px-4 py-2.5 bg-[#1e222a] hover:bg-[#252a35] border border-white/10 text-white font-['Outfit'] text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px] text-[#f2ca50]">tv</span>
                      <span>Lancer le Mode TV</span>
                    </button>
                  </div>

                  <button
                    onClick={() => setEstablishmentToDelete(selectedEstablishment)}
                    className="px-4 py-2.5 bg-[#93000a]/15 hover:bg-[#93000a]/30 border border-[#ffb4ab]/30 text-[#ffb4ab] font-['Outfit'] text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete_forever</span>
                    <span>Supprimer cet établissement</span>
                  </button>
                </div>
              </div>

              {/* Staff Accounts for this establishment */}
              <div className="bg-[#14171d] border border-white/10 rounded-2xl p-6 shadow-xl">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div>
                    <h4 className="font-['Syne'] text-base font-bold text-white">
                      Personnel Rattaché à cet Établissement
                    </h4>
                    <p className="font-['Outfit'] text-xs text-[#a0a6b5]">
                      Ces opérateurs ont un accès exclusif aux guichets de {selectedEstablishment.name}.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setNewOpEstablishmentId(selectedEstablishment.id);
                      setShowNewOpModal(true);
                    }}
                    className="px-3 py-1.5 bg-[#1e222a] hover:bg-[#252a35] border border-[#f2ca50]/30 text-[#f2ca50] text-xs font-['Outfit'] font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">person_add</span>
                    <span>+ Ajouter un opérateur</span>
                  </button>
                </div>

                <div className="flex flex-col gap-2">
                  {operators
                    .filter((op) => op.establishmentId === selectedEstablishment.id)
                    .map((op) => (
                      <div
                        key={op.id}
                        className="bg-[#181b22] border border-white/5 rounded-xl p-3.5 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-[#222631] border border-white/10 flex items-center justify-center font-['JetBrains_Mono'] text-xs font-bold text-[#f2ca50]">
                            {op.initials}
                          </div>
                          <div>
                            <div className="font-['Outfit'] text-sm font-semibold text-white">
                              {op.name}
                            </div>
                            <div className="font-['Outfit'] text-xs text-[#a0a6b5]">
                              {op.assignedDesk}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggleOperatorStatus(op)}
                            className={`px-2 py-1 rounded text-[10px] font-['JetBrains_Mono'] font-bold uppercase ${
                              op.status === 'online'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                : op.status === 'paused'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                                : 'bg-gray-500/10 text-gray-400 border border-gray-500/30'
                            }`}
                          >
                            {op.status}
                          </button>
                          <button
                            onClick={() => handleDeleteOperator(op.id, op.name)}
                            className="p-1.5 text-[#ffb4ab] hover:bg-[#93000a]/20 rounded transition-colors"
                            title="Supprimer le compte"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  {operators.filter((op) => op.establishmentId === selectedEstablishment.id).length === 0 && (
                    <div className="py-6 text-center text-xs text-[#a0a6b5] font-['Outfit']">
                      Aucun compte personnel configuré pour cet établissement.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Col: Unique QR Code Card */}
            <div className="flex flex-col gap-6">
              <div className="bg-[#14171d] border border-[#f2ca50]/30 rounded-2xl p-6 shadow-xl flex flex-col items-center text-center">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1e222a] border border-[#f2ca50]/20 text-[10px] font-['JetBrains_Mono'] text-[#f2ca50] font-semibold mb-4">
                  <span className="material-symbols-outlined text-[14px]">qr_code_2</span>
                  <span>QR CODE UNIQUE DÉDIÉ</span>
                </div>

                <h4 className="font-['Syne'] text-base font-bold text-white mb-1">
                  Accès Mobile Visiteur
                </h4>
                <p className="font-['Outfit'] text-xs text-[#a0a6b5] mb-5">
                  Ce QR Code permet aux visiteurs d'accéder directement au suivi en temps réel de leur ticket sur smartphone, sans saisie d'identifiant.
                </p>

                {/* QR Canvas / Image */}
                <div className="p-3 bg-[#0c0e12] rounded-2xl border border-[#f2ca50]/40 shadow-2xl mb-4">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt={`QR Code ${selectedEstablishment.name}`}
                      className="w-56 h-56 rounded-xl object-contain"
                    />
                  ) : (
                    <div className="w-56 h-56 flex items-center justify-center text-xs text-gray-500">
                      Génération du QR...
                    </div>
                  )}
                </div>

                <div className="w-full bg-[#1b1f27] p-2.5 rounded-lg border border-white/5 font-['Outfit'] text-xs text-[#a0a6b5] text-center mb-4">
                  Lien public de suivi mobile prêt à être partagé
                </div>

                <div className="w-full grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      const url = `${window.location.origin}?est=${selectedEstablishment.code}&tab=suivi-client-mobile`;
                      navigator.clipboard.writeText(url);
                      onShowToast('Lien de suivi copié dans le presse-papiers');
                    }}
                    className="py-2.5 bg-[#1e222a] hover:bg-[#252a35] border border-white/10 rounded-xl text-xs font-['Outfit'] text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">content_copy</span>
                    <span>Copier lien</span>
                  </button>

                  <a
                    href={qrDataUrl}
                    download={`QR-DALTEK-${selectedEstablishment.name.replace(/\s+/g, '-').toLowerCase()}.png`}
                    className="py-2.5 bg-[#f2ca50] hover:bg-[#ffe088] text-[#3c2f00] rounded-xl text-xs font-['Outfit'] font-bold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">download</span>
                    <span>Télécharger</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* SUB-TAB 3: PERSONNEL & COMPTES             */}
      {/* ========================================== */}
      {subTab === 'personnel' && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-['Syne'] text-lg font-bold text-white">
                Gestion des Comptes du Personnel
              </h3>
              <p className="font-['Outfit'] text-xs text-[#a0a6b5]">
                L'administrateur crée et supervise le personnel. Chaque membre se connecte grâce à son Code Staff unique.
              </p>
            </div>
            <button
              onClick={() => {
                setNewOpEstablishmentId(selectedEstablishment.id);
                setShowNewOpModal(true);
              }}
              className="px-4 py-2.5 bg-[#f2ca50] hover:bg-[#ffe088] text-[#3c2f00] font-['Outfit'] text-xs sm:text-sm font-bold rounded-xl transition-all shadow flex items-center gap-2 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">person_add</span>
              <span>+ Créer un compte personnel</span>
            </button>
          </div>

          <div className="bg-[#14171d] border border-white/10 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-['Outfit']">
                <thead className="bg-[#181b22] text-[#a0a6b5] font-['JetBrains_Mono'] uppercase tracking-wider text-[11px] border-b border-white/5">
                  <tr>
                    <th className="px-5 py-3.5">Opérateur</th>
                    <th className="px-5 py-3.5">Établissement Rattaché</th>
                    <th className="px-5 py-3.5">Guichet / Poste</th>
                    <th className="px-5 py-3.5">Statut</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {operators.map((op) => {
                    const est = establishments.find((e) => e.id === op.establishmentId);
                    return (
                      <tr key={op.id} className="hover:bg-[#181b22]/50 transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-[#222631] border border-white/10 flex items-center justify-center font-['JetBrains_Mono'] text-xs font-bold text-[#f2ca50]">
                              {op.initials}
                            </div>
                            <span className="font-semibold text-white text-sm">{op.name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="font-semibold text-white">{est?.name || 'Établissement'}</span>
                        </td>
                        <td className="px-5 py-4 text-white">
                          {op.assignedDesk}
                        </td>
                        <td className="px-5 py-4">
                          <button
                            onClick={() => handleToggleOperatorStatus(op)}
                            className={`px-2.5 py-1 rounded text-[10px] font-['JetBrains_Mono'] font-bold uppercase transition-colors ${
                              op.status === 'online'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                : op.status === 'paused'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                                : 'bg-gray-500/10 text-gray-400 border border-gray-500/30'
                            }`}
                          >
                            {op.status}
                          </button>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            onClick={() => handleDeleteOperator(op.id, op.name)}
                            className="p-1.5 text-[#ffb4ab] hover:bg-[#93000a]/20 rounded transition-colors"
                            title="Supprimer ce compte"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* SUB-TAB 4: JOURNAL D'AUDIT (WORM)          */}
      {/* ========================================== */}
      {subTab === 'audit' && (
        <div className="flex flex-col gap-6">
          <div>
            <h3 className="font-['Syne'] text-lg font-bold text-white">
              Journal d'Audit WORM & Traçabilité
            </h3>
            <p className="font-['Outfit'] text-xs text-[#a0a6b5]">
              Registre d'intégrité immuable consignateur de tous les événements d'identité, de gouvernance et de file.
            </p>
          </div>

          <div className="bg-[#14171d] border border-white/10 rounded-2xl p-4 shadow-xl">
            <div className="flex flex-col gap-3">
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="bg-[#181b22] border border-white/5 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-['Outfit']"
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-['JetBrains_Mono'] font-bold ${
                        log.category === 'GOUVERNANCE'
                          ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                          : log.category === 'IDENTITÉ'
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                          : log.category === 'FILE'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {log.category}
                    </span>
                    <div>
                      <div className="text-white font-medium">{log.description}</div>
                      <div className="text-[11px] text-[#a0a6b5] font-['JetBrains_Mono']">
                        Auteur: {log.author} • IP: {log.ip}
                      </div>
                    </div>
                  </div>

                  <span className="font-['JetBrains_Mono'] text-[#d0c5af] text-[11px] shrink-0">
                    {log.timestamp}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* SUB-TAB 5: PARAMÈTRES & SÉCURITÉ           */}
      {/* ========================================== */}
      {subTab === 'parametres' && (
        <div className="max-w-2xl flex flex-col gap-6">
          <div className="bg-[#14171d] border border-white/10 rounded-2xl p-6 shadow-xl">
            <h3 className="font-['Syne'] text-lg font-bold text-white mb-2">
              Modification du Code Administrateur Principal
            </h3>
            <p className="font-['Outfit'] text-xs text-[#a0a6b5] mb-6">
              Ce code contrôle l'intégralité du système DALTEK. Stocké avec salage cryptographique côté serveur.
            </p>

            {paramSuccessMsg && (
              <div className="mb-4 p-3 bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs font-['Outfit']">
                {paramSuccessMsg}
              </div>
            )}
            {paramErrorMsg && (
              <div className="mb-4 p-3 bg-[#93000a]/20 border border-[#ffb4ab]/30 rounded-xl text-[#ffb4ab] text-xs font-['Outfit']">
                {paramErrorMsg}
              </div>
            )}

            <form onSubmit={handleChangeCodeSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-['JetBrains_Mono'] uppercase tracking-wider text-[#d0c5af] mb-1.5">
                  Code Administrateur Actuel
                </label>
                <input
                  type="password"
                  value={currentAdminCode}
                  onChange={(e) => setCurrentAdminCode(e.target.value)}
                  className="w-full bg-[#1b1f27] border border-white/10 rounded-xl px-4 py-2.5 text-sm font-['JetBrains_Mono'] text-white focus:outline-none focus:border-[#f2ca50]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-['JetBrains_Mono'] uppercase tracking-wider text-[#d0c5af] mb-1.5">
                  Nouveau Code Administrateur (Minimum 4 caractères)
                </label>
                <input
                  type="password"
                  value={newAdminCode}
                  onChange={(e) => setNewAdminCode(e.target.value)}
                  className="w-full bg-[#1b1f27] border border-white/10 rounded-xl px-4 py-2.5 text-sm font-['JetBrains_Mono'] text-white focus:outline-none focus:border-[#f2ca50]"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-fit px-5 py-2.5 bg-[#f2ca50] hover:bg-[#ffe088] text-[#3c2f00] font-['Outfit'] text-xs font-bold rounded-xl transition-all shadow cursor-pointer mt-2"
              >
                Mettre à jour le code administrateur
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL: AJOUTER UN ÉTABLISSEMENT            */}
      {/* ========================================== */}
      {showNewEstModal && (
        <div className="fixed inset-0 z-50 bg-[#0c0e12]/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#14171d] border border-[#f2ca50]/40 rounded-2xl p-6 shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-['Syne'] text-lg font-bold text-white">
                Ajouter un Établissement
              </h3>
              <button
                onClick={() => setShowNewEstModal(false)}
                className="text-[#a0a6b5] hover:text-white"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateEstablishment} className="flex flex-col gap-4 text-xs font-['Outfit']">
              {/* 1. NOM */}
              <div>
                <label className="block font-['JetBrains_Mono'] text-[#d0c5af] mb-1 uppercase tracking-wider text-[11px]">
                  1. Nom de l'Établissement *
                </label>
                <input
                  type="text"
                  value={newEstName}
                  onChange={(e) => setNewEstName(e.target.value)}
                  placeholder="Ex: Banque Centrale, Clinique Pasteur, Restaurant L'Étoile..."
                  className="w-full bg-[#1b1f27] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#f2ca50]"
                  required
                />
              </div>

              {/* 2. CODE */}
              <div>
                <label className="block font-['JetBrains_Mono'] text-[#d0c5af] mb-1 uppercase tracking-wider text-[11px]">
                  2. Code de l'Établissement *
                </label>
                <input
                  type="text"
                  value={newEstCode}
                  onChange={(e) => setNewEstCode(e.target.value.toUpperCase())}
                  placeholder="Ex: BPH-01, CLINIQUE, RESTO75..."
                  className="w-full bg-[#1b1f27] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm font-['JetBrains_Mono'] text-white focus:outline-none focus:border-[#f2ca50]"
                  required
                />
                <p className="text-[10px] text-[#a0a6b5] mt-1">
                  Ce code identifie uniquement cet établissement et son QR Code.
                </p>
              </div>

              {/* 3. SYMBOLE / LOGO (Vrai upload de fichier de l'appareil) */}
              <div>
                <label className="block font-['JetBrains_Mono'] text-[#d0c5af] mb-1.5 uppercase tracking-wider text-[11px]">
                  3. Symbole / Logo de l'Établissement
                </label>

                {/* Hidden native file input */}
                <input
                  type="file"
                  ref={estFileInputRef}
                  onChange={(e) => handleFileSelect(e, false)}
                  accept="image/png, image/jpeg, image/jpg, image/webp"
                  className="hidden"
                />

                {newEstLogoUrl ? (
                  <div className="flex items-center gap-4 p-3 bg-[#1b1f27] rounded-xl border border-[#f2ca50]/30">
                    <img
                      src={newEstLogoUrl}
                      alt="Aperçu logo"
                      className="w-14 h-14 rounded-xl object-contain bg-[#0c0e12] border border-white/10 p-1"
                    />
                    <div className="flex flex-col gap-1 flex-1">
                      <span className="text-white font-medium text-xs">Symbole sélectionné</span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => estFileInputRef.current?.click()}
                          className="px-2.5 py-1 bg-[#1e222a] hover:bg-[#252a35] text-[#f2ca50] rounded-lg text-[11px] border border-white/10 cursor-pointer"
                        >
                          Changer le fichier
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewEstLogoUrl('')}
                          className="px-2.5 py-1 bg-[#93000a]/20 hover:bg-[#93000a]/40 text-[#ffb4ab] rounded-lg text-[11px] border border-red-500/20 cursor-pointer"
                        >
                          Supprimer
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => estFileInputRef.current?.click()}
                    className="w-full py-4 border border-dashed border-[#f2ca50]/50 hover:border-[#f2ca50] rounded-xl bg-[#1b1f27]/50 hover:bg-[#1b1f27] text-white flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    <span className="material-symbols-outlined text-[22px] text-[#f2ca50]">upload_file</span>
                    <span className="font-semibold text-xs">Importer un symbole depuis l'appareil (PNG, JPG, WEBP)</span>
                  </button>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 mt-4 pt-3 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowNewEstModal(false)}
                  className="px-4 py-2 bg-[#1b1f27] hover:bg-[#252a35] text-[#a0a6b5] rounded-xl transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#f2ca50] hover:bg-[#ffe088] text-[#3c2f00] font-bold rounded-xl transition-colors shadow cursor-pointer"
                >
                  Créer l'Établissement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL: MODIFIER UN ÉTABLISSEMENT           */}
      {/* ========================================== */}
      {editingEst && (
        <div className="fixed inset-0 z-50 bg-[#0c0e12]/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="w-full max-w-lg bg-[#14171d] border border-[#f2ca50]/40 rounded-2xl p-6 md:p-7 shadow-2xl animate-scaleUp font-['Outfit'] max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#f2ca50]/15 border border-[#f2ca50]/30 flex items-center justify-center text-[#f2ca50]">
                  <span className="material-symbols-outlined text-[22px]">edit</span>
                </div>
                <div>
                  <h3 className="font-['Syne'] text-lg font-bold text-white leading-tight">
                    Modifier l'Établissement
                  </h3>
                  <p className="text-xs text-[#a0a6b5]">
                    Modifications exclusives pour <strong className="text-white">{editingEst.name}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingEst(null)}
                className="p-1.5 text-[#a0a6b5] hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {editError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">error</span>
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="flex flex-col gap-4 text-xs">
              {/* 1. NOM DE L'ÉTABLISSEMENT */}
              <div>
                <label className="block font-['JetBrains_Mono'] text-[#d0c5af] mb-1.5 uppercase tracking-wider text-[11px] font-semibold">
                  1. Nom de l'établissement *
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Nom de l'établissement"
                  className="w-full bg-[#1b1f27] border border-white/10 focus:border-[#f2ca50] rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none transition-colors"
                  required
                />
              </div>

              {/* 2. SYMBOLE / LOGO (Sélecteur de fichier natif pour PC, mobile, tablette) */}
              <div>
                <label className="block font-['JetBrains_Mono'] text-[#d0c5af] mb-1.5 uppercase tracking-wider text-[11px] font-semibold">
                  2. Symbole / Logo de l'établissement
                </label>

                {/* Input fichier réel natif */}
                <input
                  type="file"
                  ref={editFileInputRef}
                  onChange={handleEditFileSelect}
                  accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml"
                  className="hidden"
                />

                {editLogoUrl ? (
                  <div className="flex items-center gap-4 p-3.5 bg-[#1b1f27] rounded-xl border border-[#f2ca50]/30">
                    <img
                      src={editLogoUrl}
                      alt="Logo sélectionné"
                      className="w-16 h-16 rounded-xl object-contain bg-[#0c0e12] border border-white/10 p-1 shadow"
                    />
                    <div className="flex flex-col gap-2 flex-1">
                      <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-xs">
                        <span className="material-symbols-outlined text-[16px]">check_circle</span>
                        <span>Logo configuré</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => editFileInputRef.current?.click()}
                          className="px-3 py-1.5 bg-[#1e222a] hover:bg-[#252a35] text-[#f2ca50] rounded-lg text-xs font-semibold border border-white/10 flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <span className="material-symbols-outlined text-[15px]">upload_file</span>
                          <span>Remplacer le fichier</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditLogoUrl('')}
                          className="px-3 py-1.5 bg-[#93000a]/20 hover:bg-[#93000a]/40 text-[#ffb4ab] rounded-lg text-xs font-semibold border border-red-500/20 flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <span className="material-symbols-outlined text-[15px]">delete</span>
                          <span>Supprimer le logo</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() => editFileInputRef.current?.click()}
                      className="w-full py-4 border-2 border-dashed border-[#f2ca50]/40 hover:border-[#f2ca50] rounded-xl bg-[#1b1f27]/50 hover:bg-[#1b1f27] text-white flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <span className="material-symbols-outlined text-[26px] text-[#f2ca50]">upload_file</span>
                      <span className="font-semibold text-xs text-white">Importer un fichier depuis l'appareil</span>
                      <span className="text-[10px] text-[#a0a6b5]">Compatible PC, Mac, Téléphone, Tablette (PNG, JPG, WEBP, SVG)</span>
                    </button>

                    <div>
                      <span className="text-[11px] text-[#a0a6b5] block mb-1.5">Ou choisir une icône standard :</span>
                      <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                        {['apartment', 'store', 'local_hospital', 'business', 'school', 'account_balance', 'restaurant', 'local_pharmacy'].map((ico) => (
                          <button
                            key={ico}
                            type="button"
                            onClick={() => setEditIcon(ico)}
                            className={`p-2 rounded-xl flex items-center justify-center border transition-all cursor-pointer ${
                              editIcon === ico
                                ? 'bg-[#f2ca50]/20 border-[#f2ca50] text-[#f2ca50]'
                                : 'bg-[#1b1f27] border-white/5 text-[#a0a6b5] hover:text-white hover:border-white/20'
                            }`}
                            title={ico}
                          >
                            <span className="material-symbols-outlined text-[20px]">{ico}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 3. CODE DE L'ÉTABLISSEMENT (SÉCURISÉ / MASQUÉ) */}
              <div>
                <label className="block font-['JetBrains_Mono'] text-[#d0c5af] mb-1.5 uppercase tracking-wider text-[11px] font-semibold">
                  3. Code d'accès établissement (Optionnel / Sécurisé)
                </label>
                <div className="relative">
                  <input
                    type={showEditCode ? 'text' : 'password'}
                    value={editNewCode}
                    onChange={(e) => setEditNewCode(e.target.value.toUpperCase())}
                    placeholder="•••••• (Laisser vide pour conserver le code actuel)"
                    className="w-full bg-[#1b1f27] border border-white/10 rounded-xl pl-3.5 pr-10 py-2.5 text-sm font-['JetBrains_Mono'] text-[#f2ca50] focus:outline-none focus:border-[#f2ca50]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditCode(!showEditCode)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a0a6b5] hover:text-white cursor-pointer"
                    title={showEditCode ? 'Masquer' : 'Afficher'}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {showEditCode ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
                <p className="text-[10px] text-[#a0a6b5] mt-1">
                  Par mesure de sécurité stricte, le code actuel n'est jamais affiché en clair. Renseignez ce champ uniquement pour le renouveler.
                </p>
              </div>

              {/* 4. STATUT OPÉRATIONNEL */}
              <div>
                <label className="block font-['JetBrains_Mono'] text-[#d0c5af] mb-1.5 uppercase tracking-wider text-[11px] font-semibold">
                  4. Statut du service
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditIsContractActive(true)}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      editIsContractActive
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                        : 'bg-[#1b1f27] border-white/10 text-[#a0a6b5]'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>Actif (Service ouvert)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditIsContractActive(false)}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      !editIsContractActive
                        ? 'bg-rose-500/15 border-rose-500/40 text-rose-400'
                        : 'bg-[#1b1f27] border-white/10 text-[#a0a6b5]'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-rose-400" />
                    <span>Suspendu</span>
                  </button>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-white/10">
                <button
                  type="button"
                  disabled={editIsSaving}
                  onClick={() => setEditingEst(null)}
                  className="px-4 py-2.5 bg-[#1b1f27] hover:bg-[#252a35] text-[#a0a6b5] hover:text-white rounded-xl text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={editIsSaving}
                  className="px-5 py-2.5 bg-[#f2ca50] hover:bg-[#ffe088] text-[#3c2f00] font-bold rounded-xl text-xs transition-all shadow cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  {editIsSaving ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-[#3c2f00] border-t-transparent rounded-full animate-spin" />
                      <span>Enregistrement...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">save</span>
                      <span>Enregistrer les modifications</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL: AJOUTER UN MEMBRE DU PERSONNEL      */}
      {/* ========================================== */}
      {showNewOpModal && (
        <div className="fixed inset-0 z-50 bg-[#0c0e12]/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#14171d] border border-[#f2ca50]/40 rounded-2xl p-6 shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-['Syne'] text-lg font-bold text-white">
                Ajouter un Membre du Personnel
              </h3>
              <button
                onClick={() => setShowNewOpModal(false)}
                className="text-[#a0a6b5] hover:text-white"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateOperator} className="flex flex-col gap-4 text-xs font-['Outfit']">
              <div>
                <label className="block font-['JetBrains_Mono'] text-[#d0c5af] mb-1">
                  Établissement Rattaché
                </label>
                <select
                  value={newOpEstablishmentId}
                  onChange={(e) => setNewOpEstablishmentId(e.target.value)}
                  className="w-full bg-[#1b1f27] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#f2ca50]"
                >
                  {establishments.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-['JetBrains_Mono'] text-[#d0c5af] mb-1">
                  Nom du Membre du Personnel *
                </label>
                <input
                  type="text"
                  value={newOpName}
                  onChange={(e) => setNewOpName(e.target.value)}
                  placeholder="Ex: Sarah Guérin"
                  className="w-full bg-[#1b1f27] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#f2ca50]"
                  required
                />
              </div>

              <div>
                <label className="block font-['JetBrains_Mono'] text-[#d0c5af] mb-1">
                  Code Staff (Pour sa connexion)
                </label>
                <input
                  type="password"
                  value={newOpStaffCode}
                  onChange={(e) => setNewOpStaffCode(e.target.value.toUpperCase())}
                  placeholder="Définir le code d'accès Staff..."
                  className="w-full bg-[#1b1f27] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm font-['JetBrains_Mono'] text-[#f2ca50] focus:outline-none focus:border-[#f2ca50]"
                />
                <p className="text-[10px] text-[#a0a6b5] mt-1">
                  Ce code unique permet au membre de se connecter directement à son établissement.
                </p>
              </div>

              <div>
                <label className="block font-['JetBrains_Mono'] text-[#d0c5af] mb-1">
                  Guichet / Poste Assigné
                </label>
                <input
                  type="text"
                  value={newOpDesk}
                  onChange={(e) => setNewOpDesk(e.target.value)}
                  placeholder="Ex: Guichet 1, Accueil, Bureau 02..."
                  className="w-full bg-[#1b1f27] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#f2ca50]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 mt-4 pt-3 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowNewOpModal(false)}
                  className="px-4 py-2 bg-[#1b1f27] hover:bg-[#252a35] text-[#a0a6b5] rounded-xl transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#f2ca50] hover:bg-[#ffe088] text-[#3c2f00] font-bold rounded-xl transition-colors shadow cursor-pointer"
                >
                  Créer le Compte Staff
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL: CONFIRMATION SUPPRESSION ÉTABLISSEMENT */}
      {/* ========================================== */}
      {establishmentToDelete && (
        <div className="fixed inset-0 z-50 bg-[#0c0e12]/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="w-full max-w-md bg-[#14171d] border border-[#ffb4ab]/40 rounded-3xl p-6 md:p-8 shadow-2xl animate-scaleUp text-center font-['Outfit']">
            <div className="w-14 h-14 rounded-2xl bg-[#93000a]/20 border border-[#ffb4ab]/30 flex items-center justify-center text-[#ffb4ab] mb-5 mx-auto">
              <span className="material-symbols-outlined text-[32px]">warning</span>
            </div>

            <h3 className="font-['Syne'] text-xl font-bold text-white mb-2">
              Supprimer {establishmentToDelete.name} ?
            </h3>

            <p className="text-sm text-[#ffb4ab] leading-relaxed mb-6 font-medium">
              Voulez-vous vraiment supprimer cet établissement ? Cette action supprimera son accès et ses données associées.
            </p>

            <div className="bg-[#1b1f27] p-3.5 rounded-2xl border border-white/5 mb-6 text-xs text-[#a0a6b5] text-left">
              <ul className="list-disc list-inside space-y-1">
                <li>Suppression définitive et persistante de la base de données</li>
                <li>Fermeture immédiate de la file d'attente et déconnexion des guichets</li>
                <li>Révocation des accès Staff rattachés</li>
              </ul>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setEstablishmentToDelete(null)}
                className="py-3 bg-[#1b1f27] hover:bg-[#252a35] text-[#a0a6b5] rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
              >
                Annuler
              </button>

              <button
                type="button"
                disabled={isDeleting}
                onClick={confirmDeleteEstablishment}
                className="py-3 bg-[#93000a] hover:bg-[#b3141f] active:bg-[#7a0006] text-white rounded-xl text-xs font-bold transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Suppression...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">delete_forever</span>
                    <span>Confirmer la suppression</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
