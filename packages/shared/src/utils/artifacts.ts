/**
 * Pick the highest-version artifact of a given type from an artifacts array.
 * Returns undefined if no artifact of that type exists.
 */
export function pickLatestArtifact<T = unknown>(
  artifacts: Array<{ type: string; payload: unknown; version: number }>,
  artifactType: string
): { payload: T; version: number } | undefined {
  const matching = artifacts.filter((a) => a.type === artifactType);
  if (matching.length === 0) return undefined;

  const latest = matching.reduce((best, curr) =>
    curr.version > best.version ? curr : best
  );

  return { payload: latest.payload as T, version: latest.version };
}
