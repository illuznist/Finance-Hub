export type ProtectedMetadataOutcome =
  | "blocked"
  | "empty"
  | "unexpected-access"
  | "missing-schema"
  | "authentication-failed"
  | "network-failed"
  | "unavailable";

export type ProtectedMetadataResponse = {
  data: unknown[] | null;
  error: { code?: string } | null;
  status: number;
};

const MISSING_SCHEMA_CODES = new Set([
  "42P01", // undefined_table
  "42703", // undefined_column
  "3F000", // invalid_schema_name
  "PGRST106", // schema is not exposed by PostgREST
  "PGRST204", // column is absent from the schema cache
  "PGRST205", // table is absent from the schema cache
]);

const AUTHENTICATION_CODES = new Set(["28000", "PGRST301", "PGRST302", "PGRST303"]);

export function classifyProtectedMetadataResponse(
  response: ProtectedMetadataResponse,
  signedInUserConfirmed: boolean,
): ProtectedMetadataOutcome {
  const { data, error, status } = response;
  const code = error?.code;

  if (code && AUTHENTICATION_CODES.has(code)) return "authentication-failed";
  if (status === 401) return "authentication-failed";
  if (status === 0) return "network-failed";
  if (code && MISSING_SCHEMA_CODES.has(code)) return "missing-schema";

  // 42501 is an explicit PostgreSQL permission denial. Require the same client
  // session to have just read its own USER role before treating it as an RLS pass.
  if (code === "42501") {
    return signedInUserConfirmed ? "blocked" : "authentication-failed";
  }

  if (error || status < 200 || status >= 300 || !Array.isArray(data)) {
    return "unavailable";
  }
  if (data.length === 0) return "empty";
  return "unexpected-access";
}
