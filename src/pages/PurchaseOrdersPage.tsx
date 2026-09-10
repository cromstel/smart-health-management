import { useEffect, useState, useCallback } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useAudit } from '@/contexts/AuditContext';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';

export default function PurchaseOrdersPage() {
  const { hasPermission } = useAuth();
  const { logAction } = useAudit();
  const [orders, setOrders] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [medicines, setMedicines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCreate, setOpenCreate] = useState(false);
  const [newOrder, setNewOrder] = useState({ supplier_id: '', order_date: '', expected_delivery_date: '' });
  const [items, setItems] = useState<{ medicine_id: string; quantity: number; unit_price: number }[]>([]);

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const [os, ss, ms] = await Promise.all([api.getPurchaseOrders(), api.getSuppliers(), api.getMedicines()]);
      setOrders(os as any[]);
      setSuppliers(ss as any[]);
      setMedicines(ms as any[]);
    } catch (_e) {
      toast.error('Failed to load purchase orders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const addItem = () => {
    setItems((prev) => [...prev, { medicine_id: '', quantity: 1, unit_price: 0 }]);
  };

  const updateItem = (index: number, partial: Partial<{ medicine_id: string; quantity: number; unit_price: number }>) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...partial } : it)));
  };

  const createOrder = async () => {
    if (!hasPermission('purchaseOrder:add')) {
      toast.error('Unauthorized');
      return;
    }
    if (!newOrder.supplier_id || items.length === 0) {
      toast.error('Supplier and at least one item required');
      return;
    }
    try {
      await api.createPurchaseOrder({ ...newOrder, items });
      logAction('create', 'purchaseOrder', { newValue: JSON.stringify({ ...newOrder, items }) });
      setOpenCreate(false);
      setNewOrder({ supplier_id: '', order_date: '', expected_delivery_date: '' });
      setItems([]);
      await loadAll();
      toast.success('Purchase order created');
    } catch (_e) {
      toast.error('Failed to create order');
    }
  };

  const advanceStatus = async (order: any, status: 'Ordered' | 'Delivered' | 'Completed' | 'Cancelled') => {
    try {
      await api.updatePurchaseOrder(order.id, { status });
      logAction('update_status', 'purchaseOrder', { recordId: String(order.id), newValue: status });
      if (status === 'Completed') {
        try {
          const accounts: any[] = (await api.getAccounts()) as any[];
          const inventory = accounts.find((a) => String(a.name).toLowerCase().includes('inventory')) || accounts[0];
          if (inventory) {
            await api.createTransaction({
              date: new Date().toISOString().slice(0, 10),
              description: `Inventory purchase order ${order.order_id || order.id}`,
              account_id: inventory.id,
              debit: Number(order.total_amount || 0),
              credit: 0,
              reference: order.order_id || order.id,
            });
          }
        } catch (_e) { /* Ignore errors during transaction creation for completed orders */ }
      }
      await loadAll();
      toast.success('Status updated');
    } catch (_e) {
      toast.error('Failed to update status');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Purchase Orders</h1>
          <p className="text-muted-foreground">Create and track supplier orders</p>
        </div>
        <Dialog open={openCreate} onOpenChange={setOpenCreate}>
          <DialogTrigger asChild>
            <Button disabled={!hasPermission('purchaseOrder:add')}>New Order</Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Create Purchase Order</DialogTitle>
              <DialogDescription>Fill supplier and items</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Supplier</Label>
                  <select className="border rounded p-2 bg-background" value={newOrder.supplier_id} onChange={(e) => setNewOrder({ ...newOrder, supplier_id: e.target.value })}>
                    <option value="">Select supplier</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Order Date</Label>
                  <Input type="date" value={newOrder.order_date} onChange={(e) => setNewOrder({ ...newOrder, order_date: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Expected Delivery</Label>
                  <Input type="date" value={newOrder.expected_delivery_date} onChange={(e) => setNewOrder({ ...newOrder, expected_delivery_date: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Items</Label>
                  <Button variant="outline" size="sm" onClick={addItem}>Add Item</Button>
                </div>
                <div className="space-y-2">
                  {items.map((it, idx) => (
                    <div key={idx} className="grid grid-cols-4 gap-2">
                      <select className="border rounded p-2 bg-background" value={it.medicine_id} onChange={(e) => updateItem(idx, { medicine_id: e.target.value })}>
                        <option value="">Select medicine</option>
                        {medicines.map((m: any) => (
                          <option key={m.id} value={m.id}>{m.medicine_name || m.name}</option>
                        ))}
                      </select>
                      <Input type="number" min={1} value={it.quantity} onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })} />
                      <Input type="number" step="0.01" min={0} value={it.unit_price} onChange={(e) => updateItem(idx, { unit_price: Number(e.target.value) })} />
                      <Button variant="outline" onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}>Remove</Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpenCreate(false)}>Cancel</Button>
              <Button onClick={createOrder}>Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <ErrorBoundary fallbackTitle="Error loading Purchase Orders">
        <Card>
          <CardHeader>
            <CardTitle>Orders</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3 py-2" role="status" aria-label="Loading orders">
                <span className="sr-only">Loading orders...</span>
                <div className="flex items-center gap-4">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-16 ml-auto" />
                </div>
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-12"><p className="text-muted-foreground">No orders found.</p></div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Order Date</TableHead>
                      <TableHead>Expected Delivery</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((o) => (
                      <TableRow key={o.id}>
                        <TableCell>{o.order_id || o.id}</TableCell>
                        <TableCell>{suppliers.find((s) => s.id === o.supplier_id)?.name || o.supplier_id}</TableCell>
                        <TableCell>{o.order_date?.slice(0, 10)}</TableCell>
                        <TableCell>{o.expected_delivery_date?.slice(0, 10)}</TableCell>
                        <TableCell>{o.status}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={() => advanceStatus(o, 'Ordered')}>Approve</Button>
                            <Button variant="ghost" size="sm" onClick={() => advanceStatus(o, 'Completed')}>Complete</Button>
                            <Button variant="ghost" size="sm" onClick={() => advanceStatus(o, 'Cancelled')}>Cancel</Button>
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
      </ErrorBoundary>
    </div>
  );
}