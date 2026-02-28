import { useState, useRef, useCallback, useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageZoomOverlayProps {
  src: string;
  alt?: string;
  open: boolean;
  onClose: () => void;
}

const ImageZoomOverlay = ({ src, alt, open, onClose }: ImageZoomOverlayProps) => {
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isClosing, setIsClosing] = useState(false);
  const lastDistance = useRef(0);
  const lastCenter = useRef({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });
  const imgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setScale(1);
      setTranslate({ x: 0, y: 0 });
      setIsClosing(false);
      document.body.style.overflow = 'hidden';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 250);
  }, [onClose]);

  const getDistance = (t1: React.Touch, t2: React.Touch) =>
    Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      lastDistance.current = getDistance(e.touches[0], e.touches[1]);
      lastCenter.current = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      };
    } else if (e.touches.length === 1 && scale > 1) {
      isDragging.current = true;
      startPos.current = {
        x: e.touches[0].clientX - translate.x,
        y: e.touches[0].clientY - translate.y,
      };
    }
  }, [scale, translate]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 2) {
      const dist = getDistance(e.touches[0], e.touches[1]);
      const newScale = Math.min(4, Math.max(1, scale * (dist / lastDistance.current)));
      lastDistance.current = dist;
      setScale(newScale);
      if (newScale <= 1) setTranslate({ x: 0, y: 0 });
    } else if (e.touches.length === 1 && isDragging.current && scale > 1) {
      setTranslate({
        x: e.touches[0].clientX - startPos.current.x,
        y: e.touches[0].clientY - startPos.current.y,
      });
    }
  }, [scale]);

  const handleTouchEnd = useCallback(() => {
    isDragging.current = false;
    if (scale <= 1.05) {
      setScale(1);
      setTranslate({ x: 0, y: 0 });
    }
  }, [scale]);

  const handleDoubleTap = useCallback(() => {
    if (scale > 1) {
      setScale(1);
      setTranslate({ x: 0, y: 0 });
    } else {
      setScale(2.5);
    }
  }, [scale]);

  // Double-tap detection
  const lastTap = useRef(0);
  const handleTap = useCallback((e: React.TouchEvent) => {
    if (e.touches.length > 1) return;
    const now = Date.now();
    if (now - lastTap.current < 300) {
      handleDoubleTap();
    }
    lastTap.current = now;
  }, [handleDoubleTap]);

  if (!open) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-[100] flex items-center justify-center bg-black/95 transition-opacity duration-250",
        isClosing ? "opacity-0" : "opacity-100"
      )}
      onClick={(e) => { if (e.target === e.currentTarget && scale <= 1) handleClose(); }}
    >
      <button
        onClick={handleClose}
        className="absolute top-4 right-4 z-[101] p-2 rounded-full bg-black/50 text-white"
      >
        <X className="w-6 h-6" />
      </button>

      <div
        ref={imgRef}
        className="w-full h-full flex items-center justify-center touch-none"
        onTouchStart={(e) => { handleTap(e); handleTouchStart(e); }}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <img
          src={src}
          alt={alt || 'Zoomed image'}
          className="max-w-full max-h-full object-contain select-none"
          style={{
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
            transition: isDragging.current ? 'none' : 'transform 0.25s ease-out',
          }}
          draggable={false}
        />
      </div>
    </div>
  );
};

export default ImageZoomOverlay;
