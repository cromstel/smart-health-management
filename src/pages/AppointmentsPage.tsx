import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '@/services/api';
import { Skeleton } from '@/components/ui/skeleton';
import { useAudit } from '@/contexts/AuditContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Clock, User, MapPin, Edit, Trash2, Search, Bell, Filter, X, Calendar as CalendarIcon } from 'lucide-react';
import { useNotifications } from '@/contexts/NotificationContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { generateIcsFile, downloadIcsFile } from '@/utils/appointments';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';

interface Appointment {
  id: string;
  appointment_id: string;
  patient_id: string;
  doctor_id: string;
  department_id: string;
  appointment_date: string;
  appointment_time: string;
  type: string;
  notes: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  patient_first_name: string;
  patient_last_name: string;
  doctor_first_name: string;
  doctor_last_name: string;
  department_name: string;
}

interface DisplayAppointment {
  id: string;
  appointmentId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  time: string;
  date: string;
  department: string;
  status: 'Scheduled' | 'Completed' | 'Cancelled';
  type: string;
  notes: string;
}

interface Patient {
  id: string;
  name: string;
  patient_id: string;
}

interface Doctor {
  id: string;
  name: string;
  departmentId: string;
}

const mockAppointments: DisplayAppointment[] = [
  {
    id: 'uuid1',
    appointmentId: 'A001',
    patientName: 'Sarah Johnson',
    doctorId: 'doc1',
    doctorName: 'Dr. Michael Chen',
    time: '09:00 AM',
    date: '2024-01-20',
    department: 'Cardiology',
    status: 'Scheduled',
    type: 'Consultation',
    notes: 'Initial consultation',
  },
  {
    id: 'uuid2',
    appointmentId: 'A002',
    patientName: 'James Wilson',
    doctorId: 'doc2',
    doctorName: 'Dr. Emily Davis',
    time: '10:30 AM',
    date: '2024-01-20',
    department: 'Orthopedics',
    status: 'Scheduled',
    type: 'Follow-up',
    notes: 'Follow-up on knee injury',
  },
  {
    id: 'uuid3',
    appointmentId: 'A003',
    patientName: 'Maria Garcia',
    doctorId: 'doc3',
    doctorName: 'Dr. Robert Lee',
    time: '02:00 PM',
    date: '2024-01-20',
    department: 'Pediatrics',
    status: 'Completed',
    type: 'Check-up',
    notes: 'Annual check-up',
  },
];

export default function AppointmentsPage() {
  const { hasPermission, canActOnHospital, user } = useAuth();
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [dateFilter, setDateFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [doctorFilter, setDoctorFilter] = useState<string>('all');
  const [appointments, setAppointments] = useState<DisplayAppointment[]>([]);

  const handleCalendarSelect = useCallback((selectedDate: Date | undefined) => {
    setDate(selectedDate);
    if (selectedDate) {
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      setDateFilter(`${year}-${month}-${day}`);
    } else {
      setDateFilter('');
    }
  }, []);

  const handleResetFilters = useCallback(() => {
    setSearchTerm('');
    setDateFilter('');
    setStatusFilter('all');
    setDoctorFilter('all');
    setDate(undefined);
  }, []);

  useEffect(() => {
    const urlSearch = searchParams.get('search');
    if (urlSearch !== null && urlSearch !== searchTerm) {
      setSearchTerm(urlSearch);
    }
  }, [searchParams, searchTerm]);

  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const { logAction } = useAudit();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<DisplayAppointment | null>(null);
  const [newAppointment, setNewAppointment] = useState({
    patientId: '',
    doctorId: '',
    departmentId: '',
    appointmentDate: '',
    appointmentTime: '',
    type: '',
    notes: '',
  });
  const [editAppointmentData, setEditAppointmentData] = useState({
    id: '',
    patientId: '',
    doctorId: '',
    departmentId: '',
    appointmentDate: '',
    appointmentTime: '',
    type: '',
    notes: '',
    status: '',
  });

  const loadAppointments = useCallback(async () => {
    try {
      const data = await api.getAppointments({ hospital: user?.hospital_id }) as Appointment[];
      const transformedData: DisplayAppointment[] = data.map((a: Appointment) => ({
        id: a.id,
        appointmentId: a.appointment_id,
        patientName: `${a.patient_first_name} ${a.patient_last_name}`,
        doctorId: a.doctor_id,
        doctorName: `${a.doctor_first_name} ${a.doctor_last_name}`,
        time: a.appointment_time,
        date: a.appointment_date,
        department: a.department_name,
        status: (a.status.charAt(0).toUpperCase() + a.status.slice(1)) as 'Scheduled' | 'Completed' | 'Cancelled',
        type: a.type,
        notes: a.notes,
      }));
      setAppointments(transformedData);
      logAction('view', 'appointments', { recordId: 'all' });
    } catch (error: any) {
      console.error('Failed to load appointments:', error);
      toast.error(`Failed to load appointments: ${error.message}`);
      setAppointments(mockAppointments);
    }
  }, [logAction, user?.hospital_id]);

  const loadPatients = useCallback(async () => {
    try {
      const data = await api.getPatients() as any[];
      const transformedData = data.map((p) => ({
        id: p.id,
        name: `${p.first_name} ${p.last_name} (${p.patient_id})`,
        patient_id: p.patient_id,
      }));
      setPatients(transformedData);
    } catch (error) {
      console.error('Failed to load patients:', error);
      toast.error('Failed to load patients.');
    }
  }, []);

  const loadDoctors = useCallback(async () => {
    try {
      const data = await api.getStaff() as any[];
      const transformedData = data
        .filter((s) => s.role_name === 'Doctor')
        .map((s) => ({
          id: s.id,
          name: `Dr. ${s.first_name} ${s.last_name} - ${s.department_name}`,
          departmentId: s.department_id,
        }));
      setDoctors(transformedData);
    } catch (error) {
      console.error('Failed to load doctors:', error);
      toast.error('Failed to load doctors.');
    }
  }, []);

  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      if (!hasPermission('appointments:view') || !canActOnHospital(user?.hospital_id)) {
        setAppointments([]);
        return;
      }
      await Promise.all([loadAppointments(), loadPatients(), loadDoctors()]);
    } catch (error) {
      console.error('Failed to load initial data:', error);
    } finally {
      setLoading(false);
    }
  }, [loadAppointments, loadPatients, loadDoctors, hasPermission, canActOnHospital, user?.hospital_id]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setNewAppointment((prev) => ({ ...prev, [id]: value }));
  };

  const handleEditInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setEditAppointmentData((prev) => ({ ...prev, [id]: value }));
  };

  const handleSelectChange = (id: string, value: string) => {
    if (id === 'doctorId') {
      const selectedDoctor = doctors.find((d) => d.id === value);
      setNewAppointment((prev) => ({
        ...prev,
        [id]: value,
        departmentId: selectedDoctor?.departmentId || '',
      }));
    } else {
      setNewAppointment((prev) => ({ ...prev, [id]: value }));
    }
  };

  const handleAddAppointment = async () => {
    try {
      if (!hasPermission('appointments:add') || !canActOnHospital(user?.hospital_id)) {
        toast.error('Unauthorized to create appointment for this hospital.');
        return;
      }
      await api.createAppointment({ ...newAppointment, hospitalId: user?.hospital_id });
      logAction('create', 'appointment', { recordId: newAppointment.patientId });
      toast.success('Appointment created successfully!');
      await loadAppointments();
      setIsAddDialogOpen(false);
      setNewAppointment({
        patientId: '',
        doctorId: '',
        departmentId: '',
        appointmentDate: '',
        appointmentTime: '',
        type: '',
        notes: '',
      });
    } catch (error: any) {
      console.error('Failed to create appointment:', error);
      toast.error(`Failed to create appointment: ${error.message}`);
    }
  };

  const handleEditAppointment = async () => {
    try {
      if (!selectedAppointment) return;
      if (!hasPermission('appointments:edit') || !canActOnHospital(user?.hospital_id)) {
        toast.error('Unauthorized to edit appointment for this hospital.');
        return;
      }
      await api.updateAppointment(selectedAppointment.id, editAppointmentData);
      logAction('update', 'appointment', { recordId: selectedAppointment.id });
      toast.success('Appointment updated successfully!');
      await loadAppointments();
      setIsEditDialogOpen(false);
      setSelectedAppointment(null);
    } catch (error: any) {
      console.error('Failed to update appointment:', error);
      toast.error(`Failed to update appointment: ${error.message}`);
    }
  };

  const handleDeleteAppointment = async () => {
    try {
      if (!selectedAppointment) return;
      if (!hasPermission('appointments:delete') || !canActOnHospital(user?.hospital_id)) {
        toast.error('Unauthorized to delete appointment for this hospital.');
        return;
      }
      await api.deleteAppointment(selectedAppointment.id);
      logAction('delete', 'appointment', { recordId: selectedAppointment.id });
      toast.success('Appointment deleted successfully!');
      await loadAppointments();
      setIsDeleteDialogOpen(false);
      setSelectedAppointment(null);
    } catch (error: any) {
      console.error('Failed to delete appointment:', error);
      toast.error(`Failed to delete appointment: ${error.message}`);
    }
  };

  const openEditDialog = (appointment: DisplayAppointment) => {
    setSelectedAppointment(appointment);
    setEditAppointmentData({
      id: appointment.id,
      patientId: patients.find((p) => p.name === appointment.patientName)?.id || '',
      doctorId: appointment.doctorId,
      departmentId: doctors.find((d) => d.id === appointment.doctorId)?.departmentId || '',
      appointmentDate: appointment.date,
      appointmentTime: appointment.time,
      type: appointment.type.toLowerCase(),
      notes: appointment.notes,
      status: appointment.status.toLowerCase(),
    });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (appointment: DisplayAppointment) => {
    setSelectedAppointment(appointment);
    setIsDeleteDialogOpen(true);
  };

  const { alertStaffForUpcomingAppointments } = useNotifications();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Appointments</h1>
          <p className="text-muted-foreground">Schedule and manage patient appointments</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => alertStaffForUpcomingAppointments()}
            title="Send real-time alerts to medical staff about upcoming appointments"
          >
            <Bell className="h-4 w-4 text-amber-500" aria-hidden="true" />
            <span>Notify Staff of Upcoming</span>
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" disabled={!hasPermission('appointments:add') || !canActOnHospital(user?.hospital_id)}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                New Appointment
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Schedule Appointment</DialogTitle>
                <DialogDescription>
                  Book a new appointment for a patient
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="patientId">Patient</Label>
                  <Select onValueChange={(value) => handleSelectChange('patientId', value)} value={newAppointment.patientId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select patient" />
                    </SelectTrigger>
                    <SelectContent>
                      {patients.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="doctorId">Doctor</Label>
                  <Select onValueChange={(value) => handleSelectChange('doctorId', value)} value={newAppointment.doctorId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select doctor" />
                    </SelectTrigger>
                    <SelectContent>
                      {doctors.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="appointmentDate">Date</Label>
                    <Input id="appointmentDate" type="date" value={newAppointment.appointmentDate} onChange={handleInputChange} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="appointmentTime">Time</Label>
                    <Input id="appointmentTime" type="time" value={newAppointment.appointmentTime} onChange={handleInputChange} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Appointment Type</Label>
                  <Select onValueChange={(value) => handleSelectChange('type', value)} value={newAppointment.type}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="consultation">Consultation</SelectItem>
                      <SelectItem value="followup">Follow-up</SelectItem>
                      <SelectItem value="checkup">Check-up</SelectItem>
                      <SelectItem value="emergency">Emergency</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea id="notes" value={newAppointment.notes} onChange={handleInputChange} placeholder="Any additional notes" />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleAddAppointment} disabled={!hasPermission('appointments:add') || !canActOnHospital(user?.hospital_id)}>Schedule Appointment</Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Edit Appointment Dialog */}
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Edit Appointment</DialogTitle>
                <DialogDescription>
                  Modify the details of the appointment
                </DialogDescription>
              </DialogHeader>
              {selectedAppointment && (
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="patientId">Patient</Label>
                    <Select onValueChange={(value) => setEditAppointmentData((prev) => ({ ...prev, patientId: value }))} value={editAppointmentData.patientId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select patient" />
                      </SelectTrigger>
                      <SelectContent>
                        {patients.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="doctorId">Doctor</Label>
                    <Select onValueChange={(value) => {
                      const selectedDoctor = doctors.find((d) => d.id === value);
                      setEditAppointmentData((prev) => ({
                        ...prev,
                        doctorId: value,
                        departmentId: selectedDoctor?.departmentId || '',
                      }));
                    }} value={editAppointmentData.doctorId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select doctor" />
                      </SelectTrigger>
                      <SelectContent>
                        {doctors.map((d) => (
                          <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="appointmentDate">Date</Label>
                      <Input id="appointmentDate" type="date" value={editAppointmentData.appointmentDate} onChange={handleEditInputChange} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="appointmentTime">Time</Label>
                      <Input id="appointmentTime" type="time" value={editAppointmentData.appointmentTime} onChange={handleEditInputChange} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="type">Appointment Type</Label>
                    <Select onValueChange={(value) => setEditAppointmentData((prev) => ({ ...prev, type: value }))} value={editAppointmentData.type}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="consultation">Consultation</SelectItem>
                        <SelectItem value="followup">Follow-up</SelectItem>
                        <SelectItem value="checkup">Check-up</SelectItem>
                        <SelectItem value="emergency">Emergency</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select onValueChange={(value) => setEditAppointmentData((prev) => ({ ...prev, status: value }))} value={editAppointmentData.status}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea id="notes" value={editAppointmentData.notes} onChange={handleEditInputChange} placeholder="Any additional notes" />
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleEditAppointment} disabled={!hasPermission('appointments:edit') || !canActOnHospital(user?.hospital_id)}>Save Changes</Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Delete Appointment Dialog */}
          <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm Deletion</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete this appointment? This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
                <Button variant="destructive" onClick={handleDeleteAppointment} disabled={!hasPermission('appointments:delete') || !canActOnHospital(user?.hospital_id)}>Delete</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <ErrorBoundary fallbackTitle="Error loading Appointments">
        {(() => {
          const filteredAppointments = appointments.filter((a) => {
            if (statusFilter !== 'all' && a.status.toLowerCase() !== statusFilter.toLowerCase()) {
              return false;
            }
            if (doctorFilter !== 'all' && a.doctorId !== doctorFilter && a.doctorName.toLowerCase() !== doctorFilter.toLowerCase()) {
              return false;
            }
            if (dateFilter && a.date !== dateFilter) {
              return false;
            }
            if (searchTerm.trim()) {
              const term = searchTerm.toLowerCase();
              const matches =
                a.patientName.toLowerCase().includes(term) ||
                a.doctorName.toLowerCase().includes(term) ||
                a.department.toLowerCase().includes(term) ||
                a.type.toLowerCase().includes(term) ||
                a.appointmentId.toLowerCase().includes(term) ||
                (a.notes && a.notes.toLowerCase().includes(term));
              if (!matches) return false;
            }
            return true;
          });

          const hasActiveFilters = Boolean(searchTerm || dateFilter || statusFilter !== 'all' || doctorFilter !== 'all');

          return (
            <div className="grid gap-6 md:grid-cols-3">
              <Card className="md:col-span-2">
                <CardHeader className="space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-2">
                      <CardTitle>Appointments</CardTitle>
                      <Badge variant="secondary" className="font-mono text-xs">
                        {filteredAppointments.length} / {appointments.length}
                      </Badge>
                    </div>
                    <div className="relative flex-1 max-w-xs min-w-[200px]">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                      <Input
                        placeholder="Search patient, dept, notes..."
                        className="pl-9 pr-8 h-9 text-xs"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                      {searchTerm && (
                        <button
                          type="button"
                          onClick={() => setSearchTerm('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          aria-label="Clear search"
                        >
                          <X className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Filter Controls Bar: Date, Status, Doctor */}
                  <div className="p-3 rounded-lg bg-muted/40 border border-border flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                      <Filter className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                      <span>Filter By:</span>
                    </div>

                    {/* Date Filter */}
                    <div className="flex items-center gap-1.5">
                      <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                      <Input
                        type="date"
                        value={dateFilter}
                        onChange={(e) => {
                          setDateFilter(e.target.value);
                          if (e.target.value) {
                            const [y, m, d] = e.target.value.split('-').map(Number);
                            setDate(new Date(y, m - 1, d));
                          } else {
                            setDate(undefined);
                          }
                        }}
                        className="h-8 text-xs w-36 bg-background border-border"
                        title="Filter by exact appointment date"
                      />
                    </div>

                    {/* Status Filter */}
                    <div className="w-36">
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="h-8 text-xs bg-background border-border">
                          <SelectValue placeholder="All Statuses" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Statuses</SelectItem>
                          <SelectItem value="scheduled">Scheduled</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Doctor Filter */}
                    <div className="w-44">
                      <Select value={doctorFilter} onValueChange={setDoctorFilter}>
                        <SelectTrigger className="h-8 text-xs bg-background border-border">
                          <SelectValue placeholder="All Doctors" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Doctors</SelectItem>
                          {doctors.map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Clear Filters Button */}
                    {hasActiveFilters && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleResetFilters}
                        className="h-8 text-xs px-2 text-destructive hover:text-destructive hover:bg-destructive/10 ml-auto"
                      >
                        <X className="h-3.5 w-3.5 mr-1" aria-hidden="true" /> Clear Filters
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {(!hasPermission('appointments:view') || !canActOnHospital(user?.hospital_id)) ? (
                    <div className="text-center py-12">
                      <p className="text-destructive">Unauthorized to view appointments for this hospital.</p>
                    </div>
                  ) : loading ? (
                    <div className="space-y-3 py-2" role="status" aria-label="Loading appointments">
                      <span className="sr-only">Loading appointments...</span>
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : filteredAppointments.length === 0 ? (
                    <div className="text-center py-12 space-y-3">
                      <p className="text-muted-foreground">No appointments found matching your active filter criteria.</p>
                      {hasActiveFilters && (
                        <Button variant="outline" size="sm" onClick={handleResetFilters}>
                          Reset Filters
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredAppointments.map((appointment) => (
                        <div
                          key={appointment.id}
                          className="flex items-center justify-between rounded-lg border border-border p-4 hover:bg-muted/50 transition-colors flex-wrap gap-3"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                              <span className="font-medium text-foreground">{appointment.patientName}</span>
                              <Badge variant="outline" className="text-xs">
                                {appointment.type}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                              <span className="flex items-center gap-1 font-mono">
                                <CalendarIcon className="h-3 w-3" aria-hidden="true" />
                                {appointment.date}
                              </span>
                              <span className="flex items-center gap-1 font-mono">
                                <Clock className="h-3 w-3" aria-hidden="true" />
                                {appointment.time}
                              </span>
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" aria-hidden="true" />
                                {appointment.department}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              with <span className="font-medium text-foreground">{appointment.doctorName}</span>
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={
                                appointment.status === 'Scheduled'
                                  ? 'default'
                                  : appointment.status === 'Completed'
                                  ? 'secondary'
                                  : 'destructive'
                              }
                            >
                              {appointment.status}
                            </Badge>
                            <Button variant="ghost" size="sm" onClick={() => openEditDialog(appointment)} disabled={!hasPermission('appointments:edit')}>
                              <Edit className="h-4 w-4" aria-hidden="true" />
                              <span className="sr-only">Edit appointment</span>
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => openDeleteDialog(appointment)} disabled={!hasPermission('appointments:delete')}>
                              <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
                              <span className="sr-only">Delete appointment</span>
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => {
                              const icsContent = generateIcsFile(appointment);
                              downloadIcsFile(appointment.patientName, icsContent);
                            }}>
                              Export to Calendar
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Calendar</CardTitle>
                    {dateFilter && (
                      <Badge variant="outline" className="text-[10px] text-primary border-primary/30">
                        Filtered: {dateFilter}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={handleCalendarSelect}
                    className="rounded-md border border-border"
                  />
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Total Appointments</span>
                      <span className="font-medium text-foreground">{appointments.length}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Completed</span>
                      <span className="font-medium text-emerald-600 dark:text-emerald-400">
                        {appointments.filter((a) => a.status === 'Completed').length}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Scheduled</span>
                      <span className="font-medium text-primary">
                        {appointments.filter((a) => a.status === 'Scheduled').length}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Cancelled</span>
                      <span className="font-medium text-destructive">
                        {appointments.filter((a) => a.status === 'Cancelled').length}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          );
        })()}
      </ErrorBoundary>
    </div>
  );
}