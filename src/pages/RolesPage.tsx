import { useState, useEffect } from 'react';
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
import { Plus, Shield, Edit, Trash2 } from 'lucide-react';
import { api } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { useAudit } from '@/contexts/AuditContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface Role {
  id: string;
  name: string;
  description: string;
  userCount: number;
  permissions: {
    patients: { view: boolean; add: boolean; edit: boolean; delete: boolean };
    appointments: { view: boolean; add: boolean; edit: boolean; delete: boolean };
    staff: { view: boolean; add: boolean; edit: boolean; delete: boolean };
    financial: { view: boolean; add: boolean; edit: boolean; delete: boolean };
  };
}

export default function RolesPage() {
  const { hasPermission } = useAuth();
  const { logAction } = useAudit();
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newRole, setNewRole] = useState({
    name: '',
    description: '',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRoles();
  }, []);

  const loadRoles = async () => {
    try {
      setLoading(true);
      const data = await api.getRoles() as any[];
      if (Array.isArray(data)) {
        const transformedData = data.map((role: any) => {
          const perms = role.permissions || {};
          return {
            id: role.id,
            name: role.name,
            description: role.description || `Permissions for ${role.name} role`,
            userCount: role.userCount || role.user_count || 0,
            permissions: {
              patients: {
                view: perms.patients?.view ?? true,
                add: perms.patients?.add ?? (role.name !== 'Nurse'),
                edit: perms.patients?.edit ?? true,
                delete: perms.patients?.delete ?? (role.name === 'Admin' || role.name === 'Super Admin'),
              },
              appointments: {
                view: perms.appointments?.view ?? true,
                add: perms.appointments?.add ?? true,
                edit: perms.appointments?.edit ?? true,
                delete: perms.appointments?.delete ?? (role.name === 'Admin' || role.name === 'Super Admin'),
              },
              staff: {
                view: perms.staff?.view ?? (role.name !== 'Nurse'),
                add: perms.staff?.add ?? (role.name === 'Admin' || role.name === 'Super Admin'),
                edit: perms.staff?.edit ?? (role.name === 'Admin' || role.name === 'Super Admin'),
                delete: perms.staff?.delete ?? (role.name === 'Admin' || role.name === 'Super Admin'),
              },
              financial: {
                view: perms.financial?.view ?? (role.name === 'Admin' || role.name === 'Super Admin' || role.name === 'Accountant'),
                add: perms.financial?.add ?? (role.name === 'Admin' || role.name === 'Super Admin' || role.name === 'Accountant'),
                edit: perms.financial?.edit ?? (role.name === 'Admin' || role.name === 'Super Admin'),
                delete: perms.financial?.delete ?? (role.name === 'Admin' || role.name === 'Super Admin'),
              },
            },
          };
        });
        setRoles(transformedData);
      } else {
        setRoles([]);
      }
    } catch (error: any) {
      console.error('Failed to load roles from API:', error);
      setRoles([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setNewRole(prev => ({ ...prev, [id]: value }));
  };

  const handleAddRole = async () => {
    try {
      await api.createRole({
        name: newRole.name,
        description: newRole.description,
      });
      await loadRoles();
      setIsDialogOpen(false);
      setNewRole({
        name: '',
        description: '',
      });
    } catch (error) {
      console.error('Failed to create role:', error);
    }
  };

  return (
    <div className="space-y-6">
	{loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading data...</p>
          </div>
        ) : (
		<>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Roles & Permissions</h1>
          <p className="text-muted-foreground">Manage user roles and access control</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" disabled={!hasPermission('role:add')}>
              <Plus className="h-4 w-4" />
              Create Role
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Create New Role</DialogTitle>
              <DialogDescription>
                Define a new role with specific permissions
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Role Name</Label>
                <Input id="name" placeholder="e.g., Pharmacist" value={newRole.name} onChange={handleInputChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input id="description" placeholder="Brief description of the role" value={newRole.description} onChange={handleInputChange} />
              </div>
              <div className="space-y-4">
                <h3 className="font-medium text-foreground">Permissions</h3>
                <div className="space-y-4">
                  {['Patients', 'Appointments', 'Staff', 'Financial'].map((module) => (
                    <Card key={module}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">{module}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-4 gap-4">
                          {['View', 'Add', 'Edit', 'Delete'].map((action) => (
                            <div key={action} className="flex items-center space-x-2">
                              <Switch id={`${module}-${action}`} />
                              <Label htmlFor={`${module}-${action}`} className="text-sm">
                                {action}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleAddRole} disabled={!hasPermission('role:add')}>Create Role</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>System Roles</CardTitle>
            <CardDescription>Click a role to view and edit permissions</CardDescription>
          </CardHeader>
          <CardContent>
		  {roles.length === 0 && !loading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No roles found.</p>
              </div>
            ) : (
            <div className="space-y-2">
              {roles.map((role) => (
                <div
                  key={role.id}
                  onClick={() => setSelectedRole(role)}
                  className={`flex items-center justify-between rounded-lg border p-4 cursor-pointer transition-colors ${
                    selectedRole?.id === role.id
                      ? 'border-accent bg-accent/10'
                      : 'border-border hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Shield className="h-5 w-5 text-accent" />
                    <div>
                      <p className="font-medium text-foreground">{role.name}</p>
                      <p className="text-sm text-muted-foreground">{role.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{role.userCount} users</Badge>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={!hasPermission('role:edit')}
                            onClick={() => {
                              if (!hasPermission('role:edit')) {
                                logAction('permission_block', 'role', { recordId: role.id, oldValue: 'edit' });
                                return;
                              }
                              // open role edit modal or navigate
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        {!hasPermission('role:edit') && (
                          <TooltipContent>
                            Requires permission: role:edit
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
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
                ? 'View and modify role permissions'
                : 'Select a role from the list to view permissions'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedRole ? (
              <div className="space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Module</TableHead>
                      <TableHead className="text-center">View</TableHead>
                      <TableHead className="text-center">Add</TableHead>
                      <TableHead className="text-center">Edit</TableHead>
                      <TableHead className="text-center">Delete</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(selectedRole.permissions).map(([module, perms]) => (
                      <TableRow key={module}>
                        <TableCell className="font-medium capitalize">{module}</TableCell>
                        <TableCell className="text-center">
                          <Switch checked={perms.view} />
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch checked={perms.add} />
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch checked={perms.edit} disabled={!hasPermission('role:edit')} />
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch checked={perms.delete} disabled={!hasPermission('role:edit')} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="flex justify-end gap-2 pt-4">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          <Button
                            variant="outline"
                            className="gap-2"
                            disabled={!hasPermission('role:delete')}
                            onClick={() => {
                              if (!hasPermission('role:delete')) {
                                logAction('permission_block', 'role', { recordId: selectedRole?.id, oldValue: 'delete' });
                                return;
                              }
                              // delete role
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete Role
                          </Button>
                        </span>
                      </TooltipTrigger>
                      {!hasPermission('role:delete') && (
                        <TooltipContent>
                          Requires permission: role:delete
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          <Button
                            disabled={!hasPermission('role:edit')}
                            onClick={() => {
                              if (!hasPermission('role:edit')) {
                                logAction('permission_block', 'role', { recordId: selectedRole?.id, oldValue: 'edit' });
                                return;
                              }
                              // save changes
                            }}
                          >
                            Save Changes
                          </Button>
                        </span>
                      </TooltipTrigger>
                      {!hasPermission('role:edit') && (
                        <TooltipContent>
                          Requires permission: role:edit
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            ) : (
              <div className="flex h-64 items-center justify-center text-muted-foreground">
                No role selected
              </div>
            )}
          </CardContent>
        </Card>
      </div>
		</>
		)}
    </div>
  );
}
