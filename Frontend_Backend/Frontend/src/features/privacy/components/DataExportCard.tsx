import { Download } from 'lucide-react';

interface DataExportCardProps {
  exporting: boolean;
  onDownload: () => void;
}

/** Portabilidad de datos: descarga del paquete JSON (Art. 20 RGPD). */
export function DataExportCard({ exporting, onDownload }: DataExportCardProps) {
  return (
    <div className="p-6 rounded-2xl bg-card border border-border space-y-4 shadow-xs">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Download className="size-5 text-primary" />
          Descargar Copia de tus Datos Personales (Art. 20 RGPD)
        </h2>
        <p className="text-xs text-muted-foreground">
          Obtén un paquete estructurado en formato <code className="text-primary">.JSON</code> con
          toda la información vinculada a tu cuenta, perfil, configuraciones, preferencias y
          registros de consentimiento en el Sistema Bellia.
        </p>
      </div>

      <div className="pt-2">
        <button
          onClick={onDownload}
          disabled={exporting}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-xs shadow-md hover:bg-primary/90 transition-all disabled:opacity-50"
        >
          <Download className="size-4" />
          {exporting ? 'Generando paquete JSON...' : 'Exportar Mis Datos (JSON)'}
        </button>
      </div>
    </div>
  );
}
