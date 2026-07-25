export const BASE_PATH = "/sunday-school";

export function withBasePath(path: string) {
  if (!path.startsWith("/")) return path;
  if (path === BASE_PATH || path.startsWith(`${BASE_PATH}/`)) return path;
  return path === "/" ? BASE_PATH : `${BASE_PATH}${path}`;
}
