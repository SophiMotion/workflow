import type { Diagnostic } from '@sophicad/schema';

export interface ToolEnvelope<T> {
  summary: string;
  data: T | null;
  errors: Diagnostic[];
  warnings: Diagnostic[];
  nextActions: string[];
}

export function success<T>(summary: string, data: T, warnings: Diagnostic[] = [], nextActions: string[] = []): ToolEnvelope<T> {
  return { summary, data, errors: [], warnings, nextActions };
}

export function failure<T = never>(error: unknown, nextActions: string[] = []): ToolEnvelope<T> {
  const value = error as { code?: string; message?: string; diagnostics?: Diagnostic[]; entityId?: string };
  const diagnostics = value.diagnostics?.length ? value.diagnostics : [{
    severity: 'error' as const,
    code: value.code ?? 'unexpected_error',
    message: value.message ?? String(error),
    ...(value.entityId ? { entityId: value.entityId } : {}),
  }];
  return {
    summary: diagnostics[0]?.message ?? '操作失败。',
    data: null,
    errors: diagnostics,
    warnings: [],
    nextActions,
  };
}
