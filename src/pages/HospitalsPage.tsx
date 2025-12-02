import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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
import { Plus, Building2, Users, Bed, Phone, Mail, MapPin, Edit, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Hospital {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  departments: number;
  staff: number;
  beds: number;
  status: 'Active' | 'Inactive';
}

const mockHospitals: Hospital[] = [
  {
    id: 'H001',
    name: 'Central Hospital',
    address: '123 Main Street, Accra',
    phone: '+233 30 123 4567',
    email: 'info@centralhospital.com',
    departments: 12,
    staff: 145,
    beds: 250,
    status: 'Active',
  },
  {
    id: 'H002',
    name: 'City Medical Center',
    address: '456 Health Avenue, Kumasi',
    phone: '+233 32 234 5678',
    email: 'contact@citymedical.com',
    departments: 8,
    staff: 98,
    beds: 180,
    status: 'Active',
  },
  {
    id: 'H003',
    name: 'Regional Hospital',
    address: '789 Care Road, Tamale',
    phone: '+233 37 345 6789',
    email: 'info@regionalhospital.com',
    departments: 10,
    staff: 112,
    beds: 200,
    status: 'Active',
  },
];

export default function HospitalsPage() {
  const { hasPermission } = useAuth();
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [selectedHospital, setSelectedHospital] = useState<Hospital | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [newHospital, setNewHospital] = useState({
    name: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    phone: '',
    email: '',
  });
  const [editHospitalData, setEditHospitalData] = useState({
    id: '',
    name: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    phone: '',
    email: '',
    status: '',
  });

  useEffect(() => {
    loadHospitals();
  }, []);

  const loadHospitals = async () => {
    try {
      setLoading(true);
      const data = await api.getHospitals() as any[];
      const transformedData = data.map((hospital: any) => ({
        id: hospital.id,
        name: hospital.name,
        address: `${hospital.address}, ${hospital.city}, ${hospital.state} ${hospital.zip_code}`,
        phone: hospital.phone,
        email: hospital.email,
        departments: hospital.departments || 0,
        staff: hospital.staff || 0,
        beds: hospital.beds || 0,
        status: hospital.status === 'active' ? 'Active' as const : 'Inactive' as const,
      }));
      setHospitals(transformedData);
    } catch (error: any) {
      console.error('Failed to load hospitals:', error);
      toast.error(`Failed to load hospitals: ${error.message}`);
      setHospitals(mockHospitals);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setNewHospital(prev => ({ ...prev, [id]: value }));
  };

  const handleAddHospital = async () => {
    try {
      await api.createHospital({
        name: newHospital.name,
        address: newHospital.address,
        city: newHospital.city,
        state: newHospital.state,
        zipCode: newHospital.zipCode,
        phone: newHospital.phone,
        email: newHospital.email,
      });
      await loadHospitals();
      setIsAddDialogOpen(false);
      setNewHospital({
        name: '',
        address: '',
        city: '',
        state: '',
        zipCode: '',
        phone: '',
        email: '',
      });
    } catch (error: any) {
      console.error('Failed to create hospital:', error);
      toast.error(`Failed to create hospital: ${error.message}`);
    }
  };

  const openEditDialog = (hospital: Hospital) => {
    setSelectedHospital(hospital);
    const addressParts = hospital.address.split(', ');
    const stateZip = addressParts[2] ? addressParts[2].split(' ') : ['', ''];
    setEditHospitalData({
      id: hospital.id,
      name: hospital.name,
      address: addressParts[0] || '',
      city: addressParts[1] || '',
      state: stateZip[0] || '',
      zipCode: stateZip[1] || '',
      phone: hospital.phone,
      email: hospital.email,
      status: hospital.status.toLowerCase(),
    });
    setIsEditDialogOpen(true);
  };

  const handleEditHospital = async () => {
    try {
      if (!selectedHospital) return;
      await api.updateHospital(selectedHospital.id, editHospitalData);
      toast.success('Hospital updated successfully!');
      await loadHospitals();
      setIsEditDialogOpen(false);
      setSelectedHospital(null);
    } catch (error: any) {
      console.error('Failed to update hospital:', error);
      toast.error(`Failed to update hospital: ${error.message}`);
    }
  };

  const openDeleteDialog = (hospital: Hospital) => {
    setSelectedHospital(hospital);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteHospital = async () => {
    try {
      if (!selectedHospital) return;
      await api.deleteHospital(selectedHospital.id);
      toast.success('Hospital deleted successfully!');
      await loadHospitals();
      setIsDeleteDialogOpen(false);
      setSelectedHospital(null);
    } catch (error: any) {
      console.error('Failed to delete hospital:', error);
      toast.error(`Failed to delete hospital: ${error.message}`);
    }
  };

  const handleEditInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setEditHospitalData(prev => ({ ...prev, [id]: value }));
  };

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
              <h1 className="text-3xl font-bold text-foreground">Hospital Management</h1>
              <p className="text-muted-foreground">Manage hospitals and their departments</p>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2" disabled={!hasPermission('hospital:add')}>
                  <Plus className="h-4 w-4" />
                  Add Hospital
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Register New Hospital</DialogTitle>
                  <DialogDescription>
                    Add a new hospital to the system
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Hospital Name</Label>
                    <Input id="name" placeholder="Central Hospital" value={newHospital.name} onChange={handleInputChange} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">Address</Label>
                    <Textarea id="address" placeholder="123 Main St" value={newHospital.address} onChange={handleInputChange} />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city">City</Label>
                      <Input id="city" placeholder="Accra" value={newHospital.city} onChange={handleInputChange} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state">State/Region</Label>
                      <Input id="state" placeholder="Greater Accra" value={newHospital.state} onChange={handleInputChange} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="zipCode">Zip Code</Label>
                      <Input id="zipCode" placeholder="00233" value={newHospital.zipCode} onChange={handleInputChange} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input id="phone" placeholder="+233 30 123 4567" value={newHospital.phone} onChange={handleInputChange} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" placeholder="info@hospital.com" value={newHospital.email} onChange={handleInputChange} />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleAddHospital} disabled={!hasPermission('hospital:add')}>Register Hospital</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Edit Hospital Dialog */}
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Edit Hospital</DialogTitle>
                <DialogDescription>
                  Modify the details of the hospital
                </DialogDescription>
              </DialogHeader>
              {selectedHospital && (
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Hospital Name</Label>
                    <Input id="name" placeholder="Central Hospital" value={editHospitalData.name} onChange={handleEditInputChange} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">Address</Label>
                    <Textarea id="address" placeholder="123 Main St" value={editHospitalData.address} onChange={handleEditInputChange} />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city">City</Label>
                      <Input id="city" placeholder="Accra" value={editHospitalData.city} onChange={handleEditInputChange} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state">State/Region</Label>
                      <Input id="state" placeholder="Greater Accra" value={editHospitalData.state} onChange={handleEditInputChange} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="zipCode">Zip Code</Label>
                      <Input id="zipCode" placeholder="00233" value={editHospitalData.zipCode} onChange={handleEditInputChange} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input id="phone" placeholder="+233 30 123 4567" value={editHospitalData.phone} onChange={handleEditInputChange} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" placeholder="info@hospital.com" value={editHospitalData.email} onChange={handleEditInputChange} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select onValueChange={(value) => setEditHospitalData(prev => ({ ...prev, status: value }))} value={editHospitalData.status}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleEditHospital} disabled={!hasPermission('hospital:edit')}>Save Changes</Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Delete Hospital Dialog */}
          <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm Deletion</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete this hospital? This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
                <Button variant="destructive" onClick={handleDeleteHospital} disabled={!hasPermission('hospital:delete')}>Delete</Button>
              </div>
            </DialogContent>
          </Dialog>

          <div className="grid gap-6 md:grid-cols-3">
            {hospitals.map((hospital) => (
              <Card
                key={hospital.id}
                className="cursor-pointer transition-all hover:shadow-lg hover:border-accent"
                onClick={() => setSelectedHospital(hospital)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-accent" />
                      <CardTitle className="text-lg">{hospital.name}</CardTitle>
                    </div>
                    <Badge variant={hospital.status === 'Active' ? 'default' : 'secondary'}>
                      {hospital.status}
                    </Badge>
                  </div>
                  <CardDescription className="flex items-center gap-1 text-xs">
                    <MapPin className="h-3 w-3" />
                    {hospital.address}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span className="text-foreground">{hospital.phone}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="text-foreground">{hospital.email}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-accent">{hospital.departments}</p>
                        <p className="text-xs text-muted-foreground">Departments</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-accent">{hospital.staff}</p>
                        <p className="text-xs text-muted-foreground">Staff</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-accent">{hospital.beds}</p>
                        <p className="text-xs text-muted-foreground">Beds</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
                <div className="flex justify-end p-4 pt-0 gap-2">
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openEditDialog(hospital); }} disabled={!hasPermission('hospital:edit')}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openDeleteDialog(hospital); }} disabled={!hasPermission('hospital:delete')}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          {selectedHospital && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-accent" />
                      {selectedHospital.name} - Departments
                    </CardTitle>
                    <CardDescription>Manage hospital departments and services</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => openEditDialog(selectedHospital)} disabled={!hasPermission('hospital:edit')}>
                    <Edit className="h-4 w-4" />
                    Edit Hospital
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Department</TableHead>
                      <TableHead>Head of Department</TableHead>
                      <TableHead>Staff</TableHead>
                      <TableHead>Beds</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[
                      { name: 'Cardiology', hod: 'Dr. Michael Chen', staff: 15, beds: 30, status: 'Active' },
                      { name: 'Orthopedics', hod: 'Dr. Emily Davis', staff: 12, beds: 25, status: 'Active' },
                      { name: 'Pediatrics', hod: 'Dr. Robert Lee', staff: 18, beds: 35, status: 'Active' },
                      { name: 'Emergency', hod: 'Dr. Sarah Johnson', staff: 20, beds: 40, status: 'Active' },
                    ].map((dept, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{dept.name}</TableCell>
                        <TableCell>{dept.hod}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Users className="h-3 w-3 text-muted-foreground" />
                            {dept.staff}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Bed className="h-3 w-3 text-muted-foreground" />
                            {dept.beds}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="default">{dept.status}</Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm">Manage</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
