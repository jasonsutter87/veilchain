/**
 * VeilChain Validation Middleware
 *
 * Provides comprehensive input validation for API requests including:
 * - Entry data size limits
 * - Ledger name validation
 * - Description length limits
 * - JSON schema validation for entry data
 */

import AjvModule from 'ajv';
import type { ValidateFunction } from 'ajv';
import ajvFormats from 'ajv-formats';
import type { FastifyRequest, FastifyReply } from 'fastify';

// Handle both ESM and CJS imports
const Ajv = (AjvModule as any).default || AjvModule;
const addFormats = (ajvFormats as any).default || ajvFormats;

/**
 * Default validation configuration
 */
export interface ValidationConfig {
  /** Maximum size for entry data in bytes (default: 1MB) */
  maxEntrySize: number;
  /** Maximum length for ledger names (default: 255 chars) */
  maxNameLength: number;
  /** Maximum length for descriptions (default: 1000 chars) */
  maxDescriptionLength: number;
  /** Maximum size for batch payloads in bytes (default: 10MB) */
  maxBatchSize: number;
}

/**
 * Default validation limits
 */
export const DEFAULT_VALIDATION_CONFIG: ValidationConfig = {
  maxEntrySize: 1024 * 1024, // 1MB
  maxNameLength: 255,
  maxDescriptionLength: 1000,
  maxBatchSize: 10 * 1024 * 1024 // 10MB
};

/**
 * Validation error codes
 */
export enum ValidationErrorCode {
  ENTRY_TOO_LARGE = 'ENTRY_TOO_LARGE',
  BATCH_TOO_LARGE = 'BATCH_TOO_LARGE',
  INVALID_NAME = 'INVALID_NAME',
  INVALID_DESCRIPTION = 'INVALID_DESCRIPTION',
  SCHEMA_VALIDATION_FAILED = 'SCHEMA_VALIDATION_FAILED',
  INVALID_FORMAT = 'INVALID_FORMAT'
}

/**
 * Validation error details
 */
export interface ValidationError {
  code: ValidationErrorCode;
  message: string;
  details?: unknown;
}

/**
 * Ledger name validation pattern
 * Allows: alphanumeric characters, dashes, underscores, spaces
 */
const LEDGER_NAME_PATTERN = /^[a-zA-Z0-9\s\-_]+$/;

/**
 * Validator class for managing JSON schema validation
 */
export class SchemaValidator {
  private ajv: any;
  private compiledSchemas: Map<string, ValidateFunction>;

  constructor() {
    this.ajv = new Ajv({
      allErrors: true
    });

    // Add format validators (date-time, email, uri, etc.)
    try {
      addFormats(this.ajv);
    } catch {
      // ajv-formats may fail in some ESM environments - formats will be unavailable
      console.warn('ajv-formats initialization failed - format validation disabled');
    }

    this.compiledSchemas = new Map();
  }

  /**
   * Compile and cache a JSON schema
   */
  compileSchema(schemaId: string, schema: Record<string, unknown>): ValidateFunction {
    const existing = this.compiledSchemas.get(schemaId);
    if (existing) {
      return existing;
    }

    const validate = this.ajv.compile(schema);
    this.compiledSchemas.set(schemaId, validate);
    return validate;
  }

  /**
   * Validate data against a schema
   */
  validate(schemaId: string, schema: Record<string, unknown>, data: unknown): ValidationError | null {
    const validate = this.compileSchema(schemaId, schema);

    const valid = validate(data);
    if (!valid) {
      return {
        code: ValidationErrorCode.SCHEMA_VALIDATION_FAILED,
        message: 'Entry data does not match ledger schema',
        details: validate.errors
      };
    }

    return null;
  }

  /**
   * Remove a compiled schema from cache
   */
  removeSchema(schemaId: string): void {
    this.compiledSchemas.delete(schemaId);
    this.ajv.removeSchema(schemaId);
  }

  /**
   * Clear all compiled schemas
   */
  clear(): void {
    this.compiledSchemas.clear();
  }
}

/**
 * Calculate size of JSON data in bytes
 */
export function getDataSize(data: unknown): number {
  return Buffer.byteLength(JSON.stringify(data), 'utf8');
}

/**
 * Validate ledger name
 */
export function validateLedgerName(
  name: string,
  config: ValidationConfig = DEFAULT_VALIDATION_CONFIG
): ValidationError | null {
  // Check if name is provided
  if (!name || name.trim().length === 0) {
    return {
      code: ValidationErrorCode.INVALID_NAME,
      message: 'Ledger name is required'
    };
  }

  const trimmedName = name.trim();

  // Check length
  if (trimmedName.length > config.maxNameLength) {
    return {
      code: ValidationErrorCode.INVALID_NAME,
      message: `Ledger name must not exceed ${config.maxNameLength} characters (got ${trimmedName.length})`
    };
  }

  // Check pattern
  if (!LEDGER_NAME_PATTERN.test(trimmedName)) {
    return {
      code: ValidationErrorCode.INVALID_FORMAT,
      message: 'Ledger name can only contain alphanumeric characters, spaces, dashes, and underscores'
    };
  }

  return null;
}

/**
 * Validate description
 */
export function validateDescription(
  description: string | undefined,
  config: ValidationConfig = DEFAULT_VALIDATION_CONFIG
): ValidationError | null {
  if (!description) {
    return null; // Description is optional
  }

  const trimmedDesc = description.trim();

  // Check length
  if (trimmedDesc.length > config.maxDescriptionLength) {
    return {
      code: ValidationErrorCode.INVALID_DESCRIPTION,
      message: `Description must not exceed ${config.maxDescriptionLength} characters (got ${trimmedDesc.length})`
    };
  }

  return null;
}

/**
 * Validate entry data size
 */
export function validateEntrySize(
  data: unknown,
  config: ValidationConfig = DEFAULT_VALIDATION_CONFIG
): ValidationError | null {
  const size = getDataSize(data);

  if (size > config.maxEntrySize) {
    return {
      code: ValidationErrorCode.ENTRY_TOO_LARGE,
      message: `Entry data exceeds maximum size of ${config.maxEntrySize} bytes (got ${size} bytes)`,
      details: { size, limit: config.maxEntrySize }
    };
  }

  return null;
}

/**
 * Validate batch payload size
 */
export function validateBatchSize(
  entries: Array<{ data: unknown }>,
  config: ValidationConfig = DEFAULT_VALIDATION_CONFIG
): ValidationError | null {
  // Calculate total size of all entries
  let totalSize = 0;
  for (const entry of entries) {
    totalSize += getDataSize(entry.data);
  }

  if (totalSize > config.maxBatchSize) {
    return {
      code: ValidationErrorCode.BATCH_TOO_LARGE,
      message: `Batch payload exceeds maximum size of ${config.maxBatchSize} bytes (got ${totalSize} bytes)`,
      details: { totalSize, limit: config.maxBatchSize, entryCount: entries.length }
    };
  }

  return null;
}

/**
 * Fastify hook for validating entry size
 */
export function createEntrySizeValidator(config: ValidationConfig = DEFAULT_VALIDATION_CONFIG) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { data?: unknown };

    if (!body || !body.data) {
      return; // Let the schema validation handle missing data
    }

    const error = validateEntrySize(body.data, config);
    if (error) {
      return reply.code(413).send({
        error: {
          code: error.code,
          message: error.message,
          details: error.details
        }
      });
    }
  };
}

/**
 * Fastify hook for validating batch size
 */
export function createBatchSizeValidator(config: ValidationConfig = DEFAULT_VALIDATION_CONFIG) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { entries?: Array<{ data: unknown }> };

    if (!body || !body.entries || !Array.isArray(body.entries)) {
      return; // Let the schema validation handle missing entries
    }

    const error = validateBatchSize(body.entries, config);
    if (error) {
      return reply.code(413).send({
        error: {
          code: error.code,
          message: error.message,
          details: error.details
        }
      });
    }
  };
}

/**
 * Fastify hook for validating ledger creation
 */
export function createLedgerValidator(config: ValidationConfig = DEFAULT_VALIDATION_CONFIG) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      name?: string;
      description?: string;
      schema?: Record<string, unknown>;
    };

    if (!body) {
      return;
    }

    // Validate name
    if (body.name) {
      const nameError = validateLedgerName(body.name, config);
      if (nameError) {
        return reply.code(400).send({
          error: {
            code: nameError.code,
            message: nameError.message,
            details: nameError.details
          }
        });
      }
    }

    // Validate description
    if (body.description) {
      const descError = validateDescription(body.description, config);
      if (descError) {
        return reply.code(400).send({
          error: {
            code: descError.code,
            message: descError.message,
            details: descError.details
          }
        });
      }
    }

    // Validate schema is a valid JSON object
    if (body.schema) {
      if (typeof body.schema !== 'object' || Array.isArray(body.schema)) {
        return reply.code(400).send({
          error: {
            code: ValidationErrorCode.INVALID_FORMAT,
            message: 'Schema must be a valid JSON object'
          }
        });
      }
    }
  };
}

/**
 * Global schema validator instance (singleton)
 */
export const schemaValidator = new SchemaValidator();
