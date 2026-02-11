import { useState, useRef, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ZoomIn, ZoomOut, Check, Crop, Square, RectangleHorizontal, RectangleVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageCropDialogProps {
  open: boolean;
  onClose: () => void;
  imageSrc: string;
  onCropComplete: (croppedFile: File) => void;
}

type AspectRatio = 'original' | '1:1' | '4:5' | '16:9';

const ASPECT_RATIOS: { key: AspectRatio; label: string; icon: typeof Square; value?: number }[] = [
  { key: 'original', label: 'Original', icon: Crop },
  { key: '1:1', label: '1:1', icon: Square, value: 1 },
  { key: '4:5', label: '4:5', icon: RectangleVertical, value: 4 / 5 },
  { key: '16:9', label: '16:9', icon: RectangleHorizontal, value: 16 / 9 },
];

const CONTAINER_SIZE = 320;
const MAX_OUTPUT = 1920;

const ImageCropDialog = ({ open, onClose, imageSrc, onCropComplete }: ImageCropDialogProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [baseScale, setBaseScale] = useState(1);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [imgNaturalSize, setImgNaturalSize] = useState({ w: 1, h: 1 });

  // Compute crop area dimensions
  const getCropDimensions = useCallback(() => {
    const ar = ASPECT_RATIOS.find(a => a.key === aspectRatio);
    if (!ar?.value) {
      // Original aspect ratio
      const img = imageRef.current;
      if (!img) return { width: CONTAINER_SIZE, height: CONTAINER_SIZE };
      const ratio = img.width / img.height;
      if (ratio > 1) {
        return { width: CONTAINER_SIZE, height: Math.round(CONTAINER_SIZE / ratio) };
      }
      return { width: Math.round(CONTAINER_SIZE * ratio), height: CONTAINER_SIZE };
    }
    const ratio = ar.value;
    if (ratio >= 1) {
      return { width: CONTAINER_SIZE, height: Math.round(CONTAINER_SIZE / ratio) };
    }
    return { width: Math.round(CONTAINER_SIZE * ratio), height: CONTAINER_SIZE };
  }, [aspectRatio]);

  // Load image
  useEffect(() => {
    if (!open || !imageSrc) return;
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      setImgNaturalSize({ w: img.width, h: img.height });
      setImageLoaded(true);
    };
    img.src = imageSrc;
    return () => { setImageLoaded(false); };
  }, [open, imageSrc]);

  // Recalculate base scale when aspect changes or image loads
  useEffect(() => {
    const img = imageRef.current;
    if (!img || !imageLoaded) return;
    const { width, height } = getCropDimensions();
    const scale = Math.max(width / img.width, height / img.height);
    setBaseScale(scale);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, [imageLoaded, aspectRatio, getCropDimensions]);

  // Draw preview
  const drawPreview = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    const { width, height } = getCropDimensions();
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    const scale = baseScale * zoom;
    const drawWidth = img.width * scale;
    const drawHeight = img.height * scale;
    const drawX = (width - drawWidth) / 2 + offset.x;
    const drawY = (height - drawHeight) / 2 + offset.y;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
  }, [zoom, offset, baseScale, getCropDimensions]);

  useEffect(() => {
    if (imageLoaded) drawPreview();
  }, [imageLoaded, drawPreview]);

  // Pointer handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const { width, height } = getCropDimensions();
    const maxDrag = Math.max(width, height) * 0.8;
    setOffset({
      x: Math.max(-maxDrag, Math.min(maxDrag, e.clientX - dragStart.x)),
      y: Math.max(-maxDrag, Math.min(maxDrag, e.clientY - dragStart.y)),
    });
  };

  const handlePointerUp = () => setIsDragging(false);

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    setZoom(prev => Math.max(0.5, Math.min(3, prev + delta)));
  };

  const handleConfirm = () => {
    const img = imageRef.current;
    if (!img) return;

    const { width, height } = getCropDimensions();

    // Output size: scale up to max while keeping aspect
    const outputScale = Math.min(MAX_OUTPUT / width, MAX_OUTPUT / height);
    const outW = Math.round(width * outputScale);
    const outH = Math.round(height * outputScale);

    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = outW;
    outputCanvas.height = outH;
    const ctx = outputCanvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, outW, outH);

    const scale = baseScale * zoom;
    const drawWidth = img.width * scale * outputScale;
    const drawHeight = img.height * scale * outputScale;
    const drawX = ((width - img.width * scale) / 2 + offset.x) * outputScale;
    const drawY = ((height - img.height * scale) / 2 + offset.y) * outputScale;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);

    outputCanvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], 'cropped.jpg', { type: 'image/jpeg', lastModified: Date.now() });
          onCropComplete(file);
        }
      },
      'image/jpeg',
      0.92
    );
  };

  const { width: cropW, height: cropH } = imageLoaded ? getCropDimensions() : { width: CONTAINER_SIZE, height: CONTAINER_SIZE };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="sm:max-w-[380px] p-0 gap-0 overflow-hidden"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="text-center text-base font-display">Crop Photo</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center px-4 pb-3 space-y-3">
          {/* Aspect Ratio Selector */}
          <div className="flex gap-1 bg-muted rounded-lg p-1">
            {ASPECT_RATIOS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setAspectRatio(key)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                  aspectRatio === key
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>

          {/* Crop Area */}
          <div
            className="relative bg-black/90 rounded-lg overflow-hidden flex items-center justify-center"
            style={{ width: CONTAINER_SIZE, height: CONTAINER_SIZE }}
          >
            {/* Grid overlay */}
            <div
              className="absolute pointer-events-none z-10 border border-white/20"
              style={{ width: cropW, height: cropH, left: (CONTAINER_SIZE - cropW) / 2, top: (CONTAINER_SIZE - cropH) / 2 }}
            >
              {/* Rule of thirds grid */}
              <div className="absolute inset-0" style={{ opacity: isDragging ? 0.4 : 0 , transition: 'opacity 0.2s' }}>
                <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/50" />
                <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/50" />
                <div className="absolute top-1/3 left-0 right-0 h-px bg-white/50" />
                <div className="absolute top-2/3 left-0 right-0 h-px bg-white/50" />
              </div>
            </div>

            {/* Dark mask outside crop */}
            <div className="absolute inset-0 pointer-events-none z-[5]">
              {/* Top */}
              <div className="absolute top-0 left-0 right-0 bg-black/60" style={{ height: (CONTAINER_SIZE - cropH) / 2 }} />
              {/* Bottom */}
              <div className="absolute bottom-0 left-0 right-0 bg-black/60" style={{ height: (CONTAINER_SIZE - cropH) / 2 }} />
              {/* Left */}
              <div className="absolute bg-black/60" style={{ top: (CONTAINER_SIZE - cropH) / 2, left: 0, width: (CONTAINER_SIZE - cropW) / 2, height: cropH }} />
              {/* Right */}
              <div className="absolute bg-black/60" style={{ top: (CONTAINER_SIZE - cropH) / 2, right: 0, width: (CONTAINER_SIZE - cropW) / 2, height: cropH }} />
            </div>

            {/* Canvas */}
            <canvas
              ref={canvasRef}
              width={cropW}
              height={cropH}
              className="cursor-grab active:cursor-grabbing touch-none z-[1]"
              style={{ width: cropW, height: cropH }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onWheel={handleWheel}
            />
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Drag to reposition • Scroll or slider to zoom
          </p>

          {/* Zoom Slider */}
          <div className="flex items-center gap-3 w-full max-w-[260px]">
            <ZoomOut className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <Slider
              value={[zoom]}
              onValueChange={([v]) => setZoom(v)}
              min={0.5}
              max={3}
              step={0.02}
              className="flex-1"
            />
            <ZoomIn className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 pb-4 flex gap-2">
          <Button variant="outline" size="sm" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleConfirm}
            className="flex-1 bg-gradient-to-r from-primary to-primary/80"
          >
            <Check className="w-4 h-4 mr-1" />
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ImageCropDialog;
