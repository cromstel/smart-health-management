import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  TrendingDown,
  AlertTriangle,
  PackageCheck,
  Sparkles,
  Search,
  ShoppingCart,
  Layers,
  TrendingUp,
  Building2,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';

/**
 * A medicine without any movement inside the lookback window has no burn
 * rate that can be derived, so it is reported as UNKNOWN instead of being
 * given an invented number.
 */
type RiskLevel = 'CRITICAL' | 'HIGH' | 'HEALTHY' | 'UNKNOWN';

interface ForecastItem {
  id: string;
  name: string;
  category: string;
  currentStock: number;
  minStock: number;
  dailyBurnRate: number; // units per day
  daysOfSupply: number | null;
  predictedDepletionDate: string;
  riskLevel: RiskLevel;
  suggestedReorderQty: number;
  unitPrice: number;
  supplier: string;
  /** `suppliers.id` of the medicine, or null when no supplier is on file. */
  supplierId: number | null;
  historicalTrend: { day: string; usage: number; projectedStock: number }[];
  dataStatus: 'ok' | 'insufficient_history';
}

interface ForecastResponse {
  items: ForecastItem[];
  meta?: {
    surgeMultiplier: number;
    lookbackDays: number;
    targetCoverDays: number;
    generatedAt: string;
    withUsageHistory: number;
    withoutUsageHistory: number;
  };
}

/**
 * The API base URL.
 *
 * Mirrors the rule the shared API client uses: in development the default
 * 5600 port is replaced by the same-origin `/api` proxy when it is not
 * running.
 */
const configuredUrl = import.meta.env.VITE_API_URL || '/api';
const API_BASE_URL =
  import.meta.env.DEV && configuredUrl.includes('localhost:5600') ? '/api' : configuredUrl;

/** A thin authenticated fetch. The server skips the CSRF check for bearer requests. */
const request = async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: 'Request failed' }));
    const message =
      body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
        ? body.error
        : 'Request failed';
    throw new Error(message);
  }

  return (await response.json()) as T;
};

export function InventoryForecastingModule() {
  const { hasPermission } = useAuth();
  const [items, setItems] = useState<ForecastItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState<string>('ALL');
  const [seasonalSurgeMultiplier, setSeasonalSurgeMultiplier] = useState<number>(1.2); // 20% surge factor
  const [selectedItemForChart, setSelectedItemForChart] = useState<ForecastItem | null>(null);
  const [isGeneratingOrders, setIsGeneratingOrders] = useState(false);
  const requestRef = useRef(0);

  /**
   * The forecast is computed on the server from the real movement history.
   * The surge factor is a query parameter, not a browser side multiplier.
   */
  const loadForecast = useCallback(async (multiplier: number) => {
    const requestId = ++requestRef.current;
    try {
      setIsLoading(true);
      const data = await request<ForecastResponse>(
        `/pharmacy/forecast?surgeMultiplier=${encodeURIComponent(String(multiplier))}`
      );
      if (requestId !== requestRef.current) return;

      const next = data?.items ?? [];
      setItems(next);
      setSelectedItemForChart((previous) => {
        if (previous) {
          const refreshed = next.find((item) => item.id === previous.id);
          if (refreshed) return refreshed;
        }
        return next[0] ?? null;
      });
      setLoadError(null);
    } catch (error) {
      if (requestId !== requestRef.current) return;
      const message = error instanceof Error ? error.message : 'Failed to load the forecast';
      setItems([]);
      setSelectedItemForChart(null);
      setLoadError(message);
      toast.error(`Failed to load the inventory forecast: ${message}`);
    } finally {
      if (requestId === requestRef.current) setIsLoading(false);
    }
  }, []);

  // Re-fetch when the surge factor changes. The slider is debounced so a
  // drag does not fire a request per step.
  useEffect(() => {
    const timer = setTimeout(() => {
      loadForecast(seasonalSurgeMultiplier);
    }, 300);
    return () => clearTimeout(timer);
  }, [seasonalSurgeMultiplier, loadForecast]);

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.supplier.toLowerCase().includes(searchQuery.toLowerCase());

    if (riskFilter === 'ALL') return matchesSearch;
    return matchesSearch && item.riskLevel === riskFilter;
  });

  const criticalCount = items.filter((i) => i.riskLevel === 'CRITICAL').length;
  const highCount = items.filter((i) => i.riskLevel === 'HIGH').length;
  const unknownCount = items.filter((i) => i.riskLevel === 'UNKNOWN').length;
  const totalSuggestedCost = items.reduce((sum, i) => sum + i.suggestedReorderQty * i.unitPrice, 0);
  const reorderableCount = items.filter((i) => i.suggestedReorderQty > 0).length;

  const handleAutoGeneratePurchaseOrders = async () => {
    if (!hasPermission('purchaseOrder:add')) {
      toast.error('You are not allowed to create purchase orders');
      return;
    }

    const reorderItems = items.filter((i) => i.suggestedReorderQty > 0);
    if (reorderItems.length === 0) {
      toast.info('No restock orders are required');
      return;
    }

    setIsGeneratingOrders(true);
    const toastId = toast.loading('Calculating optimal stock levels and generating Purchase Orders...');

    try {
      // One purchase order per supplier, using the supplier the inventory
      // row actually points at.
      const bySupplier = new Map<number, ForecastItem[]>();
      const withoutSupplier: ForecastItem[] = [];

      for (const item of reorderItems) {
        if (item.supplierId === null || item.supplierId === undefined) {
          withoutSupplier.push(item);
          continue;
        }
        const bucket = bySupplier.get(item.supplierId);
        if (bucket) bucket.push(item);
        else bySupplier.set(item.supplierId, [item]);
      }

      const order_date = new Date().toISOString().slice(0, 10);
      const expected_delivery_date = new Date(
        Date.now() + 5 * 24 * 60 * 60 * 1000
      ).toISOString().slice(0, 10);

      const failures: string[] = [];
      let createdOrders = 0;

      for (const [supplierId, supplierItems] of bySupplier) {
        try {
          await api.createPurchaseOrder({
            supplier_id: supplierId,
            order_date,
            expected_delivery_date,
            items: supplierItems.map((r) => ({
              medicine_id: r.id,
              quantity: r.suggestedReorderQty,
              unit_price: r.unitPrice,
            })),
          });
          createdOrders += 1;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'unknown error';
          failures.push(`${supplierItems[0]?.supplier ?? `Supplier ${supplierId}`}: ${message}`);
        }
      }

      if (failures.length > 0) {
        toast.error(
          `Failed to create ${failures.length} purchase order${failures.length === 1 ? '' : 's'}`,
          { id: toastId, description: failures.join(' · ') }
        );
        return;
      }

      if (withoutSupplier.length > 0) {
        toast.warning(
          `Created ${createdOrders} purchase order${createdOrders === 1 ? '' : 's'}`,
          {
            id: toastId,
            description: `${withoutSupplier.length} item(s) skipped — no supplier on file: ${withoutSupplier
              .map((i) => i.name)
              .join(', ')}`,
          }
        );
        return;
      }

      toast.success(`Generated ${reorderItems.length} Restock Purchase Orders!`, {
        id: toastId,
        description: `Total estimated procurement cost: $${totalSuggestedCost.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}. Transferred to Purchase Orders queue.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      toast.error(`Failed to dispatch purchase orders: ${message}`, { id: toastId });
    } finally {
      setIsGeneratingOrders(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Banner */}
      <div className="p-4 rounded-xl bg-primary border border-info/30 text-primary-foreground shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-info/20 border border-info/30 text-indigo-300">
            <Sparkles className="h-7 w-7 text-info animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight text-primary-foreground flex items-center gap-2">
                Predictive AI Inventory Forecasting
              </h2>
              <Badge className="bg-info text-info-foreground font-mono text-[10px]">30-DAY BURN ENGINE</Badge>
            </div>
            <p className="text-xs text-info/80 mt-0.5">
              Analyzes historical consumption velocity to predict medication stockout dates and auto-generate restock purchase orders
            </p>
          </div>
        </div>

        <Button
          onClick={handleAutoGeneratePurchaseOrders}
          disabled={isGeneratingOrders || reorderableCount === 0}
          className="bg-info hover:bg-info text-info-foreground font-bold text-xs h-10 px-4 shadow-lg gap-2 shrink-0 border border-info/30"
        >
          <ShoppingCart className="h-4 w-4" />
          <span>Auto-Generate Restock Orders (${totalSuggestedCost.toLocaleString(undefined, { maximumFractionDigits: 0 })})</span>
        </Button>
      </div>

      {/* Analytics Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-destructive/30 bg-destructive/10">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-destructive uppercase tracking-wider">Critical Shortages (≤3 Days)</p>
              <p className="text-2xl font-black text-destructive dark:text-destructive">{criticalCount} Medications</p>
            </div>
            <AlertTriangle className="h-7 w-7 text-destructive animate-bounce" />
          </CardContent>
        </Card>

        <Card className="border-warning/30 bg-warning/10">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-warning uppercase tracking-wider">High Risk Stock (≤7 Days)</p>
              <p className="text-2xl font-black text-warning">{highCount} Medications</p>
            </div>
            <TrendingDown className="h-7 w-7 text-warning" />
          </CardContent>
        </Card>

        <Card className="border-info/30 bg-info/10">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-info uppercase tracking-wider">Seasonal Demand Surge</p>
              <p className="text-2xl font-black text-info">{(seasonalSurgeMultiplier * 100 - 100).toFixed(0)}% Surge</p>
            </div>
            <TrendingUp className="h-7 w-7 text-info" />
          </CardContent>
        </Card>

        <Card className="border-success/30 bg-success/10">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-success uppercase tracking-wider">Auto-Order Procurement</p>
              <p className="text-2xl font-black text-success">${totalSuggestedCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            </div>
            <PackageCheck className="h-7 w-7 text-success" />
          </CardContent>
        </Card>
      </div>

      {/* Main Grid: Forecast Table & Interactive Burn Trajectory Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 8 Cols: Forecast Inventory List */}
        <div className="lg:col-span-8 space-y-4">
          <Card>
            <CardHeader className="pb-3 border-b">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Layers className="h-4 w-4 text-info" />
                    Medication Consumption & Shortage Predictions
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Real-time depletion projections calculated from daily prescription velocity
                  </CardDescription>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative w-44">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search medication..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-8 pl-8 text-xs"
                    />
                  </div>

                  <Select value={riskFilter} onValueChange={setRiskFilter}>
                    <SelectTrigger className="h-8 text-xs w-32">
                      <SelectValue placeholder="Filter Risk" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Risk Levels</SelectItem>
                      <SelectItem value="CRITICAL">🔴 Critical (≤3d)</SelectItem>
                      <SelectItem value="HIGH">🟡 High (≤7d)</SelectItem>
                      <SelectItem value="HEALTHY">🟢 Healthy (&gt;7d)</SelectItem>
                      <SelectItem value="UNKNOWN">⚪ Unknown</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Seasonal Factor Slider Controls */}
              <div className="mt-3 p-3 rounded-lg bg-info/10 border border-info/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div>
                  <span className="font-semibold text-foreground block">Seasonal Surge Factor Simulation</span>
                  <span className="text-muted-foreground text-[11px]">Simulate disease outbreak or emergency influx demand changes</span>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <input
                    type="range"
                    value={seasonalSurgeMultiplier}
                    min={0.8}
                    max={2.0}
                    step={0.1}
                    onChange={(e) => setSeasonalSurgeMultiplier(parseFloat(e.target.value))}
                    className="w-32 accent-info h-2 bg-muted rounded-lg cursor-pointer"
                  />
                  <span className="font-mono font-bold text-info dark:text-info w-12 text-right">
                    {seasonalSurgeMultiplier.toFixed(1)}x
                  </span>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Medication / Category</TableHead>
                    <TableHead className="text-xs text-right">Current Stock</TableHead>
                    <TableHead className="text-xs text-right">Burn Rate</TableHead>
                    <TableHead className="text-xs text-right">Days Supply</TableHead>
                    <TableHead className="text-xs">Depletion Date</TableHead>
                    <TableHead className="text-xs text-right">Suggested Restock</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-xs text-muted-foreground">
                        Loading the inventory forecast…
                      </TableCell>
                    </TableRow>
                  ) : loadError ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-xs text-destructive">
                        {loadError}
                      </TableCell>
                    </TableRow>
                  ) : filteredItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-xs text-muted-foreground">
                        {items.length === 0
                          ? 'No medicines are in the inventory yet.'
                          : 'No medication matches the current filter.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredItems.map((item) => (
                      <TableRow
                        key={item.id}
                        onClick={() => setSelectedItemForChart(item)}
                        className={`cursor-pointer transition-colors ${
                          selectedItemForChart?.id === item.id ? 'bg-info/10' : ''
                        }`}
                      >
                        <TableCell>
                          <div className="space-y-0.5">
                            <span className="font-bold text-xs text-foreground block">{item.name}</span>
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Building2 className="h-3 w-3 text-muted-foreground" /> {item.supplier || 'No supplier'} • {item.category}
                            </span>
                          </div>
                        </TableCell>

                        <TableCell className="text-right font-mono font-semibold text-xs">
                          {item.currentStock} units
                        </TableCell>

                        <TableCell className="text-right font-mono text-xs text-muted-foreground">
                          {item.dailyBurnRate}/day
                        </TableCell>

                        <TableCell className="text-right">
                          <Badge
                            className={`font-bold font-mono text-[10px] ${
                              item.riskLevel === 'CRITICAL'
                                ? 'bg-destructive text-destructive-foreground animate-pulse'
                                : item.riskLevel === 'HIGH'
                                ? 'bg-warning text-black'
                                : item.riskLevel === 'UNKNOWN'
                                ? 'bg-muted text-muted-foreground'
                                : 'bg-success text-success-foreground'
                            }`}
                          >
                            {item.daysOfSupply === null ? 'No history' : `${item.daysOfSupply} Days`}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-xs text-muted-foreground font-mono">
                          {item.predictedDepletionDate}
                        </TableCell>

                        <TableCell className="text-right font-mono text-xs">
                          {item.suggestedReorderQty > 0 ? (
                            <span className="font-bold text-info dark:text-info">
                              +{item.suggestedReorderQty} units
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Optimal</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              {unknownCount > 0 && (
                <p className="px-4 py-2 text-[10px] text-muted-foreground">
                  {unknownCount} medication(s) had no movement in the lookback window, so no burn rate could be
                  derived. They are excluded from the risk ranking and from restock suggestions.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right 4 Cols: Trajectory Chart & Supplier Action Panel */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="border-info/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold flex items-center justify-between">
                <span>Depletion Trajectory</span>
                <Badge variant="outline" className="text-[10px] border-info text-info">
                  {selectedItemForChart?.id ?? '--'}
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                Projected stock curve for <strong>{selectedItemForChart?.name ?? 'no medication selected'}</strong>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={selectedItemForChart?.historicalTrend ?? []}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', fontSize: '11px' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="projectedStock"
                      stroke="#6366f1"
                      strokeWidth={3}
                      dot={{ r: 4, fill: '#6366f1' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Detail Card Summary */}
              <div className="p-3 rounded-lg bg-muted/40 border text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Supplier:</span>
                  <span className="font-semibold text-foreground">{selectedItemForChart?.supplier || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Unit Cost:</span>
                  <span className="font-mono font-bold text-foreground">
                    ${(selectedItemForChart?.unitPrice ?? 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Recommended Order:</span>
                  <span className="font-mono font-bold text-info dark:text-info">
                    {selectedItemForChart?.suggestedReorderQty ?? 0} units ($
                    {((selectedItemForChart?.suggestedReorderQty ?? 0) * (selectedItemForChart?.unitPrice ?? 0)).toFixed(2)})
                  </span>
                </div>
              </div>

              <Button
                size="sm"
                className="w-full text-xs font-bold bg-info hover:bg-info text-info-foreground gap-1.5"
                disabled={!selectedItemForChart || selectedItemForChart.suggestedReorderQty <= 0}
                onClick={() => {
                  if (!selectedItemForChart) return;
                  toast.success(`Drafted order for ${selectedItemForChart.name} (${selectedItemForChart.suggestedReorderQty} units)`);
                }}
              >
                <ShoppingCart className="h-3.5 w-3.5" />
                <span>Quick Reorder This Item</span>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
