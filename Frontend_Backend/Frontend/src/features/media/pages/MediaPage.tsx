import React, { useCallback, useState, useEffect } from 'react';
import { isAxiosError } from 'axios';
import {
  Boxes,
  Image as ImageIcon,
  Layers,
  Upload,
  Copy,
  Check,
  Trash2,
  ExternalLink,
  Search,
  Activity,
  HardDrive,
  Zap,
  Info,
  X,
  FileBox,
  Shirt,
  Brain,
  AlertTriangle,
  ShieldAlert,
  Archive,
  Link2,
} from 'lucide-react';
import {
  mediaService,
  type MediaAsset,
  type StorageStats,
  type MediaType,
  type SystemFunction,
  type DependencyVerificationResult,
  type OrphanCleanupResult,
} from '../services/mediaService';
import { useAuthStore } from '@/features/auth';

function getMediaErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError<{ message?: string }>(error)) {
    const message = error.response?.data?.message;
    if (typeof message === 'string') return message;
  }
  return fallback;
}

function isSystemFunction(value: string): value is SystemFunction {
  return [
    'catalogo_prendas',
    'probador_virtual_3d',
    'motor_inferencia_ia',
    'perfil_usuario',
    'galeria_marketing',
    'general',
  ].includes(value);
}

export function MediaPage() {
  const user = useAuthStore((state) => state.user);
  const isAuthorized = user?.role === 'admin' || user?.role === 'manager';

  const [activeTab, setActiveTab] = useState<MediaType | 'all'>('all');
  const [selectedFunction, setSelectedFunction] = useState<SystemFunction | 'all'>('all');
  const [search, setSearch] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Upload modal state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadMediaType, setUploadMediaType] = useState<MediaType>('photo');
  const [uploadFunction, setUploadFunction] = useState<SystemFunction>('galeria_marketing');
  const [uploadTextureType, setUploadTextureType] = useState('albedo');
  const [uploadComponentTag, setUploadComponentTag] = useState('');
  const [uploadComponentsList, setUploadComponentsList] = useState<string[]>([]);
  const [uploadMode, setUploadMode] = useState<'standard' | 'direct_s3'>('standard');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);

  // Detail / CDN Inspection Modal
  const [inspectAsset, setInspectAsset] = useState<MediaAsset | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Dependency Verification & Deletion Modal (Regla 3 HU-033)
  const [depCheckModal, setDepCheckModal] = useState<DependencyVerificationResult | null>(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [orphanPreview, setOrphanPreview] = useState<OrphanCleanupResult | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [mediaRes, statsRes] = await Promise.all([
        mediaService.listMedia(activeTab, selectedFunction, submittedSearch),
        mediaService.getStorageStats(),
      ]);
      setAssets(mediaRes.data);
      setStats(statsRes);
    } catch (error: unknown) {
      console.error('Error al supervisar recursos:', error);
      setError('Error al conectar con el servicio de supervisión de multimedia y modelos.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, selectedFunction, submittedSearch]);

  useEffect(() => {
    void Promise.resolve().then(loadData);
  }, [loadData]);

  /** Primero simula (dryRun) y, si se confirma, elimina y muestra el espacio liberado. */
  const handleOrphanCleanup = async (confirmDelete = false) => {
    setIsProcessingAction(true);
    try {
      const result = await mediaService.cleanupOrphans(!confirmDelete);
      if (confirmDelete) {
        setOrphanPreview(null);
        setActionFeedback({ type: 'success', message: `Se eliminaron ${result.orphanCount} archivos huérfanos y se liberaron ${(result.freedBytes / 1024 / 1024).toFixed(2)} MB.` });
        await loadData();
      } else {
        setOrphanPreview(result);
      }
    } catch {
      setActionFeedback({ type: 'error', message: 'No se pudo revisar el almacenamiento.' });
    } finally {
      setIsProcessingAction(false);
    }
  };


  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (search === submittedSearch) {
      void loadData();
    } else {
      setSubmittedSearch(search);
    }
  };

  const handleCopyUrl = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setUploadTitle(file.name.replace(/\.[^/.]+$/, ''));

    const name = file.name.toLowerCase();
    if (name.endsWith('.pt') || name.endsWith('.pth') || name.endsWith('.onnx') || name.endsWith('.bin')) {
      setUploadMediaType('ai_component');
      setUploadFunction('motor_inferencia_ia');
      setUploadComponentsList(['Microservicio Inferencia IA (backend/ai)', 'Pipeline CI/CD AWS ECS']);
    } else if (name.includes('prenda') || name.includes('shirt') || name.includes('jacket') || name.includes('pant')) {
      setUploadMediaType('garment');
      setUploadFunction('catalogo_prendas');
      setUploadComponentsList(['Catálogo de Prendas Bellia', 'Visualizador WebGL 3D']);
    } else if (name.endsWith('.glb') || name.endsWith('.gltf') || name.endsWith('.obj') || name.endsWith('.fbx') || name.endsWith('.stl')) {
      setUploadMediaType('model_3d');
      setUploadFunction('probador_virtual_3d');
      setUploadComponentsList(['Probador Virtual Three.js']);
    } else if (name.includes('normal') || name.includes('rough') || name.includes('metal') || name.endsWith('.tga') || name.endsWith('.hdr')) {
      setUploadMediaType('texture');
      setUploadFunction('probador_virtual_3d');
      setUploadComponentsList(['Material PBR Probador Virtual']);
    } else {
      setUploadMediaType('photo');
      setUploadFunction('galeria_marketing');
      setUploadComponentsList(['Catálogo Comercial', 'Banner Principal']);
    }
  };

  const handleAddComponentTag = () => {
    if (uploadComponentTag.trim() && !uploadComponentsList.includes(uploadComponentTag.trim())) {
      setUploadComponentsList([...uploadComponentsList, uploadComponentTag.trim()]);
      setUploadComponentTag('');
    }
  };

  const handleRemoveComponentTag = (index: number) => {
    setUploadComponentsList(uploadComponentsList.filter((_, i) => i !== index));
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    try {
      setUploading(true);
      setUploadProgress(10);

      if (uploadMode === 'direct_s3') {
        const presigned = await mediaService.createPresignedUpload({
          filename: selectedFile.name,
          contentType: selectedFile.type || 'application/octet-stream',
          mediaType: uploadMediaType,
          systemFunction: uploadFunction,
          title: uploadTitle,
          textureType: uploadMediaType === 'texture' ? uploadTextureType : undefined,
          usedByComponents: uploadComponentsList,
        });

        setUploadProgress(40);

        await fetch(presigned.uploadUrl, {
          method: 'PUT',
          body: selectedFile,
          headers: {
            'Content-Type': presigned.mimeType,
          },
        });

        setUploadProgress(85);

        await mediaService.confirmPresignedUpload({
          key: presigned.key,
          originalFilename: selectedFile.name,
          title: uploadTitle || selectedFile.name,
          mediaType: uploadMediaType,
          systemFunction: uploadFunction,
          mimeType: presigned.mimeType,
          sizeBytes: selectedFile.size,
          textureType: uploadMediaType === 'texture' ? uploadTextureType : undefined,
          usedByComponents: uploadComponentsList,
        });
      } else {
        await mediaService.uploadMedia(
          selectedFile,
          {
            title: uploadTitle,
            mediaType: uploadMediaType,
            systemFunction: uploadFunction,
            textureType: uploadMediaType === 'texture' ? uploadTextureType : undefined,
            usedByComponents: uploadComponentsList,
          },
          (percent) => setUploadProgress(percent),
        );
      }

      setUploadProgress(100);
      setIsUploadModalOpen(false);
      setSelectedFile(null);
      setUploadProgress(null);
      setLoading(true);
      await loadData();
    } catch (error: unknown) {
      console.error('Error al subir recurso:', error);
      alert(getMediaErrorMessage(error, 'Error al subir recurso a S3/CDN'));
    } finally {
      setUploading(false);
    }
  };

  // Apertura del modal de verificación de dependencias (Regla 3 HU-033)
  const handleInitiateDelete = async (asset: MediaAsset) => {
    try {
      setIsProcessingAction(true);
      const verification = await mediaService.verifyDependencies(asset.id);
      setDepCheckModal(verification);
    } catch (error: unknown) {
      alert(getMediaErrorMessage(error, 'Error al verificar dependencias'));
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Retirar de forma segura (Marca como retirado e inactivo)
  const handleConfirmRetire = async () => {
    if (!depCheckModal) return;
    try {
      setIsProcessingAction(true);
      await mediaService.retireMedia(depCheckModal.asset.id);
      setActionFeedback({
        type: 'success',
        message: `El recurso "${depCheckModal.asset.title}" fue retirado y archivado de forma segura sin romper componentes.`,
      });
      setDepCheckModal(null);
      setLoading(true);
      await loadData();
    } catch (error: unknown) {
      alert(getMediaErrorMessage(error, 'Error al retirar recurso'));
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Eliminación física forzada
  const handleConfirmDelete = async (force: boolean) => {
    if (!depCheckModal) return;
    try {
      setIsProcessingAction(true);
      await mediaService.deleteMedia(depCheckModal.asset.id, force);
      setActionFeedback({
        type: 'success',
        message: `El recurso "${depCheckModal.asset.title}" ha sido eliminado definitivamente de S3 y CDN.`,
      });
      setDepCheckModal(null);
      setLoading(true);
      await loadData();
    } catch (error: unknown) {
      alert(getMediaErrorMessage(error, 'Error al eliminar recurso'));
    } finally {
      setIsProcessingAction(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const getFunctionBadge = (func: SystemFunction) => {
    switch (func) {
      case 'catalogo_prendas':
        return { label: 'Catálogo Prendas', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' };
      case 'probador_virtual_3d':
        return { label: 'Probador Virtual 3D', color: 'bg-purple-500/10 text-purple-600 border-purple-500/20' };
      case 'motor_inferencia_ia':
        return { label: 'Inferencia IA', color: 'bg-rose-500/10 text-rose-600 border-rose-500/20' };
      case 'galeria_marketing':
        return { label: 'Marketing / Lookbook', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' };
      case 'perfil_usuario':
        return { label: 'Perfil Usuario', color: 'bg-amber-500/10 text-amber-600 border-amber-500/20' };
      default:
        return { label: 'General', color: 'bg-muted text-muted-foreground border-border' };
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* CP-033-03: alerta de almacenamiento por encima del umbral */}
      {stats?.usage?.alert && (
        <div role="alert" className="p-4 rounded-xl border bg-destructive/10 border-destructive/30 text-destructive text-sm">
          El almacenamiento está al {stats.usage.usagePercent} % de la cuota ({stats.usage.quotaGb} GB). Se abrió una incidencia de prioridad alta.
          Revisa los recursos o ejecuta la limpieza de archivos huérfanos.
        </div>
      )}

      {/* CP-033-04: limpieza de archivos huérfanos */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={isProcessingAction}
          onClick={() => void handleOrphanCleanup()}
          className="px-3 py-2 rounded-xl border border-border text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50"
        >
          Buscar archivos huérfanos
        </button>
        {orphanPreview && (
          <span className="text-xs text-muted-foreground">
            {orphanPreview.orphanCount} archivos sin referencia ({(orphanPreview.orphanBytes / 1024 / 1024).toFixed(2)} MB).
            {orphanPreview.orphanCount > 0 && (
              <button
                type="button"
                disabled={isProcessingAction}
                onClick={() => void handleOrphanCleanup(true)}
                className="ml-2 underline font-semibold text-destructive disabled:opacity-50"
              >
                Eliminarlos
              </button>
            )}
          </span>
        )}
      </div>

      {/* Feedback Toast */}
      {actionFeedback && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between animate-in fade-in duration-200 ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
              : 'bg-destructive/10 border-destructive/30 text-destructive'
          }`}
        >
          <div className="flex items-center gap-2">
            <Check className="size-4 shrink-0" />
            <span className="text-xs font-semibold">{actionFeedback.message}</span>
          </div>
          <button
            onClick={() => setActionFeedback(null)}
            className="text-xs underline font-medium hover:opacity-80"
          >
            Entendido
          </button>
        </div>
      )}

      {/* Header con Estado de Supervisión & CDN */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card border border-border p-6 rounded-2xl shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Supervisión de Recursos Multimedia y Modelos [HU-033]
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              S3 / CDN Activo
            </span>
            {isAuthorized ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                Rol Autorizado: {user?.role.toUpperCase()}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                Modo Solo Lectura
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Control y supervisión de fotografías, prendas digitales, modelos 3D y componentes de IA organizados por tipo y función, con verificación estricta de dependencias activas.
          </p>
        </div>

        {isAuthorized && (
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-sm cursor-pointer"
          >
            <Upload className="size-4" />
            Registrar / Subir Recurso
          </button>
        )}
      </div>

      {/* Tarjetas de Métricas de Almacenamiento & Supervisión */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Recursos Totales */}
        <div className="bg-card border border-border p-5 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Recursos Supervisados</span>
            <HardDrive className="size-4 text-primary" />
          </div>
          <div className="text-2xl font-bold text-foreground">
            {stats?.totalAssets || assets.length}
          </div>
          <p className="text-xs text-muted-foreground">
            {stats?.breakdown.photos || 0} fotos • {stats?.breakdown.garments || 0} prendas • {stats?.breakdown.models3d || 0} 3D • {stats?.breakdown.aiComponents || 0} IA
          </p>
        </div>

        {/* Card 2: Dependencias Activas Protegidas */}
        <div className="bg-card border border-border p-5 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Con Dependencias Activas</span>
            <Link2 className="size-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold text-foreground flex items-baseline gap-2">
            <span>{stats?.supervision?.activeWithDependencies || 0}</span>
            <span className="text-xs font-semibold text-purple-600 bg-purple-500/10 px-1.5 py-0.5 rounded">
              Protegidos
            </span>
          </div>
          <p className="text-xs text-muted-foreground">Bloqueo de eliminación accidental activo</p>
        </div>

        {/* Card 3: Almacenamiento S3 */}
        <div className="bg-card border border-border p-5 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Volumen en S3</span>
            <Boxes className="size-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-foreground">
            {stats?.usage?.usedFormatted || stats?.totalStorageFormatted || '0 MB'}
          </div>
          {stats?.usage ? (
            <div className="space-y-1">
              <div className="h-2 rounded-full bg-muted overflow-hidden" role="progressbar" aria-valuenow={stats.usage.usagePercent} aria-valuemin={0} aria-valuemax={100} aria-label="Uso del almacenamiento">
                <div className={`h-2 ${stats.usage.alert ? 'bg-destructive' : 'bg-primary'}`} style={{ width: `${Math.min(100, stats.usage.usagePercent)}%` }} />
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.usage.usagePercent} % de {stats.usage.quotaGb} GB · {stats.usage.fileCount} archivos
              </p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground truncate">Bucket: {stats?.cdnStatus.bucket || 'bellia-media'}</p>
          )}
        </div>

        {/* Card 4: Ancho de Banda y CDN */}
        <div className="bg-card border border-border p-5 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Entrega de archivos</span>
            <Zap className="size-4 text-amber-500" />
          </div>
          <div className="text-lg font-bold text-foreground">
            {stats ? stats.cdnStatus.edgeCaching : 'Cargando…'}
          </div>
          <p className="text-xs text-muted-foreground">Caché: {stats?.cdnStatus.cacheTtl ?? '—'}</p>
        </div>
      </div>

      {/* Barra de Filtros por Tipo, Función y Búsqueda */}
      <div className="space-y-3">
        {/* Fila 1: Pestañas de Tipo de Recurso */}
        <div className="flex flex-wrap items-center gap-2 p-1.5 bg-muted/60 rounded-xl border border-border">
          <button
            onClick={() => { if (activeTab !== 'all') { setLoading(true); setActiveTab('all'); } }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
              activeTab === 'all'
                ? 'bg-card text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Todos los Tipos
          </button>
          <button
            onClick={() => { if (activeTab !== 'photo') { setLoading(true); setActiveTab('photo'); } }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
              activeTab === 'photo'
                ? 'bg-card text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <ImageIcon className="size-3.5 text-blue-500" />
            Fotografías
          </button>
          <button
            onClick={() => { if (activeTab !== 'garment') { setLoading(true); setActiveTab('garment'); } }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
              activeTab === 'garment'
                ? 'bg-card text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Shirt className="size-3.5 text-emerald-500" />
            Prendas Digitales
          </button>
          <button
            onClick={() => { if (activeTab !== 'model_3d') { setLoading(true); setActiveTab('model_3d'); } }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
              activeTab === 'model_3d'
                ? 'bg-card text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileBox className="size-3.5 text-purple-500" />
            Modelos 3D
          </button>
          <button
            onClick={() => { if (activeTab !== 'ai_component') { setLoading(true); setActiveTab('ai_component'); } }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
              activeTab === 'ai_component'
                ? 'bg-card text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Brain className="size-3.5 text-rose-500" />
            Componentes de IA
          </button>
          <button
            onClick={() => { if (activeTab !== 'texture') { setLoading(true); setActiveTab('texture'); } }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
              activeTab === 'texture'
                ? 'bg-card text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Layers className="size-3.5 text-amber-500" />
            Texturas PBR
          </button>
        </div>

        {(activeTab === 'model_3d' || activeTab === 'garment' || activeTab === 'texture') && (
          <p className="text-xs text-muted-foreground bg-muted/50 border border-border rounded-lg px-3 py-2">
            El avatar del probador y su ropa se generan en el servicio de IA (maniquí MakeHuman). Los modelos 3D,
            prendas y texturas que se suban aquí se guardan, pero la app todavía no los usa.
          </p>
        )}

        {/* Fila 2: Filtro por Función en Plataforma y Búsqueda */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            <span className="text-xs text-muted-foreground font-semibold whitespace-nowrap">
              Función de Plataforma:
            </span>
            <select
              value={selectedFunction}
              onChange={(e) => {
                const value = e.target.value;
                if (value === 'all' || isSystemFunction(value)) {
                  if (value !== selectedFunction) {
                    setLoading(true);
                    setSelectedFunction(value);
                  }
                }
              }}
              className="px-3 py-1.5 text-xs rounded-xl bg-card border border-border text-foreground font-medium"
            >
              <option value="all">Todas las Funciones</option>
              <option value="catalogo_prendas">Catálogo de Prendas</option>
              <option value="probador_virtual_3d">Probador Virtual 3D</option>
              <option value="motor_inferencia_ia">Motor de Inferencia de IA</option>
              <option value="galeria_marketing">Galería y Marketing</option>
              <option value="perfil_usuario">Perfil de Usuario</option>
            </select>
          </div>

          <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por nombre o archivo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-card border border-border focus:ring-2 focus:ring-primary/40 text-foreground"
            />
          </form>
        </div>
      </div>

      {/* Grid de Recursos Supervisados */}
      {loading ? (
        <div className="py-20 text-center space-y-3">
          <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Cargando catálogo de recursos multimedia y modelos...</p>
        </div>
      ) : error ? (
        <div className="p-6 text-center bg-destructive/10 text-destructive border border-destructive/20 rounded-2xl">
          {error}
        </div>
      ) : assets.length === 0 ? (
        <div className="py-20 text-center bg-card border border-border rounded-2xl space-y-4">
          <div className="size-14 rounded-2xl bg-muted flex items-center justify-center mx-auto text-muted-foreground">
            <Boxes className="size-7" />
          </div>
          <div className="space-y-1">
            <h3 className="font-semibold text-foreground">No se encontraron recursos en este filtro</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Supervisa fotografías, prendas, modelos 3D y componentes de IA organizados por función en la plataforma.
            </p>
          </div>
          {isAuthorized && (
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition cursor-pointer"
            >
              <Upload className="size-3.5" />
              Subir primer recurso
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {assets.map((asset) => {
            const funcBadge = getFunctionBadge(asset.systemFunction);
            const depsCount = asset.usedByComponents?.length || 0;

            return (
              <div
                key={asset.id}
                className="group bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/50 transition-all duration-200 flex flex-col justify-between shadow-xs hover:shadow-md"
              >
                {/* Preview Thumbnail Container */}
                <div className="relative aspect-video bg-muted/40 overflow-hidden flex items-center justify-center border-b border-border">
                  {asset.mediaType === 'photo' || (asset.mediaType === 'texture' && !asset.extension.includes('hdr')) ? (
                    <img
                      src={asset.cdnUrl}
                      alt={asset.title}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : asset.mediaType === 'garment' ? (
                    <div className="flex flex-col items-center justify-center gap-2 text-emerald-500">
                      <div className="size-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Shirt className="size-6 text-emerald-500" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Prenda Digital
                      </span>
                    </div>
                  ) : asset.mediaType === 'model_3d' ? (
                    <div className="flex flex-col items-center justify-center gap-2 text-purple-500">
                      <div className="size-12 rounded-2xl bg-purple-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <FileBox className="size-6 text-purple-500" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {String(asset.metadata?.format || 'Modelo 3D')}
                      </span>
                    </div>
                  ) : asset.mediaType === 'ai_component' ? (
                    <div className="flex flex-col items-center justify-center gap-2 text-rose-500">
                      <div className="size-12 rounded-2xl bg-rose-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Brain className="size-6 text-rose-500" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {String(asset.metadata?.framework || 'Pesos IA')}
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-2 text-amber-500">
                      <div className="size-12 rounded-2xl bg-amber-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Layers className="size-6 text-amber-500" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {String(asset.metadata?.textureType || 'TEXTURA').toUpperCase()}
                      </span>
                    </div>
                  )}

                  {/* Badge de Tipo */}
                  <div className="absolute top-2.5 left-2.5">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold backdrop-blur-md shadow-xs ${
                        asset.mediaType === 'photo'
                          ? 'bg-blue-600/90 text-white'
                          : asset.mediaType === 'garment'
                            ? 'bg-emerald-600/90 text-white'
                            : asset.mediaType === 'model_3d'
                              ? 'bg-purple-600/90 text-white'
                              : asset.mediaType === 'ai_component'
                                ? 'bg-rose-600/90 text-white'
                                : 'bg-amber-600/90 text-white'
                      }`}
                    >
                      {asset.mediaType === 'photo'
                        ? 'FOTOGRAFÍA'
                        : asset.mediaType === 'garment'
                          ? 'PRENDA 3D'
                          : asset.mediaType === 'model_3d'
                            ? 'MODELO 3D'
                            : asset.mediaType === 'ai_component'
                              ? 'COMPONENTE IA'
                              : 'TEXTURA PBR'}
                    </span>
                  </div>

                  {/* Badge de Dependencias / Estado */}
                  <div className="absolute top-2.5 right-2.5 flex items-center gap-1">
                    {depsCount > 0 ? (
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-purple-900/80 text-purple-200 border border-purple-400/40 backdrop-blur-md"
                        title={`En uso activo por: ${asset.usedByComponents.join(', ')}`}
                      >
                        <Link2 className="size-2.5" />
                        {depsCount} dep.
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-medium bg-black/60 text-muted-foreground backdrop-blur-md">
                        Sin dep.
                      </span>
                    )}
                  </div>
                </div>

                {/* Body informativo */}
                <div className="p-4 space-y-2.5 flex-1 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-1">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${funcBadge.color}`}>
                        {funcBadge.label}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {formatBytes(Number(asset.sizeBytes))}
                      </span>
                    </div>

                    <h4 className="font-semibold text-xs text-foreground line-clamp-1 title" title={asset.title}>
                      {asset.title}
                    </h4>
                    <p className="text-[11px] text-muted-foreground truncate" title={asset.originalFilename}>
                      {asset.originalFilename}
                    </p>
                  </div>

                  {/* Componentes dependientes */}
                  {depsCount > 0 && (
                    <div className="p-2 rounded-lg bg-muted/40 border border-border/60 text-[10px] space-y-1">
                      <span className="font-semibold text-muted-foreground flex items-center gap-1">
                        <Link2 className="size-2.5 text-primary" />
                        Componentes vinculados:
                      </span>
                      <p className="text-foreground line-clamp-2">
                        {asset.usedByComponents.join(' • ')}
                      </p>
                    </div>
                  )}

                  {/* Acciones */}
                  <div className="pt-2 border-t border-border flex items-center justify-between gap-1">
                    <button
                      onClick={() => handleCopyUrl(asset.cdnUrl, asset.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium bg-muted/60 hover:bg-muted text-foreground transition cursor-pointer"
                      title="Copiar URL acelerada por CDN"
                    >
                      {copiedId === asset.id ? (
                        <>
                          <Check className="size-3 text-emerald-500" />
                          <span className="text-emerald-500">Copiada</span>
                        </>
                      ) : (
                        <>
                          <Copy className="size-3 text-muted-foreground" />
                          <span>Copiar CDN</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => setInspectAsset(asset)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
                      title="Inspeccionar cabeceras CDN y metadatos"
                    >
                      <Info className="size-4" />
                    </button>

                    <a
                      href={asset.cdnUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition"
                      title="Abrir en pestaña nueva"
                    >
                      <ExternalLink className="size-4" />
                    </a>

                    {isAuthorized && (
                      <button
                        onClick={() => handleInitiateDelete(asset)}
                        className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10 transition cursor-pointer"
                        title="Verificar dependencias y retirar"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Registro / Subida de Recursos Multimedia y Modelos */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Upload className="size-5 text-primary" />
                <h3 className="font-bold text-foreground text-sm">
                  Supervisión: Subir y Clasificar Recurso del Sistema [HU-033]
                </h3>
              </div>
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="p-6 space-y-4 max-h-[85vh] overflow-y-auto">
              {/* Archivo */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Seleccionar Archivo (Fotografía, Prenda, Modelo 3D o Componente IA)
                </label>
                <input
                  type="file"
                  required
                  accept=".jpg,.jpeg,.png,.webp,.avif,.glb,.gltf,.obj,.fbx,.stl,.pt,.pth,.onnx,.bin,.tga,.hdr"
                  onChange={handleFileSelect}
                  className="w-full text-xs text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Formatos admitidos: Fotos (JPG, PNG, WebP), Prendas/3D (.glb, .gltf, .obj hasta 100MB), Modelos IA (.pt, .onnx hasta 250MB).
                </p>
              </div>

              {/* Título */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Nombre descriptivo del recurso
                </label>
                <input
                  type="text"
                  required
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="Ej: Chaqueta Cuero Urbana Colección 2026"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary/40 text-foreground"
                />
              </div>

              {/* Categoría / Tipo de Recurso */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Tipo de Recurso
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setUploadMediaType('photo');
                      setUploadFunction('galeria_marketing');
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-medium border flex items-center justify-center gap-1.5 cursor-pointer transition ${
                      uploadMediaType === 'photo'
                        ? 'border-blue-500 bg-blue-500/10 text-blue-600 font-bold'
                        : 'border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <ImageIcon className="size-3.5" />
                    Fotografía
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUploadMediaType('garment');
                      setUploadFunction('catalogo_prendas');
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-medium border flex items-center justify-center gap-1.5 cursor-pointer transition ${
                      uploadMediaType === 'garment'
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 font-bold'
                        : 'border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <Shirt className="size-3.5" />
                    Prenda
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUploadMediaType('model_3d');
                      setUploadFunction('probador_virtual_3d');
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-medium border flex items-center justify-center gap-1.5 cursor-pointer transition ${
                      uploadMediaType === 'model_3d'
                        ? 'border-purple-500 bg-purple-500/10 text-purple-600 font-bold'
                        : 'border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <FileBox className="size-3.5" />
                    Modelo 3D
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUploadMediaType('ai_component');
                      setUploadFunction('motor_inferencia_ia');
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-medium border flex items-center justify-center gap-1.5 cursor-pointer transition ${
                      uploadMediaType === 'ai_component'
                        ? 'border-rose-500 bg-rose-500/10 text-rose-600 font-bold'
                        : 'border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <Brain className="size-3.5" />
                    Modelo IA
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUploadMediaType('texture');
                      setUploadFunction('probador_virtual_3d');
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-medium border flex items-center justify-center gap-1.5 cursor-pointer transition ${
                      uploadMediaType === 'texture'
                        ? 'border-amber-500 bg-amber-500/10 text-amber-600 font-bold'
                        : 'border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <Layers className="size-3.5" />
                    Textura PBR
                  </button>
                </div>
              </div>

              {uploadMediaType === 'texture' && (
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Tipo de Mapa PBR
                  </label>
                  <select
                    value={uploadTextureType}
                    onChange={(e) => setUploadTextureType(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-background border border-border text-foreground font-medium"
                  >
                    <option value="albedo">Albedo / Base Color</option>
                    <option value="normal">Normal Map</option>
                    <option value="roughness">Roughness (Rugosidad)</option>
                    <option value="metallic">Metallic (Metálico)</option>
                    <option value="displacement">Height / Desplazamiento</option>
                    <option value="hdr">HDR Ambiental</option>
                  </select>
                </div>
              )}

              {/* Función en la Plataforma */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Función dentro de la plataforma (Regla 1 HU-033)
                </label>
                <select
                  value={uploadFunction}
                  onChange={(e) => {
                    if (isSystemFunction(e.target.value)) {
                      setUploadFunction(e.target.value);
                    }
                  }}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-background border border-border text-foreground font-medium"
                >
                  <option value="catalogo_prendas">Catálogo y Visualizador de Prendas</option>
                  <option value="probador_virtual_3d">Probador Virtual 3D (WebGL / Three.js)</option>
                  <option value="motor_inferencia_ia">Motor de Inferencia de Modelos de IA (HU-032)</option>
                  <option value="galeria_marketing">Galería Editorial & Campañas de Marketing</option>
                  <option value="perfil_usuario">Avatares y Perfiles de Usuario</option>
                  <option value="general">Uso General</option>
                </select>
              </div>

              {/* Dependencias y Componentes que lo usan */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-foreground">
                  Componentes Activos que Utilizan este Recurso (Regla 3 HU-033)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={uploadComponentTag}
                    onChange={(e) => setUploadComponentTag(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddComponentTag();
                      }
                    }}
                    placeholder="Ej: Catálogo Prendas 2026, Probador Virtual..."
                    className="flex-1 px-3 py-1.5 text-xs rounded-xl bg-background border border-border text-foreground"
                  />
                  <button
                    type="button"
                    onClick={handleAddComponentTag}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground cursor-pointer"
                  >
                    Añadir
                  </button>
                </div>
                {uploadComponentsList.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {uploadComponentsList.map((tag, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-primary/10 text-primary border border-primary/20"
                      >
                        <Link2 className="size-3" />
                        {tag}
                        <button
                          type="button"
                          onClick={() => handleRemoveComponentTag(idx)}
                          className="hover:text-destructive"
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Modo de Carga */}
              <div className="bg-muted/40 p-3 rounded-xl space-y-1.5">
                <label className="block text-[11px] font-semibold text-foreground">
                  Estrategia de Almacenamiento S3:
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                    <input
                      type="radio"
                      name="uploadMode"
                      value="standard"
                      checked={uploadMode === 'standard'}
                      onChange={() => setUploadMode('standard')}
                    />
                    <span>Backend + Sharp (Fotos / Activos &lt; 25MB)</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                    <input
                      type="radio"
                      name="uploadMode"
                      value="direct_s3"
                      checked={uploadMode === 'direct_s3'}
                      onChange={() => setUploadMode('direct_s3')}
                    />
                    <span>Direct-to-S3 Presigned (Prendas, 3D e IA &gt; 25MB)</span>
                  </label>
                </div>
              </div>

              {/* Progreso */}
              {uploadProgress !== null && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Transfiriendo activo a S3...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-primary h-2 transition-all duration-200"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Botones */}
              <div className="pt-3 flex items-center justify-end gap-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  disabled={uploading}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:bg-muted"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={uploading || !selectedFile}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  {uploading ? 'Guardando...' : 'Confirmar y Supervisar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Verificación de Dependencias (Regla 3 HU-033) */}
      {depCheckModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                {depCheckModal.canDelete ? (
                  <ShieldAlert className="size-5 text-amber-500" />
                ) : (
                  <AlertTriangle className="size-5 text-destructive" />
                )}
                <h3 className="font-bold text-foreground text-sm">
                  Verificación de Dependencias [HU-033]
                </h3>
              </div>
              <button
                onClick={() => setDepCheckModal(null)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div>
                <p className="text-foreground font-semibold text-sm">{depCheckModal.asset.title}</p>
                <p className="text-muted-foreground font-mono text-[11px]">{depCheckModal.asset.s3Key}</p>
              </div>

              {!depCheckModal.canDelete ? (
                /* Advertencia de Dependencias Activas */
                <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive space-y-2">
                  <div className="flex items-center gap-2 font-bold">
                    <AlertTriangle className="size-4 shrink-0" />
                    <span>Recurso en Uso Activo - Eliminación Restringida</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    De acuerdo con las reglas de la plataforma, este recurso está siendo utilizado por los siguientes componentes activos:
                  </p>
                  <ul className="list-disc list-inside space-y-1 font-semibold pl-1 text-[11px]">
                    {depCheckModal.activeDependencies.map((dep, i) => (
                      <li key={i}>{dep}</li>
                    ))}
                  </ul>
                  <p className="text-[11px] pt-1 text-muted-foreground">
                    Para evitar caídas o enlaces rotos en el probador o catálogo, se recomienda **Retirar de Forma Segura** en lugar de eliminar el archivo físico de S3.
                  </p>
                </div>
              ) : (
                /* Recurso sin dependencias activas */
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 space-y-1">
                  <div className="flex items-center gap-2 font-bold">
                    <Check className="size-4" />
                    <span>Sin dependencias activas detectadas</span>
                  </div>
                  <p className="text-[11px]">
                    Este recurso no está vinculado a ningún componente activo del sistema y puede retirarse con seguridad.
                  </p>
                </div>
              )}

              {/* Botones de Acción */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setDepCheckModal(null)}
                  disabled={isProcessingAction}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:bg-muted"
                >
                  Cancelar
                </button>

                {/* Opción 1: Retirar de forma segura (archivar) */}
                <button
                  type="button"
                  onClick={handleConfirmRetire}
                  disabled={isProcessingAction}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500/20 text-amber-700 dark:text-amber-300 hover:bg-amber-500/30 transition cursor-pointer"
                >
                  <Archive className="size-3.5" />
                  Retirar de Forma Segura
                </button>

                {/* Opción 2: Eliminación definitiva */}
                <button
                  type="button"
                  onClick={() => handleConfirmDelete(!depCheckModal.canDelete)}
                  disabled={isProcessingAction}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-destructive text-destructive-foreground hover:bg-destructive/90 transition cursor-pointer"
                >
                  <Trash2 className="size-3.5" />
                  {!depCheckModal.canDelete ? 'Forzar Eliminación (Admin)' : 'Eliminar de S3'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Inspección Técnica de CDN */}
      {inspectAsset && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="size-5 text-emerald-500" />
                <h3 className="font-bold text-foreground text-sm">Inspección de Entrega CDN & S3</h3>
              </div>
              <button
                onClick={() => setInspectAsset(null)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="space-y-1">
                <p className="font-semibold text-foreground">{inspectAsset.title}</p>
                <p className="text-muted-foreground font-mono text-[11px]">{inspectAsset.s3Key}</p>
              </div>

              {/* Comparación de URLs */}
              <div className="space-y-3 bg-muted/40 p-4 rounded-xl border border-border">
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="font-semibold text-emerald-500 flex items-center gap-1">
                      <Zap className="size-3" /> URL Acelerada CDN (CloudFront / Global Edge):
                    </span>
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-600 px-1.5 py-0.5 rounded font-bold">
                      RECOMENDADA
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={inspectAsset.cdnUrl}
                      className="w-full px-2.5 py-1.5 bg-background rounded-lg border border-border font-mono text-[11px] text-foreground"
                    />
                    <button
                      onClick={() => handleCopyUrl(inspectAsset.cdnUrl, 'modal-cdn')}
                      className="p-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 shrink-0"
                    >
                      {copiedId === 'modal-cdn' ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="font-semibold text-muted-foreground">URL Origen S3 (Bucket Directo):</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={inspectAsset.s3Url}
                      className="w-full px-2.5 py-1.5 bg-background rounded-lg border border-border font-mono text-[11px] text-muted-foreground"
                    />
                  </div>
                </div>
              </div>

              {/* Cabeceras HTTP de Entrega */}
              <div className="space-y-2">
                <span className="font-semibold text-foreground">Cabeceras HTTP de Aceleración Edge:</span>
                <div className="bg-black/90 text-emerald-400 font-mono p-3 rounded-xl text-[11px] space-y-1">
                  <p><span className="text-muted-foreground">Content-Type:</span> {inspectAsset.mimeType}</p>
                  <p><span className="text-muted-foreground">Cache-Control:</span> public, max-age=31536000, immutable</p>
                  <p><span className="text-muted-foreground">Access-Control-Allow-Origin:</span> * (Three.js WebGL OK)</p>
                  <p><span className="text-muted-foreground">X-Cache:</span> Hit from cloudfront (Edge Cached)</p>
                  <p><span className="text-muted-foreground">Content-Length:</span> {inspectAsset.sizeBytes} bytes</p>
                </div>
              </div>

              {/* Dependencias vinculadas */}
              {inspectAsset.usedByComponents && inspectAsset.usedByComponents.length > 0 && (
                <div className="space-y-1">
                  <span className="font-semibold text-foreground">Componentes que dependen de este recurso:</span>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {inspectAsset.usedByComponents.map((c, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-purple-500/10 text-purple-600 border border-purple-500/20"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Metadatos adicionales */}
              {inspectAsset.metadata && (
                <div className="space-y-1">
                  <span className="font-semibold text-foreground">Metadatos del Objeto:</span>
                  <pre className="bg-muted p-3 rounded-xl font-mono text-[11px] overflow-x-auto text-muted-foreground">
                    {JSON.stringify(inspectAsset.metadata, null, 2)}
                  </pre>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setInspectAsset(null)}
                  className="px-4 py-2 rounded-xl text-xs font-medium bg-muted hover:bg-muted/80 text-foreground cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
