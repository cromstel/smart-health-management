import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ZoomIn, ZoomOut, RotateCcw, Maximize2, 
  ChevronLeft, ChevronRight, Grid, Info, Sun
} from 'lucide-react';
import { toast } from 'sonner';

interface DicomImage {
  id: string;
  modality: 'XR' | 'CT' | 'MR' | 'US';
  title: string;
  date: string;
  filePath: string;
  sliceThickness: string;
  kvp: string;
  windowWidth: string;
  windowCenter: string;
  accessionNumber: string;
  thumbnailUrl: string;
}

const SIMULATED_DICOM_SCANS: DicomImage[] = [
  {
    id: 'DCM-001',
    modality: 'XR',
    title: 'Chest PA View (Diagnostic)',
    date: '2026-08-14 09:15 AM',
    filePath: '/dicom/chest_xr_001.dcm',
    sliceThickness: 'N/A',
    kvp: '120 kV',
    windowWidth: '350',
    windowCenter: '40',
    accessionNumber: 'ACC-2026-8812',
    thumbnailUrl: 'https://images.unsplash.com/photo-1559757175-5700dde675bc?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'DCM-002',
    modality: 'CT',
    title: 'High-Resolution Brain CT (Axial)',
    date: '2026-08-28 14:30 PM',
    filePath: '/dicom/brain_ct_042.dcm',
    sliceThickness: '1.25 mm',
    kvp: '140 kV',
    windowWidth: '80',
    windowCenter: '40',
    accessionNumber: 'ACC-2026-9041',
    thumbnailUrl: 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'DCM-003',
    modality: 'MR',
    title: 'Lumbar Spine T2-Weighted (Sagittal)',
    date: '2026-09-02 11:00 AM',
    filePath: '/dicom/l_spine_mr_109.dcm',
    sliceThickness: '3.0 mm',
    kvp: 'N/A',
    windowWidth: '1200',
    windowCenter: '600',
    accessionNumber: 'ACC-2026-9912',
    thumbnailUrl: 'https://images.unsplash.com/photo-1559757175-047ee4de88e8?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'DCM-004',
    modality: 'US',
    title: 'Carotid Duplex Ultrasound (Right)',
    date: '2026-09-05 16:15 PM',
    filePath: '/dicom/carotid_us_012.dcm',
    sliceThickness: 'N/A',
    kvp: 'N/A',
    windowWidth: '256',
    windowCenter: '128',
    accessionNumber: 'ACC-2026-1025',
    thumbnailUrl: 'https://images.unsplash.com/photo-1516062423079-7ca13cca7794?w=600&auto=format&fit=crop&q=80'
  }
];

interface DicomGalleryProps {
  patientId: string;
  patientName: string;
}

export const DicomGallery: React.FC<DicomGalleryProps> = ({ patientId, patientName }) => {
  const [selectedScan, setSelectedScan] = useState<DicomImage>(SIMULATED_DICOM_SCANS[0]);
  const [zoom, setZoom] = useState<number>(100);
  const [contrast, setContrast] = useState<number>(100);
  const [brightness, setBrightness] = useState<number>(100);
  const [rotation, setRotation] = useState<number>(0);
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);
  const [showMetadata, setShowMetadata] = useState<boolean>(true);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 10, 250));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 10, 50));
  
  const resetAdjustments = () => {
    setZoom(100);
    setContrast(100);
    setBrightness(100);
    setRotation(0);
    toast.success('Visual attributes reset to system default (DICOM LUT).');
  };

  const handleNextScan = () => {
    const currentIndex = SIMULATED_DICOM_SCANS.findIndex(s => s.id === selectedScan.id);
    const nextIndex = (currentIndex + 1) % SIMULATED_DICOM_SCANS.length;
    setSelectedScan(SIMULATED_DICOM_SCANS[nextIndex]);
    resetAdjustments();
  };

  const handlePrevScan = () => {
    const currentIndex = SIMULATED_DICOM_SCANS.findIndex(s => s.id === selectedScan.id);
    const prevIndex = (currentIndex - 1 + SIMULATED_DICOM_SCANS.length) % SIMULATED_DICOM_SCANS.length;
    setSelectedScan(SIMULATED_DICOM_SCANS[prevIndex]);
    resetAdjustments();
  };

  return (
    <Card className="border border-slate-200 shadow-sm bg-white overflow-hidden" id="dicom-viewer-card">
      <CardHeader className="border-b border-slate-100 bg-slate-50/50 py-4" id="dicom-card-header">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge className="bg-slate-900 text-white font-bold text-[10px]">DICOM COMPATIBLE</Badge>
              <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-1.5">
                <Grid className="h-4.5 w-4.5 text-slate-600" />
                Diagnostic Image Study Gallery
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-slate-500">
              Review PACS diagnostic medical scans with zoom, window, and real-time contrast controls for {patientName}.
            </CardDescription>
          </div>
          <div className="flex items-center gap-1.5 self-start sm:self-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowMetadata(!showMetadata)}
              className="text-xs h-8 gap-1 border-slate-200 text-slate-600 font-medium"
            >
              <Info className="h-3.5 w-3.5" />
              <span>{showMetadata ? 'Hide Metadata' : 'Show Metadata'}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="text-xs h-8 gap-1 border-slate-200 text-slate-600 font-medium"
            >
              <Maximize2 className="h-3.5 w-3.5" />
              <span>{isFullScreen ? 'Exit Window' : 'Maximize Study'}</span>
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className={`grid ${isFullScreen ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-12'} bg-slate-950 text-slate-100 min-h-[500px]`}>
          
          {/* Main PACS Monitor Display Screen */}
          <div className="lg:col-span-8 flex flex-col relative border-b lg:border-b-0 lg:border-r border-slate-900 bg-black overflow-hidden h-[500px]">
            {/* Study Overview Badge */}
            <div className="absolute top-4 left-4 z-10 bg-slate-950/80 backdrop-blur-md border border-slate-800 py-1.5 px-3 rounded-lg text-xs space-y-0.5">
              <div className="font-bold text-sky-400 text-[10px] uppercase tracking-wider">Active Patient Context</div>
              <div className="font-semibold text-slate-200">{patientName}</div>
              <div className="text-[10px] text-slate-400 font-mono">ID: {patientId} • ACC: {selectedScan.accessionNumber}</div>
            </div>

            {/* Calibration details */}
            <div className="absolute bottom-4 left-4 z-10 bg-slate-950/80 backdrop-blur-md border border-slate-800 py-1.5 px-3 rounded-lg text-[10px] font-mono text-slate-400 space-y-0.5">
              <div>Modality: {selectedScan.modality}</div>
              <div>Slice: {selectedScan.sliceThickness}</div>
              <div>KVp: {selectedScan.kvp}</div>
              <div>LUT: Linear Monochromatic</div>
            </div>

            {/* Quick Next/Prev arrows overlaid */}
            <div className="absolute inset-y-0 left-2 flex items-center z-10">
              <Button
                variant="outline"
                size="icon"
                onClick={handlePrevScan}
                className="h-8 w-8 rounded-full bg-slate-900/80 hover:bg-slate-800 text-white border-slate-850 hover:text-white"
              >
                <ChevronLeft className="h-4.5 w-4.5" />
              </Button>
            </div>
            <div className="absolute inset-y-0 right-2 flex items-center z-10">
              <Button
                variant="outline"
                size="icon"
                onClick={handleNextScan}
                className="h-8 w-8 rounded-full bg-slate-900/80 hover:bg-slate-800 text-white border-slate-850 hover:text-white"
              >
                <ChevronRight className="h-4.5 w-4.5" />
              </Button>
            </div>

            {/* Canvas/Stage Image Container */}
            <div className="flex-1 flex items-center justify-center p-4 relative overflow-hidden">
              <img
                src={selectedScan.thumbnailUrl}
                alt={selectedScan.title}
                style={{
                  transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                  filter: `contrast(${contrast}%) brightness(${brightness}%) grayscale(100%)`,
                  transition: 'transform 0.15s ease-out, filter 0.1s ease-out'
                }}
                className="max-h-[85%] max-w-[85%] object-contain select-none"
                referrerPolicy="no-referrer"
              />
            </div>
            
            {/* Quick bottom HUD controls */}
            <div className="p-3 bg-slate-950/90 border-t border-slate-900 flex items-center justify-between gap-4 z-10 text-xs">
              <span className="font-semibold text-slate-300">{selectedScan.title}</span>
              <div className="flex items-center gap-1.5">
                <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-white hover:bg-slate-900" onClick={handleZoomOut}>
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="font-mono text-[10px] text-slate-400">{zoom}%</span>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-white hover:bg-slate-900" onClick={handleZoomIn}>
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-white hover:bg-slate-900" onClick={() => setRotation(r => (r + 90) % 360)}>
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Sidebar Panel for Clinical Adjustment Controls & Metadata */}
          <div className="lg:col-span-4 flex flex-col h-[500px] overflow-y-auto bg-slate-900 border-slate-850">
            {/* Scans Selector List */}
            <div className="p-4 border-b border-slate-800">
              <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Study Series Scans</h5>
              <div className="grid grid-cols-4 gap-2">
                {SIMULATED_DICOM_SCANS.map((scan) => {
                  const isActive = scan.id === selectedScan.id;
                  return (
                    <button
                      key={scan.id}
                      onClick={() => { setSelectedScan(scan); resetAdjustments(); }}
                      className={`relative aspect-square rounded-lg overflow-hidden border transition-all duration-200 ${
                        isActive 
                          ? 'border-sky-500 ring-2 ring-sky-500/25' 
                          : 'border-slate-800 hover:border-slate-600'
                      }`}
                    >
                      <img
                        src={scan.thumbnailUrl}
                        alt={scan.title}
                        className="w-full h-full object-cover grayscale brightness-90"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-white bg-slate-950/80 px-1.5 py-0.5 rounded">
                          {scan.modality}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* PACS Window LUT Adjustments Panel */}
            <div className="p-4 border-b border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">PACS Calibrations</h5>
                <Button
                  variant="ghost"
                  onClick={resetAdjustments}
                  className="h-6 text-[10px] text-sky-400 hover:text-sky-300 p-0 hover:bg-transparent"
                >
                  Reset Default
                </Button>
              </div>

              {/* Contrast Adjustment */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold text-slate-300">
                  <span className="flex items-center gap-1">
                    <Sun className="h-3 w-3 text-amber-400" />
                    Contrast Level
                  </span>
                  <span className="font-mono text-[10px]">{contrast}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="200"
                  step="5"
                  value={contrast}
                  onChange={(e) => setContrast(Number(e.target.value))}
                  className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
                />
              </div>

              {/* Brightness Adjustment */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold text-slate-300">
                  <span>Display Brightness</span>
                  <span className="font-mono text-[10px]">{brightness}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="150"
                  step="5"
                  value={brightness}
                  onChange={(e) => setBrightness(Number(e.target.value))}
                  className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
                />
              </div>
            </div>

            {/* DICOM File Metadata Header */}
            {showMetadata && (
              <div className="p-4 space-y-3 flex-1">
                <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">DICOM Meta Header</h5>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">SOP Instance UID</span>
                    <span className="font-mono text-[10px] text-slate-200">1.2.840.113619.2.{selectedScan.id}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">Accession Number</span>
                    <span className="font-mono text-[10px] text-slate-200">{selectedScan.accessionNumber}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">Modality Study</span>
                    <span className="font-semibold text-slate-200">{selectedScan.modality} Study</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">Calibration Window</span>
                    <span className="text-slate-200 text-[10px] font-mono">WW: {selectedScan.windowWidth} WL: {selectedScan.windowCenter}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">Scan Series Timestamp</span>
                    <span className="text-slate-200">{selectedScan.date}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">Primary PACS Storage</span>
                    <span className="text-slate-200 font-mono text-[10px]">{selectedScan.filePath}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
          
        </div>
      </CardContent>
    </Card>
  );
};
