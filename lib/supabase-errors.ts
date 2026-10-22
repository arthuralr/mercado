interface SupabaseErrorLike {
  code?: string;
}

export function isMissingRelationError(error: SupabaseErrorLike | null) {
  return error?.code === 'PGRST205' || error?.code === '42P01';
}
