import { useQuery_experimental } from "convex/react";
import type { FunctionReference } from "convex/server";

/**
 * Drop-in replacement for `useQuery` that also surfaces query errors, so a
 * failing query can render an error screen (with a way back to the home page)
 * instead of an endless skeleton.
 */
export function useSafeQuery<Query extends FunctionReference<"query">>(
  query: Query,
  // `skip` disables the subscription; otherwise the query's own args.
  args: Record<string, unknown> | "skip" = {},
): {
  data: Query["_returnType"] | undefined;
  error: Error | null;
} {
  const result = useQuery_experimental({
    query,
    args,
    throwOnError: false,
  });

  if (result.status === "error") {
    return { data: undefined, error: result.error };
  }
  if (result.status === "success") {
    return { data: result.data, error: null };
  }
  return { data: undefined, error: null };
}
