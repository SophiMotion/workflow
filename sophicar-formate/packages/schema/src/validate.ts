import { Ajv2020, type ErrorObject, type ValidateFunction } from 'ajv/dist/2020.js';
import addFormatsImport from 'ajv-formats';

import { changesSchema, manifestSchema, modelSchema } from './schemas.js';
import type {
  ChangesDocument,
  Diagnostic,
  ModelDocument,
  PackageManifest,
  ValidationResult,
} from './types.js';

const ajv = new Ajv2020({ allErrors: true, strict: true });
const addFormats = addFormatsImport as unknown as (instance: Ajv2020) => Ajv2020;
addFormats(ajv);

const manifestValidator = ajv.compile(manifestSchema);
const modelValidator = ajv.compile(modelSchema);
const changesValidator = ajv.compile(changesSchema);

function unsupportedMajor(value: unknown): Diagnostic | undefined {
  if (typeof value !== 'object' || value === null || !('schemaVersion' in value)) {
    return undefined;
  }

  const version = (value as { schemaVersion?: unknown }).schemaVersion;
  if (typeof version !== 'string') {
    return undefined;
  }

  const major = Number.parseInt(version.split('.')[0] ?? '', 10);
  if (Number.isFinite(major) && major !== 1) {
    return {
      severity: 'error',
      code: 'unsupported_schema_major',
      message: `不支持 Schema 主版本 ${major}；当前仅支持 1.x。`,
      path: '/schemaVersion',
    };
  }

  return undefined;
}

function toDiagnostics(errors: ErrorObject[] | null | undefined): Diagnostic[] {
  return (errors ?? []).map((error) => ({
    severity: 'error',
    code: 'schema_validation_error',
    message: `${error.instancePath || '/'} ${error.message ?? '校验失败'}`,
    path: error.instancePath || '/',
  }));
}

function validate<T>(validator: ValidateFunction, value: unknown): ValidationResult<T> {
  const versionError = unsupportedMajor(value);
  if (versionError) {
    return { ok: false, errors: [versionError] };
  }

  if (!validator(value)) {
    return { ok: false, errors: toDiagnostics(validator.errors) };
  }

  return { ok: true, value: value as T, errors: [] };
}

export function validateManifest(value: unknown): ValidationResult<PackageManifest> {
  return validate(manifestValidator, value);
}

export function validateModel(value: unknown): ValidationResult<ModelDocument> {
  return validate(modelValidator, value);
}

export function validateChanges(value: unknown): ValidationResult<ChangesDocument> {
  return validate(changesValidator, value);
}
