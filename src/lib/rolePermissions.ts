import type { RolePermissionFlags, RolePermissionInput } from '@/services/api';

/**
 * The capabilities a permission row carries, in the order the editor shows
 * them. The order matches the order the API reads them in.
 */
export const PERMISSION_ACTIONS = ['view', 'add', 'edit', 'delete'] as const;

export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

/**
 * The wildcard module.
 *
 * A permission row for the module "all" grants the capability across every
 * module, which is the grant the super administrator holds. Editing it here
 * would hand a role more access than the table is able to show, so it is
 * reserved for the platform administrator.
 */
export const GLOBAL_MODULE = 'all';

/** A permission map with every capability switched off. */
export const emptyFlags = (): RolePermissionFlags => ({
  view: false,
  add: false,
  edit: false,
  delete: false,
});

/**
 * The draft the editor works on.
 *
 * Every module the installation knows about is present, so a module the role
 * does not hold yet can still be granted. The capabilities that are not
 * mentioned default to off, which is what an absent row means.
 */
export const buildPermissionDraft = (
  rolePermissions: Record<string, RolePermissionFlags> | undefined,
  knownModules: string[]
): Record<string, RolePermissionFlags> => {
  const draft: Record<string, RolePermissionFlags> = {};

  const modules = new Set(knownModules);
  Object.keys(rolePermissions ?? {}).forEach((module) => modules.add(module));

  modules.forEach((module) => {
    const flags = rolePermissions?.[module];
    draft[module] = {
      view: Boolean(flags?.view),
      add: Boolean(flags?.add),
      edit: Boolean(flags?.edit),
      delete: Boolean(flags?.delete),
    };
  });

  return draft;
};

/**
 * The modules to write back.
 *
 * A module the role already holds a row for is always written, so that
 * switching every capability off actually revokes the access instead of
 * leaving the old row in place. A module the role never held is only
 * written when a capability is switched on, so the editor does not fill the
 * table with empty rows that say nothing.
 */
export const buildPermissionPayload = (
  draft: Record<string, RolePermissionFlags>,
  existingModules: string[]
): RolePermissionInput[] => {
  const modules = new Set(existingModules);
  Object.entries(draft).forEach(([module, flags]) => {
    if (flags.view || flags.add || flags.edit || flags.delete) modules.add(module);
  });

  return Array.from(modules)
    .sort()
    .map((module) => ({
      module,
      view: draft[module]?.view ?? false,
      add: draft[module]?.add ?? false,
      edit: draft[module]?.edit ?? false,
      delete: draft[module]?.delete ?? false,
    }));
};

/**
 * Whether the draft differs from what the server holds.
 *
 * The save button is only enabled when there is something to save, so a
 * clinician cannot write a permission change that changes nothing.
 */
export const hasUnsavedChanges = (
  draft: Record<string, RolePermissionFlags>,
  original: Record<string, RolePermissionFlags>
): boolean => {
  const modules = new Set([...Object.keys(draft), ...Object.keys(original)]);
  for (const module of modules) {
    for (const action of PERMISSION_ACTIONS) {
      if (Boolean(draft[module]?.[action]) !== Boolean(original[module]?.[action])) return true;
    }
  }
  return false;
};
