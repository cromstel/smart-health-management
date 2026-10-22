import { useCallback, useEffect, useMemo, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Shield, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, type RolePermissionFlags, type RoleRecord } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { useAudit } from '@/contexts/AuditContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { describeActionFailure } from '@/lib/api';
import {
  GLOBAL_MODULE,
  PERMISSION_ACTIONS,
  buildPermissionDraft,
  buildPermissionPayload,
  hasUnsavedChanges,
} from '@/lib/rolePermissions';

/**
 * Roles and the permissions they hold.
 *
 * The page used to be able to list the roles and create them, and nothing
 * else: the switches in the permissions table were not connected to
 * anything, the "Save Changes" button did nothing, and the "Delete Role"
 * button only wrote an audit entry about itself. The permissions a role
 * holds are what decides what the clinical workforce can reach, so the
 * editor is the point of the page and it now writes through the API:
 * GET /roles/:id reads the role that is about to be changed, and
 * PUT /roles/:id/permissions writes the capabilities back.
 */

interface RoleSummary {
  /** `roles.id`. The service returns the numeric key. */
  id: string | number;
  name: string;
  description: string | null;
  user_count: number;
  permissions: Record<string, RolePermissionFlags>;
}

const ACTION_LABEL: Record<(typeof PERMISSION_ACTIONS)[number], string> = {
  view: 'View',
  add: 'Add',
  edit: 'Edit',
  delete: 'Delete',
};

export default function RolesPage() {
  const { hasPermission, user } = useAuth();
  const { logAction } = useAudit();

  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // The role the editor is showing, and the copy of it the server holds.
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [roleDetail, setRoleDetail] = useState<RoleRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [draft, setDraft] = useState<Record<string, RolePermissionFlags>>({});
  const [saving, setSaving] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);

  // The create dialog.
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newRole, setNewRole] = useState({ name: '', description: '' });
  const [creating, setCreating] = useState(false);

  // The delete confirmation.
  const [rolePendingDelete, setRolePendingDelete] = useState<RoleSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  const canEdit = hasPermission('role:edit');
  const canDelete = hasPermission('role:delete');
  const canAdd = hasPermission('role:add');

  // The platform administrator holds the wildcard grant. Only they may
  // change it, because it decides access to every module at once.
  const isPlatformAdmin = user?.role === 'super_admin' || user?.role === 'Super Admin';

  const loadRoles = useCallback(async () => {
    try {
      setLoading(true);
      const data = (await api.getRoles()) as RoleSummary[];
      setRoles(Array.isArray(data) ? data : []);
      setLoadError(null);
    } catch (error) {
      setRoles([]);
      setLoadError(describeActionFailure(error, 'Failed to load roles'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRoles();
  }, [loadRoles]);

  /**
   * The modules the installation knows about.
   *
   * They are read from the roles that exist rather than from a list written
   * into this file: a module the API guards but no role holds yet would
   * still be offered, and a module that no longer exists disappears on its
   * own instead of lingering in a hard-coded table.
   */
  const knownModules = useMemo(() => {
    const modules = new Set<string>();
    roles.forEach((role) =>
      Object.keys(role.permissions ?? {}).forEach((module) => modules.add(module))
    );
    return Array.from(modules).sort();
  }, [roles]);

  /**
   * Reads the role that is about to be edited.
   *
   * The list is a summary for the picker; the record that is about to
   * change deserves to be the one the server read back.
   */
  const selectRole = useCallback(
    async (roleId: string) => {
      setSelectedRoleId(roleId);
      setDetailLoading(true);
      setEditorError(null);

      try {
        const detail = await api.getRole(roleId);
        setRoleDetail(detail);
        setDraft(buildPermissionDraft(detail.permissions, knownModules));
      } catch (error) {
        setRoleDetail(null);
        setDraft({});
        setEditorError(describeActionFailure(error, 'Failed to load the role'));
      } finally {
        setDetailLoading(false);
      }
    },
    [knownModules]
  );

  const selectedRole = useMemo(
    () => roles.find((role) => String(role.id) === selectedRoleId) ?? null,
    [roles, selectedRoleId]
  );

  const editableModules = useMemo(() => {
    const modules = new Set(knownModules);
    Object.keys(draft).forEach((module) => modules.add(module));
    return Array.from(modules).sort();
  }, [knownModules, draft]);

  const dirty = useMemo(
    () => hasUnsavedChanges(draft, roleDetail?.permissions ?? {}),
    [draft, roleDetail]
  );

  const handleToggle = (module: string, action: (typeof PERMISSION_ACTIONS)[number], checked: boolean) => {
    setDraft((previous) => {
      const current = previous[module] ?? { view: false, add: false, edit: false, delete: false };
      return {
        ...previous,
        [module]: { ...current, [action]: checked },
      };
    });
  };

  const handleSavePermissions = async () => {
    if (!roleDetail) return;

    setSaving(true);
    setEditorError(null);

    try {
      const existingModules = Object.keys(roleDetail.permissions ?? {});
      await api.updateRolePermissions(roleDetail.id, buildPermissionPayload(draft, existingModules));
      logAction('permission_update', 'role', {
        recordId: String(roleDetail.id),
        newValue: Object.keys(draft).length + ' modules',
      });
      toast.success(`Permissions updated for ${roleDetail.name}`);
      await loadRoles();
      await selectRole(String(roleDetail.id));
    } catch (error) {
      const message = describeActionFailure(error, 'Failed to update permissions');
      setEditorError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddRole = async () => {
    if (newRole.name.trim() === '') {
      toast.error('A role needs a name');
      return;
    }

    setCreating(true);
    try {
      const created = await api.createRole({
        name: newRole.name.trim(),
        description: newRole.description.trim(),
      });
      logAction('create', 'role', { recordId: String(created.id), newValue: newRole.name.trim() });      toast.success(`Role ${newRole.name.trim()} created. Grant its permissions next.`);
      setIsDialogOpen(false);
      setNewRole({ name: '', description: '' });
      await loadRoles();
      // The new role has no permissions yet, so it is opened in the editor
      // straight away: that is the next thing that has to happen.
      await selectRole(String(created.id));
    } catch (error) {
      toast.error(describeActionFailure(error, 'Failed to create the role'));
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteRole = async () => {
    if (!rolePendingDelete) return;

    setDeleting(true);
    try {
      await api.deleteRole(rolePendingDelete.id);
      logAction('delete', 'role', {
        recordId: String(rolePendingDelete.id),
        oldValue: rolePendingDelete.name,
      });
      toast.success(`Role ${rolePendingDelete.name} deleted`);
      setRolePendingDelete(null);
      if (selectedRoleId === String(rolePendingDelete.id)) {
        setSelectedRoleId(null);
        setRoleDetail(null);
        setDraft({});
      }
      await loadRoles();
    } catch (error) {
      toast.error(describeActionFailure(error, 'Failed to delete the role'));
    } finally {
      setDeleting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setNewRole((prev) => ({ ...prev, [id]: value }));
  };

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="space-y-4" role="status" aria-label="Loading roles">
          <span className="sr-only">Loading data...</span>
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-8 w-56" />
              <Skeleton className="h-4 w-72" />
            </div>
            <Skeleton className="h-10 w-32" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-56 w-full" />
            <Skeleton className="h-56 w-full" />
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-3xl font-semibold text-foreground">Roles & Permissions</h1>
              <p className="text-muted-foreground">Manage user roles and access control</p>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2" disabled={!canAdd}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Create Role
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Create New Role</DialogTitle>
                  <DialogDescription>
                    Give the role a name and a description. Its permissions are granted in the editor
                    once it exists.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Role Name</Label>
                    <Input
                      id="name"
                      placeholder="e.g., Pharmacist"
                      value={newRole.name}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Input
                      id="description"
                      placeholder="Brief description of the role"
                      value={newRole.description}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={() => void handleAddRole()} disabled={!canAdd || creating}>
                    {creating ? 'Creating...' : 'Create Role'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {loadError && (
            <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {loadError}
            </p>
          )}

          <ErrorBoundary fallbackTitle="Error loading Roles">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>System Roles</CardTitle>
                  <CardDescription>Select a role to view and edit its permissions</CardDescription>
                </CardHeader>
                <CardContent>
                  {roles.length === 0 && !loading ? (
                    <div className="text-center py-12">
                      <p className="text-muted-foreground">No roles found.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {roles.map((role) => (
                        <button
                          key={role.id}
                          type="button"
                          onClick={() => void selectRole(String(role.id))}
                          aria-pressed={selectedRole?.id === role.id}
                          className={`flex w-full items-center justify-between rounded-lg border p-4 text-left transition-colors ${
                            selectedRole?.id === role.id
                              ? 'border-accent bg-accent/10'
                              : 'border-border hover:bg-muted/50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Shield className="h-5 w-5 text-accent" aria-hidden="true" />
                            <div>
                              <p className="font-medium text-foreground">{role.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {role.description ?? `Permissions for the ${role.name} role`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">{role.user_count} users</Badge>
                            <Badge variant="outline">
                              {Object.keys(role.permissions ?? {}).length} modules
                            </Badge>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>
                    {selectedRole ? `${selectedRole.name} Permissions` : 'Select a Role'}
                  </CardTitle>
                  <CardDescription>
                    {selectedRole
                      ? 'The capabilities this role holds in each module'
                      : 'Select a role from the list to view permissions'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {selectedRole ? (
                    <div className="space-y-4">
                      {detailLoading ? (
                        <div className="space-y-2" role="status" aria-label="Loading permissions">
                          <span className="sr-only">Loading permissions...</span>
                          <Skeleton className="h-10 w-full" />
                          <Skeleton className="h-10 w-full" />
                          <Skeleton className="h-10 w-full" />
                        </div>
                      ) : (
                        <>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Module</TableHead>
                                {PERMISSION_ACTIONS.map((action) => (
                                  <TableHead key={action} className="text-center">
                                    {ACTION_LABEL[action]}
                                  </TableHead>
                                ))}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {editableModules.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={PERMISSION_ACTIONS.length + 1} className="text-center text-muted-foreground">
                                    No module is configured for this installation.
                                  </TableCell>
                                </TableRow>
                              ) : (
                                editableModules.map((module) => (
                                  <TableRow key={module}>
                                    <TableCell className="font-medium capitalize">
                                      {module}
                                      {module === GLOBAL_MODULE && (
                                        <span className="ml-2 text-xs text-muted-foreground">
                                          every module
                                        </span>
                                      )}
                                    </TableCell>
                                    {PERMISSION_ACTIONS.map((action) => {
                                      const switchId = `permission-${module}-${action}`;
                                      // The wildcard grant decides access to
                                      // every module at once, so it is only
                                      // editable by the platform administrator.
                                      const locked =
                                        module === GLOBAL_MODULE && !isPlatformAdmin;
                                      return (
                                        <TableCell key={action} className="text-center">
                                          <Switch
                                            id={switchId}
                                            aria-label={`${module} — ${ACTION_LABEL[action]}`}
                                            checked={Boolean(draft[module]?.[action])}
                                            disabled={!canEdit || locked}
                                            onCheckedChange={(checked) =>
                                              handleToggle(module, action, checked === true)
                                            }
                                          />
                                        </TableCell>
                                      );
                                    })}
                                  </TableRow>
                                ))
                              )}
                            </TableBody>
                          </Table>

                          {editorError && (
                            <p role="alert" className="text-sm text-destructive">
                              {editorError}
                            </p>
                          )}

                          <div className="flex justify-end gap-2 pt-2 flex-wrap">
                            <Button
                              variant="outline"
                              onClick={() => setRolePendingDelete(selectedRole)}
                              disabled={!canDelete}
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                              Delete Role
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() =>
                                setDraft(buildPermissionDraft(roleDetail?.permissions, knownModules))
                              }
                              disabled={!canEdit || !dirty}
                            >
                              Discard changes
                            </Button>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span>
                                    <Button
                                      onClick={() => void handleSavePermissions()}
                                      disabled={!canEdit || !dirty || saving}
                                    >
                                      {saving ? 'Saving...' : 'Save permissions'}
                                    </Button>
                                  </span>
                                </TooltipTrigger>
                                {!canEdit && <TooltipContent>Requires permission: role:edit</TooltipContent>}
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="flex h-64 items-center justify-center text-muted-foreground">
                      No role selected
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </ErrorBoundary>

          <Dialog
            open={rolePendingDelete !== null}
            onOpenChange={(open) => {
              if (!open) setRolePendingDelete(null);
            }}
          >
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Delete role</DialogTitle>
                <DialogDescription>
                  {rolePendingDelete
                    ? `${rolePendingDelete.name} and the permissions it holds are removed.`
                    : 'The role and the permissions it holds are removed.'}
                </DialogDescription>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                {rolePendingDelete && rolePendingDelete.user_count > 0
                  ? `${rolePendingDelete.user_count} account${
                      rolePendingDelete.user_count === 1 ? '' : 's'
                    } use this role. Deleting it leaves those accounts without access.`
                  : 'No account uses this role.'}
              </p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setRolePendingDelete(null)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => void handleDeleteRole()}
                  disabled={deleting}
                >
                  {deleting ? 'Deleting...' : 'Delete role'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
