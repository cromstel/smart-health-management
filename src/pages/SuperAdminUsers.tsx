import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, UserCheck, UserX, Lock, Unlock, AlertCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/contexts/AuthContext';
import { useAudit } from '@/contexts/AuditContext';

interface User {
  id: string;
  email: string;
  name: string;
  status: 'active' | 'inactive' | 'locked';
  last_login: string | null;
  created_at: string;
  role_name: string;
  role_description: string;
}

export default function SuperAdminUsers() {
  const { hasPermission } = useAuth();
  const { logAction } = useAudit();
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getAllUsers() as { users: User[] };
      setUsers(data.users);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const filterUsers = useCallback(() => {
    let filtered = [...users];

    if (searchTerm) {
      filtered = filtered.filter(
        (user) =>
          user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((user) => user.status === statusFilter);
    }

    if (roleFilter !== 'all') {
      filtered = filtered.filter((user) => user.role_name === roleFilter);
    }

    setFilteredUsers(filtered);
  }, [users, searchTerm, statusFilter, roleFilter]);

  useEffect(() => {
    filterUsers();
  }, [filterUsers]);

  

  const handleStatusChange = async (userId: string, newStatus: 'active' | 'inactive' | 'locked') => {
    try {
      await api.updateUserStatus(userId, newStatus);
      await loadUsers();
    } catch (err: any) {
      alert('Failed to update user status: ' + err.message);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; label: string }> = {
      active: { variant: 'default', label: 'Active' },
      inactive: { variant: 'secondary', label: 'Inactive' },
      locked: { variant: 'destructive', label: 'Locked' },
    };
    const config = variants[status] || variants.active;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const uniqueRoles = Array.from(new Set(users.map((u) => u.role_name)));

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">User Management</h1>
        <p className="text-muted-foreground mt-1">Manage all system users and their access</p>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-500">{error}</p>
        </div>
      )}

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">All Users ({filteredUsers.length})</CardTitle>
          <CardDescription className="text-muted-foreground">
            View and manage user accounts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-background border-border"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48 bg-background border-border">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="locked">Locked</SelectItem>
              </SelectContent>
            </Select>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full md:w-48 bg-background border-border">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {uniqueRoles.map((role) => (
                  <SelectItem key={role} value={role}>
                    {role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="border border-border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-muted">
                  <TableHead className="text-muted-foreground">Name</TableHead>
                  <TableHead className="text-muted-foreground">Email</TableHead>
                  <TableHead className="text-muted-foreground">Role</TableHead>
                  <TableHead className="text-muted-foreground">Status</TableHead>
                  <TableHead className="text-muted-foreground">Last Login</TableHead>
                  <TableHead className="text-muted-foreground">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id} className="border-border hover:bg-muted">
                      <TableCell className="text-foreground font-medium">{user.name}</TableCell>
                      <TableCell className="text-muted-foreground">{user.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-accent/20 text-accent">
                          {user.role_name}
                        </Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(user.status)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.last_login
                          ? new Date(user.last_login).toLocaleDateString()
                          : 'Never'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {user.status === 'active' && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={!hasPermission('superadmin:edit')}
                                      onClick={() => {
                                        if (!hasPermission('superadmin:edit')) {
                                          logAction('permission_block', 'superadmin', { recordId: user.id, oldValue: 'set_inactive' });
                                          return;
                                        }
                                        handleStatusChange(user.id, 'inactive');
                                      }}
                                      className="border-border text-muted-foreground hover:text-foreground"
                                    >
                                      <UserX className="w-4 h-4" />
                                    </Button>
                                  </span>
                                </TooltipTrigger>
                                {!hasPermission('superadmin:edit') && (
                                  <TooltipContent>
                                    Requires permission: superadmin:edit
                                  </TooltipContent>
                                )}
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          {user.status === 'inactive' && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={!hasPermission('superadmin:edit')}
                                      onClick={() => {
                                        if (!hasPermission('superadmin:edit')) {
                                          logAction('permission_block', 'superadmin', { recordId: user.id, oldValue: 'set_active' });
                                          return;
                                        }
                                        handleStatusChange(user.id, 'active');
                                      }}
                                      className="border-border text-muted-foreground hover:text-foreground"
                                    >
                                      <UserCheck className="w-4 h-4" />
                                    </Button>
                                  </span>
                                </TooltipTrigger>
                                {!hasPermission('superadmin:edit') && (
                                  <TooltipContent>
                                    Requires permission: superadmin:edit
                                  </TooltipContent>
                                )}
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          {user.status !== 'locked' && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={!hasPermission('superadmin:edit')}
                                      onClick={() => {
                                        if (!hasPermission('superadmin:edit')) {
                                          logAction('permission_block', 'superadmin', { recordId: user.id, oldValue: 'lock' });
                                          return;
                                        }
                                        handleStatusChange(user.id, 'locked');
                                      }}
                                      className="border-border text-muted-foreground hover:text-foreground"
                                    >
                                      <Lock className="w-4 h-4" />
                                    </Button>
                                  </span>
                                </TooltipTrigger>
                                {!hasPermission('superadmin:edit') && (
                                  <TooltipContent>
                                    Requires permission: superadmin:edit
                                  </TooltipContent>
                                )}
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          {user.status === 'locked' && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={!hasPermission('superadmin:edit')}
                                      onClick={() => {
                                        if (!hasPermission('superadmin:edit')) {
                                          logAction('permission_block', 'superadmin', { recordId: user.id, oldValue: 'unlock' });
                                          return;
                                        }
                                        handleStatusChange(user.id, 'active');
                                      }}
                                      className="border-border text-muted-foreground hover:text-foreground"
                                    >
                                      <Unlock className="w-4 h-4" />
                                    </Button>
                                  </span>
                                </TooltipTrigger>
                                {!hasPermission('superadmin:edit') && (
                                  <TooltipContent>
                                    Requires permission: superadmin:edit
                                  </TooltipContent>
                                )}
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
