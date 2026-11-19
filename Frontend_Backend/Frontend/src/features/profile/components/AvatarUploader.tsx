import { Camera } from 'lucide-react';
import { getAvatarUrl } from '@/shared/lib/avatar';

interface AvatarUploaderProps {
  avatarUrl: string;
  name: string;
  uploading: boolean;
  onSelectFile: (file: File) => void;
}

/** Avatar del usuario con subida de imagen (se optimiza a WebP en el backend). */
export function AvatarUploader({ avatarUrl, name, uploading, onSelectFile }: AvatarUploaderProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onSelectFile(file);
  };

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div className="relative group">
        <img
          src={getAvatarUrl(name, avatarUrl)}
          alt={name}
          className="size-24 sm:size-28 rounded-full border-2 border-primary/30 object-cover shadow-sm"
        />
        <label
          htmlFor="avatar-upload"
          className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white cursor-pointer transition-opacity duration-200"
        >
          <Camera className="size-6" />
          <span className="text-[10px] font-medium mt-1">Cambiar</span>
        </label>
        <input
          id="avatar-upload"
          type="file"
          accept="image/*"
          onChange={handleChange}
          className="hidden"
          disabled={uploading}
        />
      </div>

      <div className="space-y-1 text-center sm:text-left flex-1">
        <p className="text-xs font-medium text-foreground">Pre-procesamiento con Sharp</p>
        <p className="text-xs text-muted-foreground">
          Las imágenes se limpian de metadatos EXIF, se redimensionan y se convierten automáticamente
          a formato <span className="font-semibold text-primary">WebP</span> de alta eficiencia.
        </p>
        {uploading && (
          <p className="text-xs text-primary font-medium animate-pulse mt-2">
            Procesando y optimizando imagen...
          </p>
        )}
      </div>
    </div>
  );
}
