import path from 'node:path';

/**
 * A file name that is safe to write to disk.
 *
 * A name that came from a client — an upload's original name, a document's
 * name in the database — is used as a path segment, and a path segment that
 * carries a separator or a parent reference writes outside the directory it
 * was meant for. The name is therefore reduced to its last component, and
 * then to characters that cannot mean anything to the filesystem.
 *
 * Both separators are treated as separators, whichever platform the server
 * runs on. A name may have been composed on one system and stored on
 * another, and the server is the one that has to refuse it.
 *
 * The name a person sees is kept in the database. This is the name the file
 * is stored under, not the name it is shown with.
 */
export const safeFileName = (name: string | null | undefined, fallback = 'file'): string => {
  const segments = String(name ?? '').trim().split(/[/\\]+/);
  const base = segments[segments.length - 1] ?? '';
  const cleaned = base.replace(/[^A-Za-z0-9._-]/g, '_').replace(/^\.+/, '');
  return cleaned.length > 0 ? cleaned.slice(0, 180) : fallback;
};

/**
 * Whether a path lies inside a directory.
 *
 * The check is made on the resolved paths, so a name that tries to climb out
 * with `..` is caught, and a directory that is a prefix of another one
 * (`/data/app` and `/data/app-archive`) does not count as containing it.
 */
export const isInsideDirectory = (directory: string, candidate: string): boolean => {
  const parent = path.resolve(directory);
  const target = path.resolve(candidate);
  if (target === parent) return true;
  return target.startsWith(parent.endsWith(path.sep) ? parent : parent + path.sep);
};
