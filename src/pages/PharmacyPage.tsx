import { useState, useEffect, useCallback } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Package, Barcode, Plus, Pill, AlertTriangle, TrendingDown, Search, List, Clock, Sparkles } from 'lucide-react';
import { api } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useAudit } from '@/contexts/AuditContext';
import { MedicationComplianceTracker } from '@/components/pharmacy/MedicationComplianceTracker';
import { InventoryForecastingModule } from '@/components/pharmacy/InventoryForecastingModule';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';

interface Medicine {
  id: string;
  name: string;
  category: string;
  stock: number;
  minStock: number;
  price: number;
  expiryDate: string;
  supplier: string;
  status: 'In Stock' | 'Low Stock' | 'Out of Stock';
}

export default function PharmacyPage() {
  const { hasPermission, canActOnHospital, user } = useAuth();
  const { logAction } = useAudit();
  const [activeTab, setActiveTab] = useState<'inventory' | 'forecasting' | 'compliance'>('inventory');
  const [searchTerm, setSearchTerm] = useState('');
  const [medicines, setMedicines] = useState<Medicine[]>([]);

  const handleDeductStock = useCallback((medicineId: string, quantity: number) => {
    setMedicines((prev) =>
      prev.map((m) => {
        if (m.id === medicineId) {
          const newStock = Math.max(0, m.stock - quantity);
          return {
            ...m,
            stock: newStock,
            status: newStock <= m.minStock ? (newStock === 0 ? 'Out of Stock' : 'Low Stock') : 'In Stock'
          };
        }
        return m;
      })
    );
  }, []);

  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannedCode, setScannedCode] = useState('');
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [creatingReorders, setCreatingReorders] = useState(false);
  const [newMedicine, setNewMedicine] = useState({
    medicineName: '',
    category: '',
    stockLevel: '',
    lowStockThreshold: '',
    expiryDate: '',
    unitPrice: '',
    supplier: '',
  });

  const loadMedicines = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getMedicines() as any[];
      const transformedData = data.map((med: any) => ({
        id: med.id,
        name: med.medicine_name,
        category: med.category,
        stock: med.stock_level,
        minStock: med.low_stock_threshold,
        price: med.unit_price,
        expiryDate: med.expiry_date,
        supplier: med.supplier,
        status: med.stock_level <= med.low_stock_threshold ? (med.stock_level === 0 ? 'Out of Stock' : 'Low Stock') : 'In Stock' as 'In Stock' | 'Low Stock' | 'Out of Stock'
      }));
      setMedicines(transformedData);
    } catch (error: any) {
      console.error('Failed to load medicines:', error);
      toast.error(`Failed to load medicines: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSuppliers = useCallback(async () => {
    try {
      const data = await api.getSuppliers();
      setSuppliers(data as any[]);
    } catch (_e) {
      console.warn('Failed to load suppliers');
    }
  }, []);

  useEffect(() => {
    loadMedicines();
    loadSuppliers();
  }, [loadMedicines, loadSuppliers]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setNewMedicine((prev) => ({ ...prev, [id]: value }));
  };

  const handleAddMedicine = async () => {
    try {
      await api.createPharmacyItem(newMedicine);
      await loadMedicines();
      setIsDialogOpen(false);
      setNewMedicine({
        medicineName: '',
        category: '',
        stockLevel: '',
        lowStockThreshold: '',
        expiryDate: '',
        unitPrice: '',
        supplier: '',
      });
      logAction('create', 'pharmacy', { newValue: JSON.stringify(newMedicine) });
    } catch (error) {
      console.error('Failed to create medicine:', error);
    }
  };

  const handleAdjustStock = async (med: Medicine) => {
    const amountStr = prompt('Enter adjustment amount (e.g., +10 or -5):', '');
    if (!amountStr) return;
    const amount = Number(amountStr);
    if (Number.isNaN(amount)) {
      toast.error('Invalid adjustment amount');
      return;
    }
    const newLevel = med.stock + amount;
    try {
      await api.updatePharmacyItem(med.id, { stock_level: newLevel });
      logAction('adjust_stock', 'pharmacy', { recordId: med.id, oldValue: String(med.stock), newValue: String(newLevel) });
      await loadMedicines();
      toast.success('Stock adjusted');
    } catch (_e: any) {
      logAction('adjust_stock_failed', 'pharmacy', { recordId: med.id, oldValue: String(med.stock), newValue: String(newLevel) });
      toast.error('Adjustment failed; logged discrepancy');
    }
  };

  const ensureSupplierId = async (name: string): Promise<string | number | undefined> => {
    const found = suppliers.find((s) => s.name === name);
    if (found) return found.id;
    try {
      const created: any = await api.createSupplier({ name });
      await loadSuppliers();
      return created.id;
    } catch {
      return undefined;
    }
  };

  const handleAutoReorder = async () => {
    if (!hasPermission('purchaseOrder:add') || !canActOnHospital(user?.hospital_id)) {
      toast.error('Unauthorized to create purchase orders');
      return;
    }
    const lowItems = medicines.filter((m) => m.stock <= m.minStock);
    if (lowItems.length === 0) {
      toast.info('No items require reordering');
      return;
    }
    setCreatingReorders(true);
    try {
      const grouped: Record<string, Medicine[]> = {};
      lowItems.forEach((m) => {
        grouped[m.supplier] = grouped[m.supplier] || [];
        grouped[m.supplier].push(m);
      });

      const supplierNames = Object.keys(grouped);
      for (const supplierName of supplierNames) {
        const supplierId = await ensureSupplierId(supplierName);
        if (!supplierId) continue;
        const items = grouped[supplierName].map((m) => ({
          medicine_id: m.id,
          quantity: Math.max(m.minStock * 2 - m.stock, 1),
          unit_price: m.price,
        }));
        const order_date = new Date().toISOString().slice(0, 10);
        const expected_delivery_date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        await api.createPurchaseOrder({ supplier_id: supplierId, order_date, expected_delivery_date, items });
      }
      toast.success('Purchase orders created for low-stock items');
      logAction('auto_reorder', 'pharmacy', { newValue: JSON.stringify(lowItems) });
    } catch (_e) {
      toast.error('Failed to create purchase orders');
    } finally {
      setCreatingReorders(false);
    }
  };

  const validateBarcode = (code: string) => {
    const trimmed = code.trim();
    if (trimmed.length < 8 || trimmed.length > 20) return false;
    if (!/^[A-Za-z0-9]+$/.test(trimmed)) return false;
    return true;
  };

  const filteredMedicines = medicines.filter((med) =>
    med.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    med.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const lowStockCount = medicines.filter((m) => m.status === 'Low Stock' || m.status === 'Out of Stock').length;
  const totalValue = medicines.reduce((sum, m) => sum + m.stock * m.price, 0);

  return (
    <div className="space-y-6">
      {loading && (
        <div className="space-y-4" role="status" aria-label="Loading pharmacy data">
          <span className="sr-only">Loading data...</span>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="space-y-2">
              <Skeleton className="h-8 w-56" />
              <Skeleton className="h-4 w-72" />
            </div>
            <Skeleton className="h-10 w-40" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        </div>
      )}
      {!loading && (
        <>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-2 border-b border-border">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Pharmacy & Inventory</h1>
              <p className="text-muted-foreground">Manage medicines, stock levels, and patient medication compliance</p>
            </div>
            <div className="flex bg-muted/60 p-1 rounded-lg border border-border shrink-0" role="tablist" aria-label="Pharmacy tabs">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'inventory'}
                onClick={() => setActiveTab('inventory')}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                  activeTab === 'inventory'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Inventory Ledger
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'forecasting'}
                onClick={() => setActiveTab('forecasting')}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
                  activeTab === 'forecasting'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-accent" aria-hidden="true" /> AI Forecasting
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'compliance'}
                onClick={() => setActiveTab('compliance')}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
                  activeTab === 'compliance'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Clock className="w-3.5 h-3.5 text-destructive" aria-hidden="true" /> Compliance Tracker
              </button>
            </div>
          </div>

          {activeTab === 'forecasting' ? (
            <ErrorBoundary fallbackTitle="Error loading Inventory Forecasting">
              <InventoryForecastingModule />
            </ErrorBoundary>
          ) : activeTab === 'inventory' ? (
            <>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" className="gap-2" disabled={creatingReorders} onClick={handleAutoReorder}>
                <Package className="h-4 w-4" aria-hidden="true" />
                Reorder
              </Button>
              <Dialog open={isScannerOpen} onOpenChange={setIsScannerOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Barcode className="h-4 w-4" aria-hidden="true" />
                    Scan Barcode
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-xl">
                  <DialogHeader>
                    <DialogTitle>Barcode Scan</DialogTitle>
                    <DialogDescription>Use camera or enter manually</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <Input placeholder="Enter code manually" value={scannedCode} onChange={(e) => setScannedCode(e.target.value)} />
                    <div className="rounded border border-border p-3 text-sm text-muted-foreground">
                      Camera preview not available without additional libraries. Use manual entry above.
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setIsScannerOpen(false)}>Cancel</Button>
                      <Button onClick={() => {
                        if (!validateBarcode(scannedCode)) {
                          toast.error('Invalid barcode');
                          return;
                        }
                        toast.success('Barcode accepted');
                        setIsScannerOpen(false);
                      }}>Confirm</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2" disabled={!hasPermission('pharmacy:add')}>
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Add Medicine
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Add New Medicine</DialogTitle>
                    <DialogDescription>
                      Add a new medicine to the inventory
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="medicineName">Medicine Name</Label>
                        <Input id="medicineName" placeholder="e.g., Paracetamol 500mg" value={newMedicine.medicineName} onChange={handleInputChange} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="category">Category</Label>
                        <Input id="category" placeholder="e.g., Pain Relief" value={newMedicine.category} onChange={handleInputChange} />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="stockLevel">Initial Stock</Label>
                        <Input id="stockLevel" type="number" placeholder="100" value={newMedicine.stockLevel} onChange={handleInputChange} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lowStockThreshold">Min Stock Level</Label>
                        <Input id="lowStockThreshold" type="number" placeholder="50" value={newMedicine.lowStockThreshold} onChange={handleInputChange} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="unitPrice">Unit Price (GHS)</Label>
                        <Input id="unitPrice" type="number" step="0.01" placeholder="5.00" value={newMedicine.unitPrice} onChange={handleInputChange} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="expiryDate">Expiry Date</Label>
                        <Input id="expiryDate" type="date" value={newMedicine.expiryDate} onChange={handleInputChange} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="supplier">Supplier</Label>
                        <Input id="supplier" placeholder="Supplier name" value={newMedicine.supplier} onChange={handleInputChange} />
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleAddMedicine} disabled={!hasPermission('pharmacy:add')}>Add Medicine</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Pill className="h-4 w-4" aria-hidden="true" />
                    Total Medicines
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">{medicines.length}</div>
                  <p className="text-xs text-muted-foreground">Active items</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                    Low Stock Alerts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-destructive">{lowStockCount}</div>
                  <p className="text-xs text-muted-foreground">Requires attention</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Package className="h-4 w-4" aria-hidden="true" />
                    Total Stock Value
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">GHS {totalValue.toFixed(2)}</div>
                  <p className="text-xs text-muted-foreground">Current inventory</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <TrendingDown className="h-4 w-4" aria-hidden="true" />
                    Expiring Soon
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">3</div>
                  <p className="text-xs text-muted-foreground">Within 30 days</p>
                </CardContent>
              </Card>
            </div>

            {lowStockCount > 0 && (
              <Card className="border-destructive">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                    Low Stock Alerts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {medicines
                      .filter((m) => m.status === 'Low Stock' || m.status === 'Out of Stock')
                      .map((med) => (
                        <div
                          key={med.id}
                          className="flex items-center justify-between rounded-lg border border-border p-3"
                        >
                          <div>
                            <p className="font-medium text-foreground">{med.name}</p>
                            <p className="text-sm text-muted-foreground">
                              Current: {med.stock} | Min: {med.minStock}
                            </p>
                          </div>
                          <Button size="sm" disabled={!hasPermission('purchaseOrder:add') || !canActOnHospital(user?.hospital_id)} onClick={() => {
                            if (!hasPermission('purchaseOrder:add') || !canActOnHospital(user?.hospital_id)) {
                              toast.error('Unauthorized to create purchase order for this hospital.');
                              return;
                            }
                            toast.info('Reorder action coming soon');
                          }}>Reorder</Button>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Inventory</CardTitle>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <Input
                      placeholder="Search medicines..."
                      className="pl-9 w-64"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {medicines.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">No medicines found.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Medicine</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Stock</TableHead>
                          <TableHead>Unit Price</TableHead>
                          <TableHead>Total Value</TableHead>
                          <TableHead>Expiry Date</TableHead>
                          <TableHead>Supplier</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredMedicines.map((med) => (
                          <TableRow key={med.id}>
                            <TableCell className="font-medium">{med.name}</TableCell>
                            <TableCell>{med.category}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span>{med.stock}</span>
                                {med.stock <= med.minStock && (
                                  <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden="true" />
                                )}
                              </div>
                            </TableCell>
                            <TableCell>GHS {med.price.toFixed(2)}</TableCell>
                            <TableCell>GHS {(med.stock * med.price).toFixed(2)}</TableCell>
                            <TableCell>{med.expiryDate}</TableCell>
                            <TableCell>{med.supplier}</TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  med.status === 'In Stock'
                                    ? 'default'
                                    : med.status === 'Low Stock'
                                    ? 'secondary'
                                    : 'destructive'
                                }
                              >
                                {med.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button variant="ghost" size="sm" onClick={() => handleAdjustStock(med)}>Adjust</Button>
                                <Button variant="ghost" size="sm" onClick={() => {
                                  const key = `inventoryBatches:${med.id}`;
                                  const batches = JSON.parse(localStorage.getItem(key) || '[]');
                                  localStorage.setItem('batchView', JSON.stringify({ medicine: med, batches }));
                                  toast.info('Open Inventory Reports to manage batches');
                                }}>
                                  <List className="h-4 w-4" aria-hidden="true" /> Batches
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
            </>
          ) : (
            <ErrorBoundary fallbackTitle="Error loading Medication Compliance Tracker">
              <MedicationComplianceTracker medicines={medicines} onDeductStock={handleDeductStock} />
            </ErrorBoundary>
          )}
        </>
      )}
    </div>
  );
}