import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import {
  Building2,
  Calendar,
  Edit,
  Mail,
  Phone,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';

import { toast } from 'sonner';

interface Staff {
  id: string;
  name: string;
  role: string;
  department: string;
  hospital: string;
  email: string;
  phone: string;
  joinDate: string;
  status: 'Active' | 'On Leave' | 'Inactive';
}

interface Hospital {
  id: string;
  name: string;
}

interface Role {
  id: string;
  name: string;
}

interface Department {
  id: string;
  name: string;
}

const mockStaff: Staff[] = [
  {
    id: 'S001',
    name: 'Dr. Michael Chen',
    role: 'Doctor',
    department: 'Cardiology',
    hospital: 'Central Hospital',
    email: 'michael.chen@hospital.com',
    phone: '+233 24 111 2222',
    joinDate: '2020-03-15',
    status: 'Active',
  },
];

export default function StaffPage() {
  const { hasPermission, canActOnHospital, user } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [staff, setStaff] = useState<Staff[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [newStaff, setNewStaff] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    roleId: '',
    hospitalId: '',
    departmentId: '',
    status: 'Active',
  });
  const [editStaffData, setEditStaffData] = useState({
    id: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    roleId: '',
    hospitalId: '',
    departmentId: '',
    status: '',
  });

  const loadStaff = useCallback(async () => {
    try {
      const data = await api.getStaff() as any[];
      const transformedData = data.map((s: any) => ({
        id: s.id,
        name: `${s.first_name} ${s.last_name}`,
        role: s.role_name,
        department: s.department_name || 'N/A',
        hospital: s.hospital_name,
        email: s.email,
        phone: s.phone,
        joinDate: new Date(s.join_date).toLocaleDateString(),
        status: s.status,
      }));
      setStaff(transformedData);
    } catch (error: any) {
      console.error('Failed to load staff:', error);
      toast.error(`Failed to load staff: ${error.message}`);
      setStaff(mockStaff);
    }
  }, []);

  const loadHospitals = useCallback(async () => {
    try {
      const data = await api.getHospitals() as any[];
      setHospitals(data.map((h: any) => ({ id: h.id, name: h.name })));
    } catch (error) {
      console.error('Failed to load hospitals:', error);
      toast.error('Failed to load hospitals.');
    }
  }, []);

  const loadRoles = useCallback(async () => {
    try {
      const data = await api.getRoles() as any[];
      setRoles(data.map((r: any) => ({ id: r.id, name: r.name })));
    } catch (error) {
      console.error('Failed to load roles:', error);
      toast.error('Failed to load roles.');
    }
  }, []);

  const loadDepartments = useCallback(async (hospitalId: string) => {
    try {
      // Assuming an API endpoint to get departments by hospital
      const data = await api.getDepartmentsByHospital(hospitalId) as any[];
      setDepartments(data.map((d: any) => ({ id: d.id, name: d.name })));
    } catch (error) {
      console.error('Failed to load departments:', error);
      toast.error('Failed to load departments.');
    }
  }, []);

  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      if (!hasPermission('staff:view') || !canActOnHospital(user?.hospital_id)) {
        setStaff([]);
        return;
      }
      await Promise.all([loadStaff(), loadHospitals(), loadRoles()]);
    } catch (error) {
      console.error('Failed to load initial data:', error);
    } finally {
      setLoading(false);
    }
  }, [loadStaff, loadHospitals, loadRoles, hasPermission, canActOnHospital, user?.hospital_id]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setNewStaff(prev => ({ ...prev, [id]: value }));
  };

  const handleEditInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setEditStaffData(prev => ({ ...prev, [id]: value }));
  };

  const handleSelectChange = (id: string, value: string) => {
    setNewStaff(prev => ({ ...prev, [id]: value }));
    if (id === 'hospitalId') {
      loadDepartments(value);
    }
  };

  const handleEditSelectChange = (id: string, value: string) => {
    setEditStaffData(prev => ({ ...prev, [id]: value }));
    if (id === 'hospitalId') {
      loadDepartments(value);
    }
  };

  const handleAddStaff = async () => {
    try {
      await api.createStaff(newStaff);
      toast.success('Staff member created successfully!');
      await loadStaff();
      setIsAddDialogOpen(false);
      setNewStaff({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        roleId: '',
        hospitalId: '',
        departmentId: '',
        status: 'Active',
      });
    } catch (error: any) {
      console.error('Failed to create staff:', error);
      toast.error(`Failed to create staff: ${error.message}`);
    }
  };

  const openEditDialog = (staffMember: Staff) => {
    setSelectedStaff(staffMember);
    // This is a simplified mapping. You might need a more robust way to get the original data.
    const staffData = staff.find(s => s.id === staffMember.id);
    if (staffData) {
      setEditStaffData({
        id: staffData.id,
        firstName: staffData.name.split(' ')[0],
        lastName: staffData.name.split(' ')[1],
        email: staffData.email,
        phone: staffData.phone,
        roleId: roles.find(r => r.name === staffData.role)?.id || '',
        hospitalId: hospitals.find(h => h.name === staffData.hospital)?.id || '',
        departmentId: '', // Needs to be loaded
        status: staffData.status,
      });
      const hospitalId = hospitals.find(h => h.name === staffData.hospital)?.id;
      if (hospitalId) {
        loadDepartments(hospitalId);
      }
    }
    setIsEditDialogOpen(true);
  };

  const handleEditStaff = async () => {
    try {
      if (!selectedStaff) return;
      await api.updateStaff(selectedStaff.id, editStaffData);
      toast.success('Staff member updated successfully!');
      await loadStaff();
      setIsEditDialogOpen(false);
      setSelectedStaff(null);
    } catch (error: any) {
      console.error('Failed to update staff:', error);
      toast.error(`Failed to update staff: ${error.message}`);
    }
  };

  const openDeleteDialog = (staffMember: Staff) => {
    setSelectedStaff(staffMember);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteStaff = async () => {
    try {
      if (!selectedStaff) return;
      await api.deleteStaff(selectedStaff.id);
      toast.success('Staff member deleted successfully!');
      await loadStaff();
      setIsDeleteDialogOpen(false);
      setSelectedStaff(null);
    } catch (error: any) {
      console.error('Failed to delete staff:', error);
      toast.error(`Failed to delete staff: ${error.message}`);
    }
  };

  const filteredStaff = staff.filter(member =>
    member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {loading && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading data...</p>
        </div>
      )}
      {!loading && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Staff Management</h1>
              <p className="text-muted-foreground">Manage healthcare staff and assignments</p>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2" disabled={!hasPermission('staff:add')}>
                  <Plus className="h-4 w-4" />
                  Add Staff
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Add New Staff Member</DialogTitle>
                  <DialogDescription>
                    Register a new healthcare professional
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name</Label>
                      <Input id="firstName" placeholder="John" value={newStaff.firstName} onChange={handleInputChange} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input id="lastName" placeholder="Doe" value={newStaff.lastName} onChange={handleInputChange} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="role">Role</Label>
                      <Select onValueChange={(value) => handleSelectChange('roleId', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          {roles.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="departmentId">Department</Label>
                      <Select onValueChange={(value) => handleSelectChange('departmentId', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select department" />
                        </SelectTrigger>
                        <SelectContent>
                          {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hospitalId">Hospital</Label>
                    <Select onValueChange={(value) => handleSelectChange('hospitalId', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select hospital" />
                      </SelectTrigger>
                      <SelectContent>
                        {hospitals.map(h => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" placeholder="staff@hospital.com" value={newStaff.email} onChange={handleInputChange} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input id="phone" placeholder="+233 24 123 4567" value={newStaff.phone} onChange={handleInputChange} />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleAddStaff} disabled={!hasPermission('staff:add') || !canActOnHospital(newStaff.hospitalId)}>Add Staff</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Edit Staff Dialog */}
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Edit Staff Member</DialogTitle>
                <DialogDescription>
                  Update the details of a staff member
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input id="firstName" placeholder="John" value={editStaffData.firstName} onChange={handleEditInputChange} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input id="lastName" placeholder="Doe" value={editStaffData.lastName} onChange={handleEditInputChange} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <Select onValueChange={(value) => handleEditSelectChange('roleId', value)} value={editStaffData.roleId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="departmentId">Department</Label>
                    <Select onValueChange={(value) => handleEditSelectChange('departmentId', value)} value={editStaffData.departmentId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hospitalId">Hospital</Label>
                  <Select onValueChange={(value) => handleEditSelectChange('hospitalId', value)} value={editStaffData.hospitalId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select hospital" />
                    </SelectTrigger>
                    <SelectContent>
                      {hospitals.map(h => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" placeholder="staff@hospital.com" value={editStaffData.email} onChange={handleEditInputChange} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" placeholder="+233 24 123 4567" value={editStaffData.phone} onChange={handleEditInputChange} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select onValueChange={(value) => handleEditSelectChange('status', value)} value={editStaffData.status}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="On Leave">On Leave</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleEditStaff} disabled={!hasPermission('staff:edit')}>Save Changes</Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Delete Staff Dialog */}
          <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm Deletion</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete this staff member? This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
                <Button variant="destructive" onClick={handleDeleteStaff} disabled={!hasPermission('staff:delete')}>Delete</Button>
              </div>
            </DialogContent>
          </Dialog>

          <Tabs defaultValue="all" className="space-y-4">
            <TabsList>
              <TabsTrigger value="all">All Staff</TabsTrigger>
              <TabsTrigger value="doctors">Doctors</TabsTrigger>
              <TabsTrigger value="nurses">Nurses</TabsTrigger>
              <TabsTrigger value="other">Other</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Staff Directory</CardTitle>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search staff..."
                        className="pl-9 w-64"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {(!hasPermission('staff:view') || !canActOnHospital(user?.hospital_id)) ? (
                    <div className="text-center py-12">
                      <p className="text-destructive">Unauthorized to view staff for this hospital.</p>
                    </div>
                  ) : staff.length === 0 && !loading ? (
                    <div className="text-center py-12">
                      <p className="text-muted-foreground">No staff members found.</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Staff</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Department</TableHead>
                          <TableHead>Hospital</TableHead>
                          <TableHead>Contact</TableHead>
                          <TableHead>Join Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredStaff.map((member) => (
                          <TableRow key={member.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar>
                                  <AvatarFallback className="bg-primary text-primary-foreground">
                                    {member.name.split(' ').map(n => n[0]).join('')}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium text-foreground">{member.name}</p>
                                  <p className="text-xs text-muted-foreground">{member.id}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{member.role}</Badge>
                            </TableCell>
                            <TableCell>{member.department}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Building2 className="h-3 w-3 text-muted-foreground" />
                                {member.hospital}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <div className="flex items-center gap-1 text-xs">
                                  <Mail className="h-3 w-3 text-muted-foreground" />
                                  {member.email}
                                </div>
                                <div className="flex items-center gap-1 text-xs">
                                  <Phone className="h-3 w-3 text-muted-foreground" />
                                  {member.phone}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 text-sm">
                                <Calendar className="h-3 w-3 text-muted-foreground" />
                                {member.joinDate}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  member.status === 'Active'
                                    ? 'default'
                                    : member.status === 'On Leave'
                                      ? 'secondary'
                                      : 'destructive'
                                }
                              >
                                {member.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button variant="ghost" size="sm" onClick={() => openEditDialog(member)} disabled={!hasPermission('staff:edit')}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => openDeleteDialog(member)} disabled={!hasPermission('staff:delete')}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
