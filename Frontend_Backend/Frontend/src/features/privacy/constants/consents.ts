/** Consentimientos que el usuario puede otorgar o revocar en el panel de privacidad. */
export const CONSENT_DEFINITIONS = [
  {
    type: 'terms_of_service',
    title: 'Términos y Condiciones del Servicio',
    desc: 'Uso de la plataforma, normas de seguridad y prestación de servicios.',
  },
  {
    type: 'privacy_policy',
    title: 'Política de Tratamiento y Privacidad de Datos',
    desc: 'Almacenamiento y procesamiento bajo normativas internacionales de protección.',
  },
  {
    type: 'marketing_emails',
    title: 'Comunicaciones de Actualizaciones y Novedades',
    desc: 'Notificaciones periódicas sobre mejoras del sistema.',
  },
] as const;
