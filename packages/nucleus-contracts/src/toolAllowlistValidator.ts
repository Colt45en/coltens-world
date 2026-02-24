import type { ValidationError } from "./schemas.js";
import type { ToolDefinition, ToolAllowlist, ToolAllowlistedArgType } from "./types.js";

/**
 * Runtime validation and expansion for hardened tool allowlists (v1.1)
 * Provides safety checks and deterministic expansion for tool invocations
 */

export type ToolInvocationPlan = {
  tool_id: string;
  command: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
  timeout_ms: number;
  output_capture: "none" | "stdout" | "stderr" | "both";
  max_output_kb: number;
  requires_approval: boolean;
  risk_level: "low" | "medium" | "high" | "critical";
};

export type ToolValidationError = {
  field: string;
  message: string;
  value?: any;
};

export type ToolValidationResult = {
  valid: boolean;
  errors: ToolValidationError[];
};

/**
 * Validates a tool allowlist against v1.1 schema requirements
 */
export function validateToolAllowlistV11(allowlist: ToolAllowlist): ToolValidationResult {
  const errors: ToolValidationError[] = [];

  // Version check
  if (allowlist.version !== "nucleus.tool_allowlist.v1.1") {
    errors.push({
      field: "version",
      message: `Expected version "nucleus.tool_allowlist.v1.1", got "${allowlist.version}"`,
      value: allowlist.version
    });
  }

  // Tool uniqueness check
  const toolIds = new Set<string>();
  for (const tool of allowlist.tools) {
    if (toolIds.has(tool.tool_id)) {
      errors.push({
        field: `tools[${tool.tool_id}].tool_id`,
        message: `Duplicate tool_id: ${tool.tool_id}`,
        value: tool.tool_id
      });
    }
    toolIds.add(tool.tool_id);
  }

  // Validate each tool
  for (const tool of allowlist.tools) {
    const toolErrors = validateToolDefinition(tool);
    errors.push(...toolErrors);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validates a single tool definition
 */
export function validateToolDefinition(tool: ToolDefinition): ToolValidationError[] {
  const errors: ToolValidationError[] = [];

  // tool_id format validation (already enforced by schema, but double-check)
  const toolIdPattern = /^[a-z][a-z0-9_.-]+$/;
  if (!toolIdPattern.test(tool.tool_id)) {
    errors.push({
      field: "tool_id",
      message: "tool_id must match pattern ^[a-z][a-z0-9_.-]+$",
      value: tool.tool_id
    });
  }

  // args_template variable usage validation
  const templateErrors = validateArgsTemplate(tool.args_template, tool.allowed_vars);
  errors.push(...templateErrors.map(err => ({
    field: `args_template${err.field ? `.${err.field}` : ""}`,
    message: err.message,
    value: err.value
  })));

  // cwd sandboxing validation
  if (tool.cwd) {
    const cwdErrors = validateCwd(tool.cwd);
    errors.push(...cwdErrors.map(err => ({
      field: "cwd",
      message: err.message,
      value: err.value
    })));
  }

  // timeout_ms bounds (already enforced by schema, but double-check)
  if (tool.timeout_ms !== undefined && (tool.timeout_ms < 1000 || tool.timeout_ms > 120000)) {
    errors.push({
      field: "timeout_ms",
      message: "timeout_ms must be between 1000 and 120000",
      value: tool.timeout_ms
    });
  }

  // max_output_kb validation
  if (tool.max_output_kb < 1 || tool.max_output_kb > 10240) {
    errors.push({
      field: "max_output_kb",
      message: "max_output_kb must be between 1 and 10240",
      value: tool.max_output_kb
    });
  }

  return errors;
}

/**
 * Validates args_template variable usage against allowed_vars
 */
export function validateArgsTemplate(
  argsTemplate: string[],
  allowedVars: Record<string, ToolAllowlistedArgType>
): ToolValidationError[] {
  const errors: ToolValidationError[] = [];
  const varPattern = /\$\{([^}]+)\}/g;

  for (let i = 0; i < argsTemplate.length; i++) {
    const arg = argsTemplate[i]!;
    const varPattern = /\$\{([^}]+)\}/g;
    let match: RegExpExecArray | null;

    while ((match = varPattern.exec(arg)) !== null) {
      const varName = match[1];
      if (!varName) continue; // Skip if no capture group

      // Check if variable is defined in allowed_vars
      if (!(varName in allowedVars)) {
        errors.push({
          field: `[${i}]`,
          message: `Variable "${varName}" not defined in allowed_vars`,
          value: varName
        });
        continue;
      }

      // Check variable name format
      const varNamePattern = /^[a-z][a-z0-9_]*$/;
      if (!varNamePattern.test(varName)) {
        errors.push({
          field: `[${i}]`,
          message: `Variable name "${varName}" must match pattern ^[a-z][a-z0-9_]*$`,
          value: varName
        });
      }
    }
  }

  return errors;
}

/**
 * Validates cwd for sandboxing (no absolute paths outside allowed directories)
 */
export function validateCwd(cwd: string): ToolValidationError[] {
  const errors: ToolValidationError[] = [];

  // Must be relative path or within allowed absolute paths
  if (cwd.startsWith('/') || cwd.startsWith('\\') || cwd.match(/^[A-Za-z]:/)) {
    // Only allow specific safe absolute paths
    const allowedPaths = [
      '/tmp',
      '/var/tmp',
      '/app',
      '/workspace',
      'C:\\temp',
      'C:\\workspace'
    ];

    const isAllowed = allowedPaths.some(allowed => cwd.startsWith(allowed));
    if (!isAllowed) {
      errors.push({
        field: "",
        message: `cwd must be relative or within allowed paths: ${allowedPaths.join(', ')}`,
        value: cwd
      });
    }
  }

  // No directory traversal
  if (cwd.includes('..')) {
    errors.push({
      field: "",
      message: "cwd cannot contain '..' for directory traversal protection",
      value: cwd
    });
  }

  return errors;
}

/**
 * Expands a tool definition into a deterministic invocation plan
 */
export function expandToolInvocation(
  tool: ToolDefinition,
  args: Record<string, string | number | boolean | string[]>
): ToolInvocationPlan {
  // Expand args_template with provided args
  const expandedArgs = tool.args_template.map(arg => {
    return arg.replace(/\$\{([^}]+)\}/g, (match, varName) => {
      if (!varName) return match; // Keep original if no capture group
      const value = args[varName];
      if (value === undefined) {
        throw new Error(`Missing required argument: ${varName}`);
      }
      return String(value);
    });
  });

  // Determine cwd (default to current directory if not specified)
  const cwd = tool.cwd || '.';

  // Build environment variables (only allowed ones)
  const env: Record<string, string> = {};
  if (tool.env_allowlist) {
    for (const envVar of tool.env_allowlist) {
      const value = process.env[envVar];
      if (value !== undefined) {
        env[envVar] = value;
      }
    }
  }

  return {
    tool_id: tool.tool_id,
    command: tool.command,
    args: expandedArgs,
    cwd,
    env,
    timeout_ms: tool.timeout_ms || 30000, // Default 30s if not specified
    output_capture: tool.output_capture,
    max_output_kb: tool.max_output_kb,
    requires_approval: tool.requires_approval,
    risk_level: tool.risk_level
  };
}

/**
 * Validates provided args against tool definition
 */
export function validateToolArgs(
  tool: ToolDefinition,
  args: Record<string, string | number | boolean | string[]>
): ToolValidationError[] {
  const errors: ToolValidationError[] = [];

  // Check all required variables are provided
  for (const [varName, varType] of Object.entries(tool.allowed_vars)) {
    if (!(varName in args)) {
      errors.push({
        field: `args.${varName}`,
        message: `Missing required argument: ${varName}`,
        value: undefined
      });
      continue;
    }

    const value = args[varName];
    const actualType = Array.isArray(value) ? 'string[]' :
                      typeof value === 'string' ? 'string' :
                      typeof value === 'number' ? 'number' :
                      typeof value === 'boolean' ? 'boolean' : 'unknown';

    if (actualType !== varType) {
      errors.push({
        field: `args.${varName}`,
        message: `Argument ${varName} expected type ${varType}, got ${actualType}`,
        value
      });
    }
  }

  // Check no extra arguments
  for (const argName of Object.keys(args)) {
    if (!(argName in tool.allowed_vars)) {
      errors.push({
        field: `args.${argName}`,
        message: `Unexpected argument: ${argName}`,
        value: args[argName]
      });
    }
  }

  return errors;
}
