import React, { useState, useCallback, useEffect } from 'react';
import { api } from '@/services/api';
import { useAudit } from '@/contexts/AuditContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Plus, Search, Filter, Download, MoreHorizontal } from 'lucide-react';

interface Patient {
  id: string;
  name: string;
  age: number;
  gender: string;
  phone: string;
  email: string;
  status: 'Active' | 'Inactive';
  hospital: string;
}



export default function PatientsPage() {
  const { hasPermission, canActOnHospital, user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const { logAction } = useAudit();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [patientToDelete, setPatientToDelete] = useState<string | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [viewingPatient, setViewingPatient] = useState<Patient | null>(null);
  const [newPatient, setNewPatient] = useState({
    firstName: '',
    lastName: '',
    age: '',
    gender: '',
    phone: '',
    email: '',
    hospitalId: '',
  });
  const [isAddingPatient, setIsAddingPatient] = useState(false);
  const [addPatientError, setAddPatientError] = useState<string | null>(null);
  const [isUpdatingPatient, setIsUpdatingPatient] = useState(false);
  const [updatePatientError, setUpdatePatientError] = useState<string | null>(null);
  const [isDeletingPatient, setIsDeletingPatient] = useState(false);
  const [deletePatientError, setDeletePatientError] = useState<string | null>(null);
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [loadingHospitals, setLoadingHospitals] = useState(true);
  const [hospitalsError, setHospitalsError] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setNewPatient((prev) => ({ ...prev, [id]: value }));
  };

  const handleSelectChange = (id: string, value: string) => {
    setNewPatient((prev) => ({ ...prev, [id]: value }));
  };

  const handleAddPatient = async () => {
    setAddPatientError(null);
    setIsAddingPatient(true);
    try {
      await api.createPatient({
        first_name: newPatient.firstName,
        last_name: newPatient.lastName,
        age: parseInt(newPatient.age, 10),
        gender: newPatient.gender,
        phone: newPatient.phone,
        email: newPatient.email,
        hospital_id: newPatient.hospitalId,
        address: 'N/A', // Or add an address field to the form
      });
      logAction('create', 'patient', { recordId: newPatient.email });
      await loadPatients();
      setIsDialogOpen(false);
      setNewPatient({
        firstName: '',
        lastName: '',
        age: '',
        gender: '',
        phone: '',
        email: '',
        hospitalId: '',
      });
    } catch (error: any) {
      console.error('Failed to create patient:', error);
      setAddPatientError(error.message || 'Failed to create patient');
    } finally {
      setIsAddingPatient(false);
    }
  };

  const loadPatients = useCallback(async () => {
    try {
      setLoading(true);
      if (!hasPermission('patients:view') || !canActOnHospital(user?.hospital_id)) {
        setPatients([]);
        return;
      }
      const data = await api.getPatients({ hospital: user?.hospital_id }) as any[];
      
      // Transform backend data to match frontend interface
      const transformedData = data.map(p => ({
        id: p.patient_id,
        name: `${p.first_name} ${p.last_name}`,
        age: p.age,
        gender: p.gender,
        phone: p.phone,
        email: p.email,
        status: p.status === 'active' ? 'Active' as const : 'Inactive' as const,
        hospital: p.hospital_id || 'N/A',
      }));
      
      setPatients(transformedData);
      logAction('view', 'patients', { recordId: 'all' });
    } catch (error: any) {
      console.error('Failed to load patients:', error);
      alert(`Failed to load patients: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [canActOnHospital, hasPermission, logAction, user?.hospital_id]);

  const loadHospitals = useCallback(async () => {
    try {
      setLoadingHospitals(true);
      const data = await api.getHospitals();
      setHospitals(data);
    } catch (error: any) {
      console.error('Failed to load hospitals:', error);
      setHospitalsError(error.message || 'Failed to load hospitals');
    } finally {
      setLoadingHospitals(false);
    }
  }, []);

  useEffect(() => {
    loadPatients();
    loadHospitals();
  }, [loadPatients, loadHospitals]);

  const handleViewPatient = (patient: Patient) => {
    setViewingPatient(patient);
    setIsViewDialogOpen(true);
  };

  const handleEditPatient = (patient: Patient) => {
    setEditingPatient(patient);
    setIsEditDialogOpen(true);
  };

  const handleDeletePatient = (patientId: string, hospital: string) => {
    setPatientToDelete(patientId);
    // Store hospital for the permission check
    // This is a bit of a workaround, ideally the patient object would be passed
    (window as any).patientToDeleteHospital = hospital;
    setIsDeleteDialogOpen(true);
  };

  const handleUpdatePatient = async () => {
    if (!editingPatient) return;
    setUpdatePatientError(null);
    setIsUpdatingPatient(true);
    try {
      await api.updatePatient(editingPatient.id, {
        first_name: editingPatient.name.split(' ')[0],
        last_name: editingPatient.name.split(' ').slice(1).join(' '),
        age: editingPatient.age,
        gender: editingPatient.gender,
        phone: editingPatient.phone,
        email: editingPatient.email,
        hospital_id: editingPatient.hospital,
        status: editingPatient.status === 'Active' ? 'active' : 'inactive',
      });
      logAction('update', 'patient', { recordId: editingPatient.id });
      await loadPatients();
      setIsEditDialogOpen(false);
      setEditingPatient(null);
    } catch (error: any) {
      console.error('Failed to update patient:', error);
      setUpdatePatientError(error.message || 'Failed to update patient');
    } finally {
      setIsUpdatingPatient(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!patientToDelete) return;
    setDeletePatientError(null);
    setIsDeletingPatient(true);
    try {
      await api.deletePatient(patientToDelete);
      logAction('delete', 'patient', { recordId: patientToDelete });
      await loadPatients();
      setIsDeleteDialogOpen(false);
      setPatientToDelete(null);
    } catch (error: any) {
      console.error('Failed to delete patient:', error);
      setDeletePatientError(error.message || 'Failed to delete patient');
    } finally {
      setIsDeletingPatient(false);
    }
  };

  const filteredPatients = patients.filter(patient =>
    patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Patient Management</h1>
          <p className="text-muted-foreground">Manage and track patient records</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" disabled={!hasPermission('patients:add') || !newPatient.hospitalId}>
              <Plus className="h-4 w-4" />
              Add Patient
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Register New Patient</DialogTitle>
              <DialogDescription>
                Enter patient information to create a new record
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input id="firstName" placeholder="John" value={newPatient.firstName} onChange={handleInputChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input id="lastName" placeholder="Doe" value={newPatient.lastName} onChange={handleInputChange} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="age">Age</Label>
                  <Input id="age" type="number" placeholder="30" value={newPatient.age} onChange={handleInputChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gender">Gender</Label>
                  <Select onValueChange={(value) => handleSelectChange('gender', value)} value={newPatient.gender}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input id="phone" placeholder="+233 24 123 4567" value={newPatient.phone} onChange={handleInputChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="patient@email.com" value={newPatient.email} onChange={handleInputChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hospitalId">Hospital</Label>
                <Select onValueChange={(value) => handleSelectChange('hospitalId', value)} value={newPatient.hospitalId} disabled={loadingHospitals}>
                  <SelectTrigger>
                    <SelectValue placeholder={loadingHospitals ? 'Loading hospitals...' : 'Select hospital'} />
                  </SelectTrigger>
                  <SelectContent>
                    {hospitalsError && <SelectItem value="error" disabled>{hospitalsError}</SelectItem>}
                    {hospitals.map((hospital) => (
                      <SelectItem key={hospital.hospital_id} value={hospital.hospital_id}>
                        {hospital.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleAddPatient} disabled={isAddingPatient || !hasPermission('patients:add') || !canActOnHospital(newPatient.hospitalId)}>
                {isAddingPatient ? 'Registering...' : 'Register Patient'}
              </Button>
            </div>
            {addPatientError && <p className="text-destructive text-sm mt-2">Error: {addPatientError}</p>}
          </DialogContent>
        </Dialog>

        {/* Edit Patient Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Patient</DialogTitle>
              <DialogDescription>
                Update patient information
              </DialogDescription>
            </DialogHeader>
            {editingPatient && (
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="editFirstName">First Name</Label>
                    <Input
                      id="editFirstName"
                      value={editingPatient.name.split(' ')[0]}
                      onChange={(e) =>
                        setEditingPatient({
                          ...editingPatient,
                          name: `${e.target.value} ${editingPatient.name.split(' ').slice(1).join(' ')}`,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editLastName">Last Name</Label>
                    <Input
                      id="editLastName"
                      value={editingPatient.name.split(' ').slice(1).join(' ')}
                      onChange={(e) =>
                        setEditingPatient({
                          ...editingPatient,
                          name: `${editingPatient.name.split(' ')[0]} ${e.target.value}`,
                        })
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="editAge">Age</Label>
                    <Input
                      id="editAge"
                      type="number"
                      value={editingPatient.age}
                      onChange={(e) =>
                        setEditingPatient({ ...editingPatient, age: parseInt(e.target.value, 10) || 0 })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editGender">Gender</Label>
                    <Select
                      value={editingPatient.gender}
                      onValueChange={(value) =>
                        setEditingPatient({ ...editingPatient, gender: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editPhone">Phone Number</Label>
                  <Input
                    id="editPhone"
                    value={editingPatient.phone}
                    onChange={(e) =>
                      setEditingPatient({ ...editingPatient, phone: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editEmail">Email</Label>
                  <Input
                    id="editEmail"
                    type="email"
                    value={editingPatient.email}
                    onChange={(e) =>
                      setEditingPatient({ ...editingPatient, email: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editHospital">Hospital</Label>
                  <Select
                    value={editingPatient.hospital}
                    onValueChange={(value) =>
                      setEditingPatient({ ...editingPatient, hospital: value })
                    }
                    disabled={loadingHospitals}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={loadingHospitals ? 'Loading hospitals...' : 'Select hospital'} />
                    </SelectTrigger>
                    <SelectContent>
                      {hospitalsError && <SelectItem value="error" disabled>{hospitalsError}</SelectItem>}
                      {hospitals.map((hospital) => (
                        <SelectItem key={hospital.hospital_id} value={hospital.hospital_id}>
                          {hospital.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editStatus">Status</Label>
                  <Select
                    value={editingPatient.status}
                    onValueChange={(value: 'Active' | 'Inactive') =>
                      setEditingPatient({ ...editingPatient, status: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleUpdatePatient} disabled={isUpdatingPatient || !hasPermission('patients:edit') || !canActOnHospital(editingPatient?.hospital)}>
                {isUpdatingPatient ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
            {updatePatientError && <p className="text-destructive text-sm mt-2">Error: {updatePatientError}</p>}
          </DialogContent>
        </Dialog>

        {/* Delete Patient Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Are you absolutely sure?</DialogTitle>
              <DialogDescription>
                This action cannot be undone. This will permanently delete the patient record
                and remove their data from our servers.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleConfirmDelete} disabled={isDeletingPatient || !hasPermission('patients:delete') || !canActOnHospital((window as any).patientToDeleteHospital)}>
                {isDeletingPatient ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
            {deletePatientError && <p className="text-destructive text-sm mt-2">Error: {deletePatientError}</p>}
          </DialogContent>
        </Dialog>

        {/* View Patient Dialog */}
        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Patient Details</DialogTitle>
            </DialogHeader>
            {viewingPatient && (
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Name</Label><p>{viewingPatient.name}</p></div>
                  <div><Label>Age</Label><p>{viewingPatient.age}</p></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Gender</Label><p>{viewingPatient.gender}</p></div>
                  <div><Label>Phone</Label><p>{viewingPatient.phone}</p></div>
                </div>
                <div><Label>Email</Label><p>{viewingPatient.email}</p></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Status</Label><p>{viewingPatient.status}</p></div>
                </div>
                <div><Label>Hospital</Label><p>{viewingPatient.hospital}</p></div>
              </div>
            )}
            <div className="flex justify-end">
              <Button onClick={() => setIsViewDialogOpen(false)}>Close</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Patient Records</CardTitle>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search patients..."
                  className="pl-9 w-64"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Button variant="outline" size="icon">
                <Filter className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon">
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {(!hasPermission('patients:view') || !canActOnHospital(user?.hospital_id)) ? (
            <div className="text-center py-12">
              <p className="text-destructive">Unauthorized to view patients for this hospital.</p>
            </div>
          ) : loading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Loading patients...</p>
            </div>
          ) : patients.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No patients found.</p>
            </div>
          ) : (
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Age</TableHead>
                <TableHead>Gender</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Hospital</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredPatients.length > 0 ? (
                filteredPatients.map((patient) => (
                  <TableRow key={patient.id}>
                    <TableCell className="font-medium">{patient.id}</TableCell>
                    <TableCell>{patient.name}</TableCell>
                    <TableCell>{patient.age}</TableCell>
                    <TableCell>{patient.gender}</TableCell>
                    <TableCell>{patient.phone}</TableCell>
                    <TableCell>{patient.hospital}</TableCell>
                    <TableCell>
                      <Badge variant={patient.status === 'Active' ? 'default' : 'secondary'}>
                        {patient.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => handleViewPatient(patient)}>
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleEditPatient(patient)}
                            disabled={!hasPermission('patients:edit')}
                          >
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDeletePatient(patient.id, patient.hospital)}
                            disabled={!hasPermission('patients:delete')}
                            className="text-destructive"
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
                    No patients found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
