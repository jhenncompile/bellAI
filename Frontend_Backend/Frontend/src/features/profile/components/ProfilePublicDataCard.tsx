import { AvatarUploader } from './AvatarUploader';
import type { ProfileFormValues } from '../types/profile.types';

interface ProfilePublicDataCardProps {
  values: ProfileFormValues;
  email: string;
  uploading: boolean;
  onChange: (patch: Partial<ProfileFormValues>) => void;
  onSelectAvatar: (file: File) => void;
}

/** Foto de perfil y datos visibles públicamente. */
export function ProfilePublicDataCard({
  values,
  email,
  uploading,
  onChange,
  onSelectAvatar,
}: ProfilePublicDataCardProps) {
  return (
    <div className="p-6 rounded-2xl bg-card border border-border space-y-6 shadow-xs">
      <h2 className="text-base font-semibold text-foreground border-b border-border pb-3">
        Foto de Perfil y Datos Públicos
      </h2>

      <AvatarUploader
        avatarUrl={values.avatarUrl}
        name={values.name}
        uploading={uploading}
        onSelectFile={onSelectAvatar}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">
            Nombre Completo
          </label>
          <input
            type="text"
            value={values.name}
            onChange={(e) => onChange({ name: e.target.value })}
            required
            className="w-full px-3.5 py-2.5 bg-input/40 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">
            Correo Electrónico (Titular de cuenta)
          </label>
          <input
            type="email"
            value={email}
            disabled
            className="w-full px-3.5 py-2.5 bg-muted/50 border border-border rounded-xl text-sm text-muted-foreground cursor-not-allowed"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">
            Biografía / Descripción
          </label>
          <textarea
            value={values.bio}
            onChange={(e) => onChange({ bio: e.target.value })}
            rows={3}
            placeholder="Escribe una breve descripción sobre ti o tus responsabilidades..."
            className="w-full px-3.5 py-2.5 bg-input/40 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground resize-none"
          />
        </div>
      </div>
    </div>
  );
}
