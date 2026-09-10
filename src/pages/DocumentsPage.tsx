import { useState, useEffect, useCallback } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import { Upload, FileText, Download, Eye, Trash2, Search, Filter } from 'lucide-react';
import { API_ORIGIN } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';

interface Document {
  id: string;
  name: string;
  type: string;
  category: string;
  patientId?: string;
  uploadedBy: string;
  uploadDate: string;
  size: string;
  storageLocation: string;
}

interface Patient {
  id: string;
  name: string;
}

const mockDocuments: Document[] = [
  {
    id: 'D001',
    name: 'Blood Test Results - Sarah Johnson',
    type: 'PDF',
    category: 'Lab Report',
    patientId: 'P001',
    uploadedBy: 'Dr. Michael Chen',
    uploadDate: '2024-01-15',
    size: '2.4 MB',
    storageLocation: 'Cloud',
  },
  {
    id: 'D002',
    name: 'X-Ray Scan - James Wilson',
    type: 'DICOM',
    category: 'Medical Record',
    patientId: 'P004',
    uploadedBy: 'Dr. Emily Davis',
    uploadDate: '2024-01-14',
    size: '15.8 MB',
    storageLocation: 'Local',
  },
  {
    id: 'D003',
    name: 'Prescription - Emily Davis',
    type: 'PDF',
    category: 'Prescription',
    patientId: 'P003',
    uploadedBy: 'Dr. Robert Lee',
    uploadDate: '2024-01-10',
    size: '156 KB',
    storageLocation: 'Cloud',
  },
  {
    id: 'D004',
    name: 'Hospital Policy Document',
    type: 'PDF',
    category: 'Administrative',
    uploadedBy: 'Admin',
    uploadDate: '2024-01-01',
    size: '5.2 MB',
    storageLocation: 'Local',
  },
];

export default function DocumentsPage() {
  const { hasPermission } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [newDocument, setNewDocument] = useState({
    file: null as File | null,
    filename: '',
    fileType: '',
    fileSize: '',
    category: '',
    storageLocation: '',
    patientId: '',
    uploadDate: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const loadDocuments = useCallback(async () => {
    try {
      const data = await api.getDocuments() as any[];
      const transformedData = data.map((doc: any) => ({
        id: doc.document_id,
        name: doc.name,
        type: doc.file_type,
        category: doc.category,
        patientId: doc.patient_id,
        uploadedBy: doc.uploaded_by ? String(doc.uploaded_by) : 'Admin',
        uploadDate: doc.uploaded_at,
        size: doc.file_size,
        storageLocation: doc.storage_type === 'cloud' ? 'Cloud' : 'Local',
      }));
      setDocuments(transformedData);
    } catch (error: any) {
      console.error('Failed to load documents:', error);
      toast.error(`Failed to load documents: ${error.message}`);
      setDocuments(mockDocuments);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPatients = useCallback(async () => {
    try {
      const data = await api.getPatients() as any[];
      setPatients(data.map((p: any) => ({ id: p.id, name: `${p.first_name} ${p.last_name} (${p.patient_id})` })));
    } catch (error) {
      console.error('Failed to load patients:', error);
    }
  }, []);

  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      await Promise.all([loadDocuments(), loadPatients()]);
    } catch (error) {
      console.error('Failed to load initial data:', error);
    } finally {
      setLoading(false);
    }
  }, [loadDocuments, loadPatients]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setNewDocument((prev) => ({ ...prev, [id]: value }));
  };

  const handleSelectChange = (id: string, value: string) => {
    setNewDocument((prev) => ({ ...prev, [id]: value }));
  };

  const handleAddDocument = async () => {
    try {
      if (!newDocument.file) {
        toast.error('Please select a file');
        return;
      }
      const formData = new FormData();
      formData.append('document', newDocument.file);
      if (newDocument.patientId) formData.append('patientId', newDocument.patientId);
      if (newDocument.category) formData.append('category', newDocument.category);
      if (newDocument.notes) formData.append('notes', newDocument.notes);
      await api.uploadDocument(formData);
      await loadDocuments();
      setIsDialogOpen(false);
      setNewDocument({
        file: null,
        filename: '',
        fileType: '',
        fileSize: '',
        category: '',
        storageLocation: '',
        patientId: '',
        uploadDate: new Date().toISOString().split('T')[0],
        notes: '',
      });
    } catch (error: any) {
      console.error('Failed to create document:', error);
      toast.error(`Failed to create document: ${error.message}`);
    }
  };

  const openDeleteDialog = (document: Document) => {
    setSelectedDocument(document);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteDocument = async () => {
    try {
      if (!selectedDocument) return;
      await api.deleteDocument(selectedDocument.id);
      toast.success('Document deleted successfully!');
      await loadDocuments();
      setIsDeleteDialogOpen(false);
      setSelectedDocument(null);
    } catch (error: any) {
      console.error('Failed to delete document:', error);
      toast.error(`Failed to delete document: ${error.message}`);
    }
  };

  const filteredDocuments = documents.filter((doc) =>
    doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {loading && (
        <div className="space-y-4" role="status" aria-label="Loading documents">
          <span className="sr-only">Loading data...</span>
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-8 w-56" />
              <Skeleton className="h-4 w-72" />
            </div>
            <Skeleton className="h-10 w-32" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-44 w-full" />
            <Skeleton className="h-44 w-full" />
            <Skeleton className="h-44 w-full" />
          </div>
        </div>
      )}
      {!loading && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Document Management</h1>
              <p className="text-muted-foreground">Upload and manage medical documents</p>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2" disabled={!hasPermission('documents:add')}>
                  <Upload className="h-4 w-4" aria-hidden="true" />
                  Upload Document
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Upload New Document</DialogTitle>
                  <DialogDescription>
                    Upload medical records, lab reports, or administrative documents
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="file">Select File</Label>
                    <Input id="file" type="file" onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setNewDocument((prev) => ({ ...prev, file }));
                      if (file) {
                        setNewDocument((prev) => ({
                          ...prev,
                          filename: file.name,
                          fileType: file.type,
                          fileSize: `${Math.round(file.size / 1024)} KB`
                        }));
                      }
                    }} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="filename">Document Name</Label>
                    <Input id="filename" placeholder="e.g., Blood Test Results" value={newDocument.filename} onChange={handleInputChange} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="fileType">File Type</Label>
                      <Input id="fileType" placeholder="e.g., PDF" value={newDocument.fileType} onChange={handleInputChange} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fileSize">File Size</Label>
                      <Input id="fileSize" placeholder="e.g., 2.5MB" value={newDocument.fileSize} onChange={handleInputChange} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select onValueChange={(value) => handleSelectChange('category', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Medical Record">Medical Record</SelectItem>
                        <SelectItem value="Lab Report">Lab Report</SelectItem>
                        <SelectItem value="Prescription">Prescription</SelectItem>
                        <SelectItem value="Administrative">Administrative</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="storageLocation">Storage Location</Label>
                    <Select onValueChange={(value) => handleSelectChange('storageLocation', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select storage" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Local">Local Storage</SelectItem>
                        <SelectItem value="Cloud">Cloud Storage</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="patientId">Patient (Optional)</Label>
                    <Select onValueChange={(value) => handleSelectChange('patientId', value)}>
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
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleAddDocument} disabled={!hasPermission('documents:add')}>Upload Document</Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Delete Document Dialog */}
            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Confirm Deletion</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to delete this document? This action cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
                  <Button variant="destructive" onClick={handleDeleteDocument} disabled={!hasPermission('documents:delete')}>Delete</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Documents
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">1,234</div>
                <p className="text-xs text-muted-foreground">+89 this month</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Cloud Storage
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">45.2 GB</div>
                <p className="text-xs text-muted-foreground">of 100 GB used</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Local Storage
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">128 GB</div>
                <p className="text-xs text-muted-foreground">of 500 GB used</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Recent Uploads
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">24</div>
                <p className="text-xs text-muted-foreground">in last 7 days</p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="all" className="space-y-4">
            <TabsList>
              <TabsTrigger value="all">All Documents</TabsTrigger>
              <TabsTrigger value="medical">Medical Records</TabsTrigger>
              <TabsTrigger value="lab">Lab Reports</TabsTrigger>
              <TabsTrigger value="prescription">Prescriptions</TabsTrigger>
              <TabsTrigger value="admin">Administrative</TabsTrigger>
            </TabsList>

            <TabsContent value="all">
              <ErrorBoundary fallbackTitle="Error loading Document Library">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Document Library</CardTitle>
                      <div className="flex gap-2">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                          <Input
                            placeholder="Search documents..."
                            className="pl-9 w-64"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                          />
                        </div>
                        <Button variant="outline" size="icon" aria-label="Filter documents">
                          <Filter className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Document</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Patient</TableHead>
                            <TableHead>Uploaded By</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Size</TableHead>
                            <TableHead>Storage</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredDocuments.map((doc) => (
                            <TableRow key={doc.id}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <FileText className="h-4 w-4 text-accent" aria-hidden="true" />
                                  <div>
                                    <p className="font-medium text-foreground">{doc.name}</p>
                                    <p className="text-xs text-muted-foreground">{doc.type}</p>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{doc.category}</Badge>
                              </TableCell>
                              <TableCell>{patients.find((p) => p.id === doc.patientId)?.name || '-'}</TableCell>
                              <TableCell>{doc.uploadedBy}</TableCell>
                              <TableCell>{doc.uploadDate}</TableCell>
                              <TableCell>{doc.size}</TableCell>
                              <TableCell>
                                <Badge variant={doc.storageLocation === 'Cloud' ? 'default' : 'secondary'}>
                                  {doc.storageLocation}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      const url = `${API_ORIGIN}/api/documents/${doc.id}/preview`;
                                      window.open(url, '_blank');
                                    }}
                                    aria-label="Preview document"
                                  >
                                    <Eye className="h-4 w-4" aria-hidden="true" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      const url = `${API_ORIGIN}/api/documents/${doc.id}/download`;
                                      window.open(url, '_blank');
                                    }}
                                    aria-label="Download document"
                                  >
                                    <Download className="h-4 w-4" aria-hidden="true" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(doc)} aria-label="Delete document">
                                    <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </ErrorBoundary>
            </TabsContent>

            {['medical', 'lab', 'prescription', 'admin'].map((tab) => (
              <TabsContent key={tab} value={tab}>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-muted-foreground text-center">
                      {tab.charAt(0).toUpperCase() + tab.slice(1)} documents filtered view
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        </>
      )}
    </div>
  );
}