import React, { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import { Plus, Search, Filter, Download, MoreHorizontal, Heart, Users, Printer, PhoneCall, X } from 'lucide-react';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { exportToCSV } from '@/utils/csv';
import PatientVitalsModule from '@/components/vitals/PatientVitalsModule';
import { PostDischargeFollowupModule } from '@/components/patients/PostDischargeFollowupModule';
import { vitalsService } from '@/services/vitalsService';
import { evaluateTriagePriority } from '@/utils/triage';
import type { VitalsRecord } from '@/types/vitals';
import { useFormAutoSave } from '@/hooks/useFormAutoSave';
import { AutoSaveDraftBanner } from '@/components/common/AutoSaveDraftBanner';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';

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
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'directory' | 'vitals' | 'followup'>(
    searchParams.get('tab') === 'vitals' ? 'vitals' : searchParams.get('tab') === 'followup' ? 'followup' : 'directory'
  );
  const [selectedPatientForVitals, setSelectedPatientForVitals] = useState<string | undefined>(
    searchParams.get('patientId') || undefined
  );
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [vitalsMap, setVitalsMap] = useState<{[patientId: string]: VitalsRecord[]}>({});
  const [appointmentsCountMap, setAppointmentsCountMap] = useState<{[patientId: string]: number}>({});

  useEffect(() => {
    const urlTab = searchParams.get('tab');
    if (urlTab === 'vitals' && activeTab !== 'vitals') {
      setActiveTab('vitals');
    } else if (urlTab === 'followup' && activeTab !== 'followup') {
      setActiveTab('followup');
    }
    const urlPatient = searchParams.get('patientId');
    if (urlPatient && urlPatient !== selectedPatientForVitals) {
      setSelectedPatientForVitals(urlPatient);
    }
  }, [searchParams, activeTab, selectedPatientForVitals]);

  useEffect(() => {
    const urlSearch = searchParams.get('search');
    if (urlSearch !== null && urlSearch !== searchTerm) {
      setSearchTerm(urlSearch);
    }
  }, [searchParams, searchTerm]);
  const [loading, setLoading] = useState(true);
  const { logAction } = useAudit();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [patientToDelete, setPatientToDelete] = useState<string | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [viewingPatient, setViewingPatient] = useState<Patient | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');

  useEffect(() => {
    if (viewingPatient) {
      const url = `${window.location.origin}/patients?tab=vitals&patientId=${viewingPatient.id}`;
      QRCode.toDataURL(url, {
        width: 200,
        margin: 1,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      })
        .then(setQrCodeUrl)
        .catch((err) => {
          console.error('Failed to generate QR code:', err);
        });
    } else {
      setQrCodeUrl('');
    }
  }, [viewingPatient]);
  const initialNewPatient = {
    firstName: '',
    lastName: '',
    age: '',
    gender: '',
    phone: '',
    email: '',
    hospitalId: '',
  };
  const [newPatient, setNewPatient] = useState(initialNewPatient);

  const {
    hasRestoredDraft: hasPatientDraft,
    draftSavedAt: patientDraftSavedAt,
    isAutoSaving: isPatientAutoSaving,
    clearDraft: clearPatientDraft,
    discardDraft: discardPatientDraft,
  } = useFormAutoSave('add_patient_modal', newPatient, isDialogOpen, (restored) => {
    if (restored) setNewPatient(restored);
  });

  const handleDiscardPatientDraft = () => {
    discardPatientDraft();
    setNewPatient(initialNewPatient);
  };
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
      clearPatientDraft();
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

      // Load all vitals and map them
      try {
        const allVitals = await vitalsService.getAllVitals();
        const vMap: {[patientId: string]: VitalsRecord[]} = {};
        allVitals.forEach(v => {
          const pid = v.patientId.toLowerCase();
          if (!vMap[pid]) vMap[pid] = [];
          vMap[pid].push(v);
        });
        setVitalsMap(vMap);
      } catch (err) {
        console.warn('Failed to load all vitals for triage mapping', err);
      }

      // Load all appointments and count them
      try {
        const appts = await api.getAppointments() as any[];
        const aCountMap: {[patientId: string]: number} = {};
        if (Array.isArray(appts)) {
          appts.forEach(a => {
            const pid = (a.patient_id || a.patientId || '').toLowerCase();
            if (pid) {
              aCountMap[pid] = (aCountMap[pid] || 0) + 1;
            }
          });
        }
        setAppointmentsCountMap(aCountMap);
      } catch (err) {
        console.warn('Failed to load appointments for triage mapping', err);
      }

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

  const handleExportCSV = () => {
    try {
      const recordsToExport = filteredPatients.length > 0 ? filteredPatients : patients;
      if (recordsToExport.length === 0) {
        toast.error('No patient records available to export.');
        return;
      }
      const dateStr = new Date().toISOString().split('T')[0];
      exportToCSV(
        `patients_export_${dateStr}`,
        recordsToExport,
        [
          { key: 'id', label: 'Patient ID' },
          { key: 'name', label: 'Full Name' },
          { key: 'age', label: 'Age' },
          { key: 'gender', label: 'Gender' },
          { key: 'phone', label: 'Phone Number' },
          { key: 'email', label: 'Email' },
          { key: 'hospital', label: 'Hospital' },
          { key: 'status', label: 'Status' },
        ]
      );
      toast.success(`Successfully exported ${recordsToExport.length} patient records to CSV`);
    } catch (err: any) {
      toast.error(`Export failed: ${err.message || 'Unknown error'}`);
    }
  };

  const filteredPatients = patients.filter(patient =>
    patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Patient Management</h1>
          <p className="text-muted-foreground">Manage records, monitor vital signs, and track biometric trends</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Tab Selection Buttons */}
          <div className="flex items-center bg-muted/60 p-1 rounded-lg border border-border">
            <button
              type="button"
              onClick={() => {
                setActiveTab('directory');
                setSearchParams({});
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                activeTab === 'directory'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span>Directory</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('vitals');
                setSearchParams({ tab: 'vitals' });
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                activeTab === 'vitals'
                  ? 'bg-card text-rose-500 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Heart className="h-3.5 w-3.5" />
              <span>Vitals & Charts</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('followup');
                setSearchParams({ tab: 'followup' });
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                activeTab === 'followup'
                  ? 'bg-card text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <PhoneCall className="h-3.5 w-3.5 text-emerald-500" />
              <span>Post-Discharge Outreach</span>
            </button>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" size="sm" disabled={!hasPermission('patients:add') || !newPatient.hospitalId}>
                <Plus className="h-4 w-4" />
                <span>Add Patient</span>
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Register New Patient</DialogTitle>
              <DialogDescription>
                Enter patient information to create a new record
              </DialogDescription>
            </DialogHeader>
            <AutoSaveDraftBanner
              hasRestoredDraft={hasPatientDraft}
              draftSavedAt={patientDraftSavedAt}
              isAutoSaving={isPatientAutoSaving}
              onDiscard={handleDiscardPatientDraft}
            />
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-4">
                <div className="md:col-span-2 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground text-xs">Name</Label>
                      <p className="font-semibold text-foreground text-sm">{viewingPatient.name}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Age</Label>
                      <p className="font-semibold text-foreground text-sm">{viewingPatient.age}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground text-xs">Gender</Label>
                      <p className="font-semibold text-foreground text-sm">{viewingPatient.gender}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Phone</Label>
                      <p className="font-semibold text-foreground text-sm">{viewingPatient.phone}</p>
                    </div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Email</Label>
                    <p className="font-semibold text-foreground text-sm">{viewingPatient.email}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground text-xs">Status</Label>
                      <div>
                        <Badge className={`mt-1 ${viewingPatient.status === 'Active' ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-slate-500 hover:bg-slate-600 text-white'}`} variant="default">
                          {viewingPatient.status}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Hospital</Label>
                      <p className="font-semibold text-foreground text-sm">{viewingPatient.hospital}</p>
                    </div>
                  </div>
                </div>

                {/* QR Code Section */}
                <div className="flex flex-col items-center justify-center p-4 border rounded-xl bg-slate-50/50 dark:bg-slate-900/50 text-center">
                  <Label className="mb-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">Patient File QR Code</Label>
                  {qrCodeUrl ? (
                    <div className="bg-white p-1.5 rounded-lg border shadow-sm">
                      <img src={qrCodeUrl} alt="Patient QR Code" className="w-36 h-36 object-contain" />
                    </div>
                  ) : (
                    <div className="w-36 h-36 flex items-center justify-center border border-dashed rounded-lg text-xs text-muted-foreground">
                      Generating QR...
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-2 max-w-[160px]">
                    Scan with tablet or mobile to instantly pull up this patient's digital file.
                  </p>
                  <div className="flex gap-1.5 mt-3 w-full max-w-[180px]">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1 text-xs py-1 px-2 h-8 gap-1 border-border"
                      onClick={() => {
                        const link = document.createElement('a');
                        link.href = qrCodeUrl;
                        link.download = `patient-${viewingPatient.id}-qr.png`;
                        link.click();
                      }}
                      disabled={!qrCodeUrl}
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Save</span>
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1 text-xs py-1 px-2 h-8 gap-1 border-border"
                      onClick={() => {
                        const win = window.open();
                        if (win) {
                          const escapeHtml = (str: string) =>
                            str.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m] || m));
                          const safeName = escapeHtml(viewingPatient.name || '');
                          const safeId = escapeHtml(viewingPatient.id || '');
                          win.document.write(`
                            <html>
                              <head><title>Print QR Code - ${safeName}</title></head>
                              <body style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;margin:0;">
                                <h2 style="margin-bottom:5px;">${safeName}</h2>
                                <p style="font-size:14px;color:#666;margin:0 0 20px 0;">Patient ID: ${safeId}</p>
                                <img src="${qrCodeUrl}" style="width:250px;height:250px;border:1px solid #ccc;padding:10px;border-radius:10px;" />
                                <p style="font-size:12px;color:#999;margin-top:20px;">Scan to open digital medical record</p>
                                <script>window.onload = function() { window.print(); window.close(); }</script>
                              </body>
                            </html>
                          `);
                          win.document.close();
                        }
                      }}
                      disabled={!qrCodeUrl}
                    >
                      <Printer className="h-3.5 w-3.5" />
                      <span>Print</span>
                    </Button>
                  </div>
                </div>
              </div>
            )}
            <div className="flex justify-end">
              <Button onClick={() => setIsViewDialogOpen(false)}>Close</Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {activeTab === 'vitals' ? (
        <ErrorBoundary fallbackTitle="Error loading Patient Vitals Module">
          <PatientVitalsModule
            patients={patients}
            initialPatientId={selectedPatientForVitals}
          />
        </ErrorBoundary>
      ) : activeTab === 'followup' ? (
        <ErrorBoundary fallbackTitle="Error loading Post-Discharge Followup Module">
          <PostDischargeFollowupModule />
        </ErrorBoundary>
      ) : (
        <ErrorBoundary fallbackTitle="Error loading Patient Records">
          <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Patient Records</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex items-center">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by patient name or ID..."
                    className="pl-9 pr-8 w-64 md:w-80"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-full"
                      title="Clear search"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                {searchTerm && (
                  <Badge variant="secondary" className="text-xs font-normal">
                    {filteredPatients.length} of {patients.length} found
                  </Badge>
                )}
                <Button variant="outline" size="icon" title="Filter list">
                  <Filter className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={handleExportCSV}
                  title="Export patient records to CSV"
                >
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">Export CSV</span>
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
                  <TableHead>Triage Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center">
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
                      {(() => {
                        const patientVitals = vitalsMap[patient.id.toLowerCase()] || [];
                        const apptsCount = appointmentsCountMap[patient.id.toLowerCase()] || 0;
                        const evalResult = evaluateTriagePriority(patientVitals, '', apptsCount);
                        return (
                          <TableCell>
                            <span 
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${evalResult.levelColor} cursor-help`}
                              title={`Triage factors:\n• ${evalResult.factors.join('\n• ')}`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${evalResult.badgeColor}`} />
                              <span>{evalResult.classification} ({evalResult.score})</span>
                            </span>
                          </TableCell>
                        );
                      })()}
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
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedPatientForVitals(patient.id);
                                setActiveTab('vitals');
                                setSearchParams({ tab: 'vitals', patientId: patient.id });
                              }}
                              className="text-rose-600 focus:text-rose-600 font-medium"
                            >
                              <Heart className="mr-2 h-4 w-4 text-rose-500" />
                              Track Vitals
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleViewPatient(patient)}>
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleEditPatient(patient)}
                              disabled={!hasPermission('patients:edit')}
                            >
                              Edit Record
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
      </ErrorBoundary>
      )}
    </div>
  );
}
