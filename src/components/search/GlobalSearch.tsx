import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/services/api';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Search,
  Users,
  UserCheck,
  Calendar,
  Layers,
  ArrowRight,
  X,
  Loader2,
} from 'lucide-react';

interface SearchResultItem {
  id: string;
  title: string;
  subtitle: string;
  category: 'patient' | 'staff' | 'appointment' | 'navigation';
  route: string;
  badge?: string;
  badgeVariant?: 'default' | 'secondary' | 'outline' | 'destructive';
}

const NAVIGATION_ITEMS: SearchResultItem[] = [
  { id: 'nav-dashboard', title: 'Dashboard', subtitle: 'Overview, analytics & recent activity', category: 'navigation', route: '/dashboard' },
  { id: 'nav-patients', title: 'Patients Directory', subtitle: 'Patient records, registrations & history', category: 'navigation', route: '/patients' },
  { id: 'nav-appointments', title: 'Appointments Calendar', subtitle: 'Schedule & appointment tracking', category: 'navigation', route: '/appointments' },
  { id: 'nav-staff', title: 'Staff Directory', subtitle: 'Doctors, nurses & administrative staff', category: 'navigation', route: '/staff' },
  { id: 'nav-pharmacy', title: 'Pharmacy & Prescriptions', subtitle: 'Medication management & dispensaries', category: 'navigation', route: '/pharmacy' },
  { id: 'nav-inventory-reports', title: 'Inventory Reports', subtitle: 'Stock levels, expiry dates & batch views', category: 'navigation', route: '/inventory-reports' },
  { id: 'nav-financial', title: 'Financial Management', subtitle: 'Chart of accounts, balance sheet & income', category: 'navigation', route: '/financial' },
  { id: 'nav-hospitals', title: 'Hospitals & Branches', subtitle: 'Hospital network and facility settings', category: 'navigation', route: '/hospitals' },
  { id: 'nav-audit-logs', title: 'Audit Logs', subtitle: 'System compliance, security & activity audit', category: 'navigation', route: '/audit-logs' },
  { id: 'nav-settings', title: 'Settings', subtitle: 'Account preferences & system configurations', category: 'navigation', route: '/settings' },
];

export function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Handle outside click to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Global shortcut (Cmd+K / Ctrl+K / slash)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      } else if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const executeSearch = useCallback(async (searchQuery: string) => {
    const trimmed = searchQuery.trim().toLowerCase();
    if (!trimmed) {
      // Show default top navigation shortcuts
      setResults(NAVIGATION_ITEMS.slice(0, 6));
      setLoading(false);
      return;
    }

    setLoading(true);
    const collected: SearchResultItem[] = [];

    // Match Navigation
    const matchedNav = NAVIGATION_ITEMS.filter(
      (n) => n.title.toLowerCase().includes(trimmed) || n.subtitle.toLowerCase().includes(trimmed)
    );
    collected.push(...matchedNav);

    try {
      // Fetch Patients, Staff, Appointments in parallel with graceful fallbacks
      const [patientsRes, staffRes, appointmentsRes] = await Promise.allSettled([
        api.getPatients({ search: trimmed }),
        api.getStaff(),
        api.getAppointments(),
      ]);

      // 1. Process Patients
      if (patientsRes.status === 'fulfilled' && Array.isArray(patientsRes.value)) {
        const matchingPatients = patientsRes.value
          .filter((p: any) => {
            const name = `${p.first_name || ''} ${p.last_name || ''}`.toLowerCase();
            const id = (p.patient_id || p.id || '').toLowerCase();
            const email = (p.email || '').toLowerCase();
            const phone = (p.phone || '').toLowerCase();
            return (
              name.includes(trimmed) ||
              id.includes(trimmed) ||
              email.includes(trimmed) ||
              phone.includes(trimmed)
            );
          })
          .slice(0, 5)
          .map((p: any) => ({
            id: `patient-${p.patient_id || p.id}`,
            title: `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Unnamed Patient',
            subtitle: `Patient ID: ${p.patient_id || p.id} • ${p.phone || p.email || 'No contact'} • ${p.hospital_id || 'Main'}`,
            category: 'patient' as const,
            route: `/patients?search=${encodeURIComponent(p.patient_id || p.first_name || '')}`,
            badge: p.status === 'active' || p.status === 'Active' ? 'Active' : 'Inactive',
            badgeVariant: (p.status === 'active' || p.status === 'Active' ? 'default' : 'secondary') as any,
          }));
        collected.push(...matchingPatients);
      }

      // 2. Process Staff
      if (staffRes.status === 'fulfilled' && Array.isArray(staffRes.value)) {
        const matchingStaff = staffRes.value
          .filter((s: any) => {
            const name = `${s.first_name || ''} ${s.last_name || s.name || ''}`.toLowerCase();
            const role = (s.role_name || s.role || '').toLowerCase();
            const dept = (s.department_name || s.department || '').toLowerCase();
            const email = (s.email || '').toLowerCase();
            return (
              name.includes(trimmed) ||
              role.includes(trimmed) ||
              dept.includes(trimmed) ||
              email.includes(trimmed)
            );
          })
          .slice(0, 5)
          .map((s: any) => {
            const fullName = s.first_name ? `${s.first_name} ${s.last_name || ''}`.trim() : (s.name || 'Staff Member');
            return {
              id: `staff-${s.id}`,
              title: fullName,
              subtitle: `${s.role_name || s.role || 'Staff'} • ${s.department_name || s.department || 'General'} • ${s.hospital_name || s.hospital || 'Hospital'}`,
              category: 'staff' as const,
              route: `/staff?search=${encodeURIComponent(fullName)}`,
              badge: s.role_name || s.role || 'Staff',
              badgeVariant: 'outline' as const,
            };
          });
        collected.push(...matchingStaff);
      }

      // 3. Process Appointments
      if (appointmentsRes.status === 'fulfilled' && Array.isArray(appointmentsRes.value)) {
        const matchingAppts = appointmentsRes.value
          .filter((a: any) => {
            const patient = `${a.patient_first_name || ''} ${a.patient_last_name || a.patientName || ''}`.toLowerCase();
            const doctor = `${a.doctor_first_name || ''} ${a.doctor_last_name || a.doctorName || ''}`.toLowerCase();
            const type = (a.type || '').toLowerCase();
            const dept = (a.department_name || a.department || '').toLowerCase();
            return (
              patient.includes(trimmed) ||
              doctor.includes(trimmed) ||
              type.includes(trimmed) ||
              dept.includes(trimmed)
            );
          })
          .slice(0, 5)
          .map((a: any) => {
            const pName = `${a.patient_first_name || ''} ${a.patient_last_name || a.patientName || ''}`.trim() || 'Patient';
            const dName = `${a.doctor_first_name || ''} ${a.doctor_last_name || a.doctorName || ''}`.trim() || 'Doctor';
            const dateStr = a.appointment_date || a.date || '';
            const timeStr = a.appointment_time || a.time || '';
            return {
              id: `appt-${a.id || a.appointment_id}`,
              title: `${pName} with Dr. ${dName}`,
              subtitle: `${a.type || 'Consultation'} • ${dateStr} ${timeStr} • ${a.department_name || a.department || 'General'}`,
              category: 'appointment' as const,
              route: `/appointments?search=${encodeURIComponent(pName)}`,
              badge: a.status ? String(a.status).toUpperCase() : 'SCHEDULED',
              badgeVariant: (a.status === 'completed' || a.status === 'Completed'
                ? 'secondary'
                : a.status === 'cancelled'
                ? 'destructive'
                : 'default') as any,
            };
          });
        collected.push(...matchingAppts);
      }
    } catch (err) {
      console.error('Global search error:', err);
    } finally {
      setResults(collected);
      setSelectedIndex(0);
      setLoading(false);
    }
  }, []);

  // Debounced search trigger
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isOpen) {
        executeSearch(query);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [query, isOpen, executeSearch]);

  const handleSelect = (item: SearchResultItem) => {
    setIsOpen(false);
    setQuery('');
    navigate(item.route);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown') {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, results.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + results.length) % Math.max(1, results.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      }
    }
  };

  const renderCategoryIcon = (category: SearchResultItem['category']) => {
    switch (category) {
      case 'patient':
        return <Users className="h-4 w-4 text-blue-400" />;
      case 'staff':
        return <UserCheck className="h-4 w-4 text-emerald-400" />;
      case 'appointment':
        return <Calendar className="h-4 w-4 text-amber-400" />;
      case 'navigation':
      default:
        return <Layers className="h-4 w-4 text-sky-400" />;
    }
  };

  const patientsList = results.filter((r) => r.category === 'patient');
  const staffList = results.filter((r) => r.category === 'staff');
  const apptsList = results.filter((r) => r.category === 'appointment');
  const navList = results.filter((r) => r.category === 'navigation');

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Quick search patients, staff, appointments... (⌘K)"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            setIsOpen(true);
            if (results.length === 0) {
              executeSearch(query);
            }
          }}
          onKeyDown={handleKeyDown}
          className="pl-9 pr-16 h-9 bg-background border-border text-sm placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-accent"
        />
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          ) : query ? (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                executeSearch('');
              }}
              className="text-muted-foreground hover:text-foreground p-0.5"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
              ⌘K
            </kbd>
          )}
        </div>
      </div>

      {/* Results Dropdown */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-2 z-50 max-h-[480px] overflow-y-auto rounded-lg border border-border bg-card shadow-2xl p-2 animate-in fade-in-0 zoom-in-95 duration-100">
          {loading && results.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-accent" />
              Searching records...
            </div>
          ) : results.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <p>No results found for <span className="font-semibold text-foreground">"{query}"</span></p>
              <p className="text-xs text-muted-foreground mt-1">Try searching by patient name, staff role, or appointment detail</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Patients Group */}
              {patientsList.length > 0 && (
                <div>
                  <div className="flex items-center justify-between px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-blue-400" />
                      Patients ({patientsList.length})
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    {patientsList.map((item) => {
                      const itemIdx = results.findIndex((r) => r.id === item.id);
                      const isSelected = selectedIndex === itemIdx;
                      return (
                        <div
                          key={item.id}
                          onClick={() => handleSelect(item)}
                          onMouseEnter={() => setSelectedIndex(itemIdx)}
                          className={`flex items-center justify-between px-2.5 py-2 rounded-md cursor-pointer text-sm transition-colors ${
                            isSelected ? 'bg-secondary text-foreground' : 'text-foreground hover:bg-secondary/60'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 pr-2">
                            <div className="p-1.5 rounded-md bg-muted text-muted-foreground">
                              {renderCategoryIcon(item.category)}
                            </div>
                            <div className="truncate">
                              <p className="font-medium text-foreground text-sm truncate">{item.title}</p>
                              <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
                            </div>
                          </div>
                          {item.badge && (
                            <Badge variant={item.badgeVariant || 'outline'} className="text-[10px] shrink-0">
                              {item.badge}
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Staff Group */}
              {staffList.length > 0 && (
                <div>
                  <div className="flex items-center justify-between px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <UserCheck className="h-3.5 w-3.5 text-emerald-400" />
                      Staff ({staffList.length})
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    {staffList.map((item) => {
                      const itemIdx = results.findIndex((r) => r.id === item.id);
                      const isSelected = selectedIndex === itemIdx;
                      return (
                        <div
                          key={item.id}
                          onClick={() => handleSelect(item)}
                          onMouseEnter={() => setSelectedIndex(itemIdx)}
                          className={`flex items-center justify-between px-2.5 py-2 rounded-md cursor-pointer text-sm transition-colors ${
                            isSelected ? 'bg-secondary text-foreground' : 'text-foreground hover:bg-secondary/60'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 pr-2">
                            <div className="p-1.5 rounded-md bg-muted text-muted-foreground">
                              {renderCategoryIcon(item.category)}
                            </div>
                            <div className="truncate">
                              <p className="font-medium text-foreground text-sm truncate">{item.title}</p>
                              <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
                            </div>
                          </div>
                          {item.badge && (
                            <Badge variant="outline" className="text-[10px] shrink-0">
                              {item.badge}
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Appointments Group */}
              {apptsList.length > 0 && (
                <div>
                  <div className="flex items-center justify-between px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-amber-400" />
                      Appointments ({apptsList.length})
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    {apptsList.map((item) => {
                      const itemIdx = results.findIndex((r) => r.id === item.id);
                      const isSelected = selectedIndex === itemIdx;
                      return (
                        <div
                          key={item.id}
                          onClick={() => handleSelect(item)}
                          onMouseEnter={() => setSelectedIndex(itemIdx)}
                          className={`flex items-center justify-between px-2.5 py-2 rounded-md cursor-pointer text-sm transition-colors ${
                            isSelected ? 'bg-secondary text-foreground' : 'text-foreground hover:bg-secondary/60'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 pr-2">
                            <div className="p-1.5 rounded-md bg-muted text-muted-foreground">
                              {renderCategoryIcon(item.category)}
                            </div>
                            <div className="truncate">
                              <p className="font-medium text-foreground text-sm truncate">{item.title}</p>
                              <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
                            </div>
                          </div>
                          {item.badge && (
                            <Badge variant={item.badgeVariant || 'outline'} className="text-[10px] shrink-0">
                              {item.badge}
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Quick Navigation Group */}
              {navList.length > 0 && (
                <div>
                  <div className="flex items-center justify-between px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-sky-400" />
                      Quick Navigation
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    {navList.map((item) => {
                      const itemIdx = results.findIndex((r) => r.id === item.id);
                      const isSelected = selectedIndex === itemIdx;
                      return (
                        <div
                          key={item.id}
                          onClick={() => handleSelect(item)}
                          onMouseEnter={() => setSelectedIndex(itemIdx)}
                          className={`flex items-center justify-between px-2.5 py-2 rounded-md cursor-pointer text-sm transition-colors ${
                            isSelected ? 'bg-secondary text-foreground' : 'text-foreground hover:bg-secondary/60'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 pr-2">
                            <div className="p-1.5 rounded-md bg-muted text-muted-foreground">
                              {renderCategoryIcon(item.category)}
                            </div>
                            <div className="truncate">
                              <p className="font-medium text-foreground text-sm">{item.title}</p>
                              <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
                            </div>
                          </div>
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mt-2 pt-2 border-t border-border flex items-center justify-between px-2 text-[11px] text-muted-foreground">
            <span>Use ↑↓ to navigate, Enter to select</span>
            <span>ESC to close</span>
          </div>
        </div>
      )}
    </div>
  );
}
