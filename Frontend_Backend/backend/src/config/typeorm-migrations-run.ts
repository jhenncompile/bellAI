export function parseMigrationsRun(value: string | undefined): boolean {
  if (value === undefined || value.trim() === '') {
    return true;
  }

  const normalizedValue = value.trim().toLowerCase();
  if (normalizedValue === 'true') {
    return true;
  }
  if (normalizedValue === 'false') {
    return false;
  }

  throw new Error('TYPEORM_MIGRATIONS_RUN debe ser "true" o "false"');
}
