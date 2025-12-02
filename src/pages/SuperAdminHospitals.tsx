import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2, Users, Bed, Briefcase, AlertCircle } from 'lucide-react';

interface Hospital {
  id: string;
  hospital_id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  departments: number;
  staff_count: number;
  beds: number;
  status: 'active' | 'inactive';
}

export default function SuperAdminHospitals() {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadHospitals();
  }, []);

  const loadHospitals = async () => {
    try {
      setLoading(true);
      const data = await api.getAllHospitalsAdmin() as { hospitals: Hospital[] };
      setHospitals(data.hospitals);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to load hospitals');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Hospital Overview</h1>
        <p className="text-gray-400 mt-1">View all registered hospitals in the system</p>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-500">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {hospitals.map((hospital) => (
          <Card key={hospital.id} className="bg-[#001F3F]/50 border-gray-800">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-[#00BFFF]/10 flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-[#00BFFF]" />
                  </div>
                  <div>
                    <CardTitle className="text-white">{hospital.name}</CardTitle>
                    <CardDescription className="text-gray-400">
                      ID: {hospital.hospital_id}
                    </CardDescription>
                  </div>
                </div>
                <Badge
                  variant={hospital.status === 'active' ? 'default' : 'secondary'}
                >
                  {hospital.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                <p className="text-gray-400">{hospital.address}</p>
                <p className="text-gray-400">{hospital.phone}</p>
                <p className="text-gray-400">{hospital.email}</p>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-800">
                <div className="text-center">
                  <div className="flex items-center justify-center mb-1">
                    <Briefcase className="w-4 h-4 text-[#00BFFF]" />
                  </div>
                  <p className="text-2xl font-bold text-white">{hospital.departments}</p>
                  <p className="text-xs text-gray-400">Departments</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center mb-1">
                    <Users className="w-4 h-4 text-[#00BFFF]" />
                  </div>
                  <p className="text-2xl font-bold text-white">{hospital.staff_count}</p>
                  <p className="text-xs text-gray-400">Staff</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center mb-1">
                    <Bed className="w-4 h-4 text-[#00BFFF]" />
                  </div>
                  <p className="text-2xl font-bold text-white">{hospital.beds}</p>
                  <p className="text-xs text-gray-400">Beds</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {hospitals.length === 0 && !loading && (
        <Card className="bg-[#001F3F]/50 border-gray-800">
          <CardContent className="py-12 text-center">
            <Building2 className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No hospitals found in the system</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}