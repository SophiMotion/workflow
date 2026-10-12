import type { UserParameterRecord } from '@sophicad/schema';

const UNIT_TO_SI: Record<string, number> = {
  mm: 0.001,
  cm: 0.01,
  m: 1,
  deg: Math.PI / 180,
  rad: 1,
  g: 0.001,
  kg: 1,
};

export function normalizeParameterExpression(expression: string, unit: string): string {
  const trimmed = expression.trim();
  return /^[-+]?\d+(?:\.\d+)?$/.test(trimmed) && unit ? `${trimmed} ${unit}` : trimmed;
}

export function simpleExpressionValueSi(expression: string, fallback: number | null): number | null {
  const match = /^\s*([-+]?\d+(?:\.\d+)?)\s*([a-zA-Z]+)\s*$/.exec(expression);
  if (!match) return fallback;
  const factor = UNIT_TO_SI[match[2]!.toLowerCase()];
  return factor === undefined ? fallback : Number(match[1]) * factor;
}

export function parameterPreviewValueSi(parameter: UserParameterRecord, pendingExpression?: string): number | null {
  return simpleExpressionValueSi(pendingExpression ?? parameter.expression, parameter.valueSi);
}
