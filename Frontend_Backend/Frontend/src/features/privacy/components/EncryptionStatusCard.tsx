import { EyeOff } from 'lucide-react';

/** Resumen informativo del cifrado en reposo y el enmascaramiento de PII. */
export function EncryptionStatusCard() {
  return (
    <div className="p-6 rounded-2xl bg-card border border-border space-y-4 shadow-xs">
      <h2 className="text-base font-semibold text-foreground flex items-center gap-2 border-b border-border pb-3">
        <EyeOff className="size-5 text-primary" />
        Cifrado Local y Ofuscación de Datos Personales (PII)
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
        <div className="p-4 rounded-xl bg-input/10 border border-border space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-foreground">Cifrado en Reposo</span>
            <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">
              ACTIVO
            </span>
          </div>
          <p className="text-muted-foreground">
            Algoritmo simétrico <strong>AES-256-GCM</strong> con vectores de inicialización
            dinámicos (IV 128-bit) para teléfonos, documentos de identidad y direcciones físicas.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-input/10 border border-border space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-foreground">Enmascaramiento (Masking)</span>
            <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">
              ACTIVO
            </span>
          </div>
          <p className="text-muted-foreground">
            Ofuscación automática en registros de auditoría y respuestas de visualización (ejemplo:{' '}
            <code>va****a@bellia.com</code>, <code>+591 7***89</code>).
          </p>
        </div>
      </div>
    </div>
  );
}
