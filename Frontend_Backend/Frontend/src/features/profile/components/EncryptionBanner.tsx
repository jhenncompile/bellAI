import { ShieldCheck } from 'lucide-react';

/** Aviso informativo sobre el cifrado en reposo de los datos sensibles. */
export function EncryptionBanner() {
  return (
    <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 flex items-start gap-3">
      <ShieldCheck className="size-5 text-primary shrink-0 mt-0.5" />
      <div className="text-xs text-foreground">
        <p className="font-semibold text-primary">
          Cifrado de Alta Seguridad Activado (AES-256-GCM)
        </p>
        <p className="text-muted-foreground mt-0.5">
          Tus datos confidenciales (número de teléfono y dirección) son cifrados en reposo antes de
          guardarse en la base de datos PostgreSQL 17.
        </p>
      </div>
    </div>
  );
}
