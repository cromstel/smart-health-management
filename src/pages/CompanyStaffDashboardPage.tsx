import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Building2,
  ShieldCheck,
  Clock,
  UserCheck,
  AlertTriangle,
  FileSpreadsheet,
  CheckCircle2,
  Search,
  Bell
} from 'lucide-react';
import { api } from '@/services/api';
import { toast } from 'sonner';

interface DepartmentSummary {
  name: string;
  head: string;
  activeStaff: number;
  totalStaff: number;
  occupancyRate: string;
  status: 'Optimal' | 'High Load' | 'Critical';
}

interface StaffRoleSummary {
  role: string;
  count: number;
  onDuty: number;
  permissionsCount: number;
  department: string;
}

export function CompanyStaffDashboardPage() {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('all');

  const [departments] = useState<DepartmentSummary[]>([
    { name: 'Emergency & Triage', head: 'Dr. Sarah Connor', activeStaff: 18, totalStaff: 20, occupancyRate: '94%', status: 'Critical' },
    { name: 'Cardiology', head: 'Dr. Michael Chen', activeStaff: 12, totalStaff: 14, occupancyRate: '82%', status: 'Optimal' },
    { name: 'Pediatrics', head: 'Dr. Kwame Nkrumah', activeStaff: 10, totalStaff: 12, occupancyRate: '78%', status: 'Optimal' },
    { name: 'Surgical ICU', head: 'Dr. Amina Mansour', activeStaff: 15, totalStaff: 16, occupancyRate: '91%', status: 'High Load' },
    { name: 'Pharmacy & Medical Supplies', head: 'Pharm. David Osei', activeStaff: 8, totalStaff: 8, occupancyRate: '65%', status: 'Optimal' },
    { name: 'Radiology & Imaging', head: 'Dr. Elena Rostova', activeStaff: 6, totalStaff: 7, occupancyRate: '85%', status: 'Optimal' },
    { name: 'Finance & Administration', head: 'Grace Mensah', activeStaff: 9, totalStaff: 10, occupancyRate: '50%', status: 'Optimal' },
  ]);

  const [rolesSummary] = useState<StaffRoleSummary[]>([
    { role: 'Chief Medical Officer', count: 2, onDuty: 2, permissionsCount: 32, department: 'Administration' },
    { role: 'Attending Physician / Doctor', count: 24, onDuty: 19, permissionsCount: 22, department: 'Clinical Care' },
    { role: 'Registered Nurse (RN)', count: 48, onDuty: 38, permissionsCount: 16, department: 'Inpatient Care' },
    { role: 'Pharmacist', count: 12, onDuty: 10, permissionsCount: 18, department: 'Pharmacy' },
    { role: 'Laboratory Technician', count: 10, onDuty: 8, permissionsCount: 14, department: 'Diagnostics' },
    { role: 'Medical Receptionist', count: 8, onDuty: 7, permissionsCount: 10, department: 'Front Desk' },
    { role: 'Financial / Billing Officer', count: 6, onDuty: 5, permissionsCount: 20, department: 'Finance' },
    { role: 'System Administrator', count: 3, onDuty: 3, permissionsCount: 36, department: 'IT & Security' },
  ]);

  useEffect(() => {
    fetchStaffStats();
  }, []);

  const fetchStaffStats = async () => {
    try {
      const staffData = (await api.getStaff()) as any[];
      if (Array.isArray(staffData) && staffData.length > 0) {
        toast.info(`Loaded ${staffData.length} staff members across all departments.`);
      }
    } catch (e) {
      console.warn('Using staff stats layout model', e);
    }
  };

  const filteredDepartments = departments.filter((dept) => {
    const matchesSearch = dept.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          dept.head.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = selectedDeptFilter === 'all' ||
                          (selectedDeptFilter === 'critical' && dept.status === 'Critical') ||
                          (selectedDeptFilter === 'high' && dept.status === 'High Load') ||
                          (selectedDeptFilter === 'optimal' && dept.status === 'Optimal');
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & Company Staff Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-2xl shadow-xl">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Badge className="bg-blue-500/20 text-blue-300 border-blue-400/30 px-3 py-1 font-semibold text-xs">
              Company Staff Management Portal
            </Badge>
            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-400/30 px-2.5 py-0.5 text-[11px]">
              Multi-Department Live
            </Badge>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Company Staff & Operational Command
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
            Real-time department capacity tracking, staff duty rosters, role-based authorization matrix, and clinical workload management.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => toast.success('Staff duty roster exported to PDF report')}
            className="bg-white/10 hover:bg-white/20 text-white border-white/20 font-semibold gap-2"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>Export Roster</span>
          </Button>
          <Button
            onClick={() => toast.info('System-wide staff alert broadcast sent')}
            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold gap-2 shadow-lg"
          >
            <Bell className="h-4 w-4" />
            <span>Broadcast Alert</span>
          </Button>
        </div>
      </div>

      {/* Staff Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border border-border/80 shadow-sm hover:shadow-md transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Total On-Duty Staff
            </CardTitle>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <UserCheck className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-foreground">106 / 123</div>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium mt-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> 86.2% Staffing Capacity
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border/80 shadow-sm hover:shadow-md transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Departments Active
            </CardTitle>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Building2 className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-foreground">7 Units</div>
            <p className="text-xs text-muted-foreground font-medium mt-1">
              Emergency, Cardiology, Pediatrics, ICU + 3 more
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border/80 shadow-sm hover:shadow-md transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Roles & Permissions
            </CardTitle>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-foreground">8 Defined Roles</div>
            <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mt-1">
              Role-Based Access Control Active
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border/80 shadow-sm hover:shadow-md transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              High Load Warnings
            </CardTitle>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-rose-600 dark:text-rose-400">2 Departments</div>
            <p className="text-xs text-rose-600 dark:text-rose-400 font-medium mt-1">
              Emergency & Surgical ICU nearing limit
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Command Tabs */}
      <Tabs defaultValue="departments" className="space-y-4">
        <TabsList className="bg-muted/60 p-1 border border-border">
          <TabsTrigger value="departments" className="text-xs font-bold px-4 gap-2">
            <Building2 className="h-3.5 w-3.5" /> Department Status
          </TabsTrigger>
          <TabsTrigger value="roles" className="text-xs font-bold px-4 gap-2">
            <ShieldCheck className="h-3.5 w-3.5" /> Roles & Permissions Matrix
          </TabsTrigger>
          <TabsTrigger value="duty" className="text-xs font-bold px-4 gap-2">
            <Clock className="h-3.5 w-3.5" /> On-Duty Shift Roster
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Department Status */}
        <TabsContent value="departments" className="space-y-4">
          <Card className="border border-border">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg font-bold">Hospital Department Overview</CardTitle>
                  <CardDescription className="text-xs">
                    Monitor staffing ratios, operational status, and occupancy across all hospital departments.
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-48">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search department..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8 h-8 text-xs"
                    />
                  </div>
                  <Select value={selectedDeptFilter} onValueChange={setSelectedDeptFilter}>
                    <SelectTrigger className="h-8 text-xs w-32">
                      <SelectValue placeholder="Status filter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs">All Statuses</SelectItem>
                      <SelectItem value="critical" className="text-xs">Critical Load</SelectItem>
                      <SelectItem value="high" className="text-xs">High Load</SelectItem>
                      <SelectItem value="optimal" className="text-xs">Optimal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredDepartments.map((dept) => (
                  <div
                    key={dept.name}
                    className="p-4 rounded-xl bg-card border border-border/80 shadow-sm space-y-3 hover:border-blue-500/40 transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-bold text-sm text-foreground">{dept.name}</h3>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          Head: <span className="font-medium text-foreground">{dept.head}</span>
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-bold px-2.5 py-0.5 ${
                          dept.status === 'Critical'
                            ? 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950 dark:text-rose-300'
                            : dept.status === 'High Load'
                            ? 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300'
                        }`}
                      >
                        {dept.status}
                      </Badge>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-muted-foreground">Staff On Duty</span>
                        <span>{dept.activeStaff} / {dept.totalStaff} ({Math.round((dept.activeStaff / dept.totalStaff) * 100)}%)</span>
                      </div>
                      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            dept.status === 'Critical'
                              ? 'bg-rose-500'
                              : dept.status === 'High Load'
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                          style={{ width: `${(dept.activeStaff / dept.totalStaff) * 100}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-border/60">
                      <span className="text-muted-foreground">Bed/Facility Occupancy:</span>
                      <span className="font-bold text-foreground">{dept.occupancyRate}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Roles & Permissions Matrix */}
        <TabsContent value="roles" className="space-y-4">
          <Card className="border border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-bold">Company Staff Role Hierarchy & Access</CardTitle>
              <CardDescription className="text-xs">
                Comprehensive overview of user roles, staffing counts, on-duty active personnel, and granular module permissions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto border rounded-xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/80 text-muted-foreground uppercase font-bold border-b">
                    <tr>
                      <th className="p-3">Staff Role Title</th>
                      <th className="p-3">Primary Department</th>
                      <th className="p-3">Total Staff</th>
                      <th className="p-3">Currently On Duty</th>
                      <th className="p-3">Permissions Scope</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rolesSummary.map((r) => (
                      <tr key={r.role} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3 font-bold text-foreground flex items-center gap-2">
                          <ShieldCheck className="h-4 w-4 text-blue-500" />
                          {r.role}
                        </td>
                        <td className="p-3 text-muted-foreground">{r.department}</td>
                        <td className="p-3 font-semibold">{r.count} staff</td>
                        <td className="p-3">
                          <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950 font-semibold">
                            {r.onDuty} Active
                          </Badge>
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {r.permissionsCount} module privileges enabled
                        </td>
                        <td className="p-3 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toast.info(`Viewing permission details for ${r.role}`)}
                            className="h-7 text-xs font-semibold text-blue-600 hover:text-blue-700"
                          >
                            Manage Scope
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: On-Duty Shift Roster */}
        <TabsContent value="duty" className="space-y-4">
          <Card className="border border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-bold">Shift Schedule & On-Call Roster</CardTitle>
              <CardDescription className="text-xs">
                Real-time active shifts, emergency backup coverage, and duty handovers.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase text-blue-600 dark:text-blue-400">Morning Shift (07:00 - 15:00)</span>
                    <Badge className="bg-blue-600 text-white text-[10px]">Active Now</Badge>
                  </div>
                  <p className="text-2xl font-black text-foreground">42 Staff</p>
                  <p className="text-xs text-muted-foreground">Doctors, Nurses, Triage Nurses, Pharmacists</p>
                </div>

                <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase text-indigo-600 dark:text-indigo-400">Evening Shift (15:00 - 23:00)</span>
                    <Badge variant="outline" className="text-[10px]">Upcoming</Badge>
                  </div>
                  <p className="text-2xl font-black text-foreground">38 Staff</p>
                  <p className="text-xs text-muted-foreground">Primary Care, Emergency Response, ICU</p>
                </div>

                <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase text-purple-600 dark:text-purple-400">Night Shift (23:00 - 07:00)</span>
                    <Badge variant="outline" className="text-[10px]">Scheduled</Badge>
                  </div>
                  <p className="text-2xl font-black text-foreground">26 Staff</p>
                  <p className="text-xs text-muted-foreground">Emergency Duty & On-Call Specialists</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default CompanyStaffDashboardPage;
