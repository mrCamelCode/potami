export function getPathParts(path: string) {
  return path.split('/');
}

/**
 * @param base - The base to compare against. The base is the minimum path you
 * expect to be in `path`.
 * @param path - The path to check. Must start with a /.
 *
 * @returns Whether the `path` starts with the `base`.
 */
export function baseMatchesPath(base: string | undefined, path: string) {
  const baseParts = getPathParts(base ?? '');
  const pathParts = getPathParts(path);

  return baseParts.every((part, index) => part === pathParts[index]);
}
