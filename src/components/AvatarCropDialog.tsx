import { useState, useRef, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ZoomIn, ZoomOut, Check, RotateCcw } from 'lucide-react';

interface AvatarCropDialogProps {
  open: boolean;
  onClose: () => void;
  imageSrc: string;
  onCropComplete: (croppedFile: File) => void;
}

const CROP_SIZE = 280; // Circle diameter in pixels
const OUTPUT_SIZE = 512; // Output image size in pixels

const AvatarCropDialog = ({ open, onClose, imageSrc, onCropComplete }: AvatarCropDialogProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [baseScale, setBaseScale] = useState(1);

  // Load image when dialog opens
  useEffect(() => {
    if (!open || !imageSrc) return;
    
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      // Calculate base scale to fit image into crop area (cover)
      const scale = Math.max(CROP_SIZE / img.width, CROP_SIZE / img.height);
      setBaseScale(scale);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setImageLoaded(true);
    };
    img.src = imageSrc;

    return () => {
      setImageLoaded(false);
    };
  }, [open, imageSrc]);

  // Draw the preview
  const drawPreview = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = CROP_SIZE;
    canvas.height = CROP_SIZE;

    ctx.clearRect(0, 0, CROP_SIZE, CROP_SIZE);

    // Create circular clip
    ctx.save();
    ctx.beginPath();
    ctx.arc(CROP_SIZE / 2, CROP_SIZE / 2, CROP_SIZE / 2, 0, Math.PI * 2);
    ctx.clip();

    // Draw image
    const scale = baseScale * zoom;
    const drawWidth = img.width * scale;
    const drawHeight = img.height * scale;
    const drawX = (CROP_SIZE - drawWidth) / 2 + offset.x;
    const drawY = (CROP_SIZE - drawHeight) / 2 + offset.y;

    ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
    ctx.restore();

    // Draw circle border
    ctx.beginPath();
    ctx.arc(CROP_SIZE / 2, CROP_SIZE / 2, CROP_SIZE / 2 - 1, 0, Math.PI * 2);
    ctx.strokeStyle = 'hsl(var(--primary))';
    ctx.lineWidth = 3;
    ctx.stroke();
  }, [zoom, offset, baseScale]);

  useEffect(() => {
    if (imageLoaded) {
      drawPreview();
    }
  }, [imageLoaded, drawPreview]);

  // Mouse/Touch handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;
    
    // Limit drag to prevent image from going too far
    const maxDrag = CROP_SIZE * 0.8;
    setOffset({
      x: Math.max(-maxDrag, Math.min(maxDrag, newX)),
      y: Math.max(-maxDrag, Math.min(maxDrag, newY)),
    });
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  const handleReset = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  const handleConfirm = () => {
    const img = imageRef.current;
    if (!img) return;

    // Create output canvas at higher resolution
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = OUTPUT_SIZE;
    outputCanvas.height = OUTPUT_SIZE;
    const ctx = outputCanvas.getContext('2d');
    if (!ctx) return;

    // Create circular clip on output
    ctx.beginPath();
    ctx.arc(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, 0, Math.PI * 2);
    ctx.clip();

    // Fill with white background (for transparency)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

    // Scale coordinates from preview size to output size
    const outputScale = OUTPUT_SIZE / CROP_SIZE;
    const scale = baseScale * zoom;
    const drawWidth = img.width * scale * outputScale;
    const drawHeight = img.height * scale * outputScale;
    const drawX = ((CROP_SIZE - img.width * scale) / 2 + offset.x) * outputScale;
    const drawY = ((CROP_SIZE - img.height * scale) / 2 + offset.y) * outputScale;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);

    // Convert to compressed JPEG blob
    outputCanvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], 'avatar.jpg', {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          console.log(`Avatar cropped & compressed: ${(file.size / 1024).toFixed(1)}KB`);
          onCropComplete(file);
        }
      },
      'image/jpeg',
      0.85
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[380px] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-center text-base">Crop Profile Picture</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center px-5 pb-4 space-y-4">
          {/* Crop Area */}
          <div
            ref={containerRef}
            className="relative bg-muted rounded-xl overflow-hidden select-none"
            style={{ width: CROP_SIZE, height: CROP_SIZE }}
          >
            {/* Darkened background outside circle */}
            <div className="absolute inset-0 z-10 pointer-events-none">
              <svg width={CROP_SIZE} height={CROP_SIZE}>
                <defs>
                  <mask id="circleMask">
                    <rect width={CROP_SIZE} height={CROP_SIZE} fill="white" />
                    <circle cx={CROP_SIZE / 2} cy={CROP_SIZE / 2} r={CROP_SIZE / 2 - 2} fill="black" />
                  </mask>
                </defs>
                <rect width={CROP_SIZE} height={CROP_SIZE} fill="rgba(0,0,0,0.5)" mask="url(#circleMask)" />
              </svg>
            </div>

            {/* Canvas for image preview */}
            <canvas
              ref={canvasRef}
              width={CROP_SIZE}
              height={CROP_SIZE}
              className="cursor-grab active:cursor-grabbing touch-none"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            />
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Drag to reposition • Zoom to resize
          </p>

          {/* Zoom Controls */}
          <div className="flex items-center gap-3 w-full max-w-[250px]">
            <ZoomOut className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <Slider
              value={[zoom]}
              onValueChange={([v]) => setZoom(v)}
              min={0.5}
              max={3}
              step={0.05}
              className="flex-1"
            />
            <ZoomIn className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          </div>
        </div>

        <DialogFooter className="px-5 pb-5 flex-row gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="flex-1"
          >
            <RotateCcw className="w-4 h-4 mr-1" />
            Reset
          </Button>
          <Button
            size="sm"
            onClick={handleConfirm}
            className="flex-1 bg-gradient-to-r from-primary to-primary/80"
          >
            <Check className="w-4 h-4 mr-1" />
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AvatarCropDialog;
