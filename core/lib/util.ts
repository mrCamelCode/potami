/**
 * Simply splits the path by `/`.
 * 
 * @param path - The path to split.
 * 
 * @returns The path parts that were separated by `/`.
 */
export function getPathParts(path: string): string[] {
  return path.split('/');
}

/**
 * @param req - The request to parse.
 *
 * @returns The path from the request. This is the part after the domain.
 * Does not include query params.
 *
 * @example
 * ```ts
 * // Assuming a request to http://localhost:3000/some/path/:param?param=123&bool=true
 * getRequestPath(req); // => /some/path/:param
 * ```
 */
export function getRequestPath(req: Request): string {
  return new URL(req.url).pathname;
}

/**
 * @param base - The base to compare against. The base is the minimum path you
 * expect to be in `path`.
 * @param path - The path to check. Must start with a /.
 *
 * @returns Whether the `path` starts with the `base`.
 */
export function baseMatchesPath(base: string | undefined, path: string): boolean {
  const baseParts = getPathParts(base ?? '');
  const pathParts = getPathParts(path);

  return baseParts.every((part, index) => part === pathParts[index]);
}
