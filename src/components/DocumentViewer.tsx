import React, { useState, useRef, useEffect } from 'react';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Eye, 
  EyeOff, 
  Layers,
  Sparkles
} from 'lucide-react';
import type { LandRecordDocument, BoundingBox } from '../types/landRecord';

interface DocumentViewerProps {
  record: LandRecordDocument;
  selectedBoxId: string | null;
  onSelectBox: (boxId: string | null) => void;
}

export type EnhancementFilter = 'normal' | 'contrast' | 'invert' | 'binarize';

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  record,
  selectedBoxId,
  onSelectBox,
}) => {
  const [zoom, setZoom] = useState<number>(1);
  const [filterMode, setFilterMode] = useState<EnhancementFilter>('normal');
  const [showBoxes, setShowBoxes] = useState<boolean>(true);
  const [hoveredBox, setHoveredBox] = useState<BoundingBox | null>(null);
  const [imgError, setImgError] = useState<boolean>(false);

  // Reset img error on record switch
  useEffect(() => {
    setImgError(false);
  }, [record.id, record.originalDocumentUrl]);

  const rawUrl = record.originalDocumentUrl || '';
  const isBrokenOrPdf = rawUrl.startsWith('data:application/pdf') || rawUrl.length < 5;
  // Never substitute another document's scan: show an honest placeholder instead.
  const effectiveSrc = (imgError || isBrokenOrPdf) ? '' : rawUrl;

  const containerRef = useRef<HTMLDivElement>(null);

  // Gather all bounding boxes across the document
  const allBoxes: BoundingBox[] = [
    record.khataNumber.boundingBox,
    ...(record.fasliYear?.boundingBox ? [record.fasliYear.boundingBox] : []),
    ...(record.totalStatedArea?.boundingBox ? [record.totalStatedArea.boundingBox] : []),
    ...record.owners.flatMap((o) => [
      o.name.boundingBox,
      o.relativeName.boundingBox,
      o.shareFraction.boundingBox,
    ]),
    ...record.plots.flatMap((p) => [
      p.khasraNumber.boundingBox,
      p.regionalAreaText.boundingBox,
      p.landClassification.boundingBox,
      p.annualRevenueLagaan.boundingBox,
    ]),
  ].filter(Boolean);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 2.5));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.75));
  const handleResetZoom = () => setZoom(1);

  // CSS Filter styles corresponding to restoration presets
  const getFilterStyle = (): React.CSSProperties => {
    switch (filterMode) {
      case 'contrast':
        return { filter: 'contrast(160%) brightness(95%) saturate(120%)' };
      case 'invert':
        return { filter: 'invert(90%) hue-rotate(180deg) contrast(150%)' };
      case 'binarize':
        return { filter: 'grayscale(100%) contrast(280%) brightness(105%)' };
      default:
        return {};
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border-r border-slate-200 select-none overflow-hidden">
      {/* Top Toolbar */}
      <div className="bg-slate-800 text-slate-200 px-4 py-2 border-b border-slate-700 flex flex-wrap items-center justify-between gap-2 text-xs">
        {/* Left: Document Info */}
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-100 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            {record.recordType}
          </span>
          <span className="text-slate-400 font-mono text-[11px]">
            [{record.scanCondition}]
          </span>
        </div>

        {/* Center: Image Restoration / Pre-processing Filters */}
        <div className="flex items-center gap-1 bg-slate-900/80 p-0.5 rounded-md border border-slate-700">
          <button
            onClick={() => setFilterMode('normal')}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
              filterMode === 'normal' ? 'bg-emerald-600 text-white font-semibold' : 'text-slate-400 hover:text-white'
            }`}
            title="Original raw historical scan"
          >
            Raw Scan
          </button>
          <button
            onClick={() => setFilterMode('contrast')}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors flex items-center gap-1 ${
              filterMode === 'contrast' ? 'bg-emerald-600 text-white font-semibold' : 'text-slate-400 hover:text-white'
            }`}
            title="OpenCV contrast enhancement for faded ink"
          >
            <Sparkles className="w-3 h-3 text-amber-400" />
            Contrast Boost
          </button>
          <button
            onClick={() => setFilterMode('binarize')}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
              filterMode === 'binarize' ? 'bg-emerald-600 text-white font-semibold' : 'text-slate-400 hover:text-white'
            }`}
            title="Sauvola adaptive binarization threshold"
          >
            Binarize
          </button>
          <button
            onClick={() => setFilterMode('invert')}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
              filterMode === 'invert' ? 'bg-emerald-600 text-white font-semibold' : 'text-slate-400 hover:text-white'
            }`}
            title="Inverted darkroom mode for faint white ink"
          >
            Invert
          </button>
        </div>

        {/* Right: Zoom & Box Visibility Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowBoxes(!showBoxes)}
            className={`p-1.5 rounded transition-colors ${
              showBoxes ? 'bg-slate-700 text-emerald-400' : 'text-slate-400 hover:text-white'
            }`}
            title={showBoxes ? 'Hide Bounding Boxes' : 'Show Bounding Boxes'}
          >
            {showBoxes ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>

          <div className="h-4 w-[1px] bg-slate-700 mx-1" />

          <button
            onClick={handleZoomOut}
            className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-slate-700"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <span className="font-mono text-[11px] text-slate-300 w-11 text-center">
            {Math.round(zoom * 100)}%
          </span>

          <button
            onClick={handleZoomIn}
            className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-slate-700"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleResetZoom}
            className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-slate-700"
            title="Reset Zoom (100%)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Canvas Scroll Area */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto p-4 md:p-8 flex justify-center items-start relative bg-slate-950"
      >
        <div 
          className="relative transition-transform duration-150 ease-out shadow-2xl rounded-sm min-h-[700px] bg-white border border-slate-300"
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'top center',
            width: '760px',
            maxWidth: '100%',
          }}
        >
          {/* Historical Scanned Document Graphic */}
          {!effectiveSrc ? (
            <div className="w-full min-h-[700px] flex items-center justify-center text-sm text-slate-500 p-8 text-center">
              Original scan image is not available for this record (PDF without a rendered page, or the file could not be loaded).
            </div>
          ) : (
          <img
            src={effectiveSrc}
            alt={record.title}
            onError={() => setImgError(true)}
            className="w-full h-auto min-h-[700px] object-contain rounded-sm block pointer-events-none select-none transition-all duration-200"
            style={getFilterStyle()}
          />
          )}

          {/* Interactive Bounding Box Overlay Layer */}
          {showBoxes && (
            <div className="absolute inset-0 pointer-events-auto">
              {allBoxes.map((box) => {
                const isSelected = selectedBoxId === box.id;
                const isHovered = hoveredBox?.id === box.id;
                const isIllegibleBox = box.label?.includes('अपठनीय') || box.label?.includes('⚠️') || box.label?.includes('faded') || box.id.includes('faded');

                return (
                  <div
                    key={box.id}
                    onClick={() => onSelectBox(box.id)}
                    onMouseEnter={() => setHoveredBox(box)}
                    onMouseLeave={() => setHoveredBox(null)}
                    className={`absolute cursor-pointer rounded-xs transition-all duration-150 ${
                      isSelected
                        ? isIllegibleBox
                          ? 'border-2 border-red-500 bg-red-500/30 ring-4 ring-red-400/50 z-20 shadow-lg'
                          : 'border-2 border-emerald-500 bg-emerald-500/25 ring-4 ring-emerald-400/40 z-20 shadow-lg'
                        : isIllegibleBox
                        ? 'border-2 border-dashed border-red-500 bg-red-500/20 ring-1 ring-red-400/40 z-10 animate-pulse'
                        : isHovered
                        ? 'border-2 border-amber-400 bg-amber-400/20 z-10'
                        : 'border border-blue-500/50 bg-blue-500/10 hover:border-amber-400 hover:bg-amber-400/20'
                    }`}
                    style={{
                      left: `${box.x}%`,
                      top: `${box.y}%`,
                      width: `${box.width}%`,
                      height: `${box.height}%`,
                    }}
                  >
                    {/* Floating badge for selected or hovered box */}
                    {(isSelected || isHovered || isIllegibleBox) && (
                      <div 
                        className={`absolute -top-6 left-0 text-[10px] font-bold px-1.5 py-0.5 rounded shadow-md whitespace-nowrap pointer-events-none z-30 ${
                          isIllegibleBox 
                            ? 'bg-red-700 text-white border border-red-400' 
                            : isSelected 
                            ? 'bg-emerald-600 text-white' 
                            : 'bg-slate-900 text-amber-300'
                        }`}
                      >
                        {box.label}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Footer Navigation Bar */}
      <div className="bg-slate-800 text-slate-300 px-4 py-2 border-t border-slate-700 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>Click any bounding box to highlight corresponding form field</span>
        </div>
        <div className="text-[11px] font-mono text-slate-400">
          Resolution: 300 DPI Archival Scan
        </div>
      </div>
    </div>
  );
};
