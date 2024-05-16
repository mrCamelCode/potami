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

/**
 * Utility class that provides a way to an object immutable.
 * Attempting to mutate the object results in an error.
 */
export class Immutable {
  static make<T extends object>(obj: T): T {
    return new Proxy(obj, {
      set() {
        return false;
      },
    });
  }
}
