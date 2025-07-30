"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Upload, Download, ZoomIn, RotateCcw } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const EDITOR_WIDTH = 512;
const EDITOR_HEIGHT = 512;

// To change the background, replace the URL in the following line with your image URL.
const BACKGROUND_IMAGE_URL = '/Frame.png';

const FRAME_SIZE_PERCENT = 0.30;   // 30 % of EDITOR_WIDTH/HEIGHT
const FRAME_TOP_PERCENT = 0.76;    // 76 % from top of EDITOR_HEIGHT
const FRAME_LEFT_PERCENT = 0.50;   // 50 % from left of EDITOR_WIDTH

// absolute radius in canvas pixels
const FRAME_ABS_RADIUS = (EDITOR_WIDTH * FRAME_SIZE_PERCENT) / 2;

const ZoraIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="11" stroke="currentColor" strokeWidth="2"/>
  </svg>
);

export default function OnchainSummerBooth() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  // Store original image dimensions for accurate canvas drawing
  const [originalImageDimensions, setOriginalImageDimensions] = useState({ width: 0, height: 0 });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  // Auto-fit image to frame when loaded
  const autoFitImage = useCallback((img: HTMLImageElement) => {
    if (!imageContainerRef.current) return;
    
    // Get the actual display size of the frame in the preview
    // The preview frame width is FRAME_SIZE_PERCENT of the container's width
    const containerRect = imageContainerRef.current.getBoundingClientRect();
    const previewFramePixelWidth = containerRect.width * FRAME_SIZE_PERCENT;
    
    const imgAspect = img.width / img.height;
    
    let newZoom;
    // Calculate zoom to cover the circular frame completely
    // We want the smallest dimension of the image (after zoom) to be at least the frame diameter
    if (imgAspect > 1) { // Wide image (width > height)
      // Fit height to frame diameter, then adjust zoom based on original image height
      newZoom = previewFramePixelWidth / img.height; 
    } else { // Tall or square image (height >= width)
      // Fit width to frame diameter, then adjust zoom based on original image width
      newZoom = previewFramePixelWidth / img.width;
    }
    
    // Ensure the image always covers the frame, so the minimum zoom should be calculated this way.
    // If you want it to perfectly fit without overflowing, you'd use Math.min instead of Math.max.
    // For covering a circular frame, you usually want the smaller dimension of the image to fill the frame diameter.
    
    setZoom(newZoom);
    setPosition({ x: 0, y: 0 }); // Reset position when new image is loaded
    setImageLoaded(true);
    setOriginalImageDimensions({ width: img.width, height: img.height });
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (imageSrc) URL.revokeObjectURL(imageSrc);
      const newImageSrc = URL.createObjectURL(file);
      setImageSrc(newImageSrc);
      setImageLoaded(false);
      
      const img = new window.Image();
      img.onload = () => autoFitImage(img);
      img.src = newImageSrc;
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
    // Store drag start relative to current image position
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const newZoom = Math.max(0.5, Math.min(zoom - e.deltaY * 0.001, 3));
    setZoom(newZoom);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const resetTransform = () => {
    if (imageSrc) {
      const img = new window.Image();
      img.onload = () => autoFitImage(img);
      img.src = imageSrc;
    } else {
      setZoom(1);
      setPosition({ x: 0, y: 0 });
    }
  };

  const generateAndDownload = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    canvas.width = EDITOR_WIDTH;
    canvas.height = EDITOR_HEIGHT;

    const bgImage = new window.Image();
    bgImage.crossOrigin = 'anonymous'; // Important for loading images from different origins
    bgImage.src = BACKGROUND_IMAGE_URL;

    bgImage.onload = () => {
      ctx.drawImage(bgImage, 0, 0, EDITOR_WIDTH, EDITOR_HEIGHT);

      if (imageSrc && originalImageDimensions.width > 0) { // Ensure user image is loaded
        const userImage = new window.Image();
        userImage.crossOrigin = 'anonymous';
        userImage.src = imageSrc;

        userImage.onload = () => {
          ctx.save();

          // Calculate center of the circular frame on the canvas
          const circleCenterX = EDITOR_WIDTH * FRAME_LEFT_PERCENT;
          const circleCenterY = EDITOR_HEIGHT * FRAME_TOP_PERCENT;

          // Draw the circular clip path
          ctx.beginPath();
          ctx.arc(circleCenterX, circleCenterY, FRAME_ABS_RADIUS, 0, Math.PI * 2);
          ctx.clip();

          // Calculate image dimensions and position for drawing on canvas
          // These calculations need to convert the preview state (zoom, position)
          // into the canvas coordinate system.

          // The user image in the DOM preview is scaled relative to its parent (the circular div),
          // which has a width of FRAME_SIZE_PERCENT * containerRect.width.
          // The `zoom` state is applied to this displayed size.

          // First, calculate the true pixel size of the image if it were directly scaled by `zoom`
          // onto the canvas, considering its original dimensions.
          const imgDisplayWidth = originalImageDimensions.width * zoom;
          const imgDisplayHeight = originalImageDimensions.height * zoom;

          // The circular frame's actual pixel width in the preview is `containerRect.width * FRAME_SIZE_PERCENT`.
          // The image within the preview `<img>` tag is then translated `position.x`, `position.y`.
          // We need to figure out what `position.x` and `position.y` mean relative to the full `EDITOR_WIDTH` canvas.

          // The image in the preview is inside a div whose size is FRAME_SIZE_PERCENT * 100% of its parent.
          // The actual size of this frame on the canvas is EDITOR_WIDTH * FRAME_SIZE_PERCENT.
          const canvasFrameWidth = EDITOR_WIDTH * FRAME_SIZE_PERCENT;
          const canvasFrameHeight = EDITOR_HEIGHT * FRAME_SIZE_PERCENT; // Should be same as width for a circle

          // The scale factor between the preview frame's actual rendered size and the canvas frame's size.
          // This ensures that the drag position (which is in preview pixels) scales correctly to canvas pixels.
          // This scale factor depends on the aspect ratio of the editor_width to container_width.
          // However, for simplicity and a direct mapping, let's consider position as relative to the
          // frame's center.
          
          // The position.x and position.y are relative to the center of the image *within its own containing div*.
          // This containing div is already scaled to the FRAME_SIZE_PERCENT.
          // So, to get the movement on the canvas, we need to scale the position by how much the 
          // actual frame width on the canvas relates to the actual frame width in the preview.
          // Let's assume the preview container scales linearly with EDITOR_WIDTH/HEIGHT.
          
          // Let's re-evaluate how `position` is applied. `position` is the offset from the *initial centered position*
          // within the preview's circular frame.
          // So, if the preview frame has width `PFW` and the canvas frame `CFW`, the position needs scaling:
          // `canvas_pos = preview_pos * (CFW / PFW)`.
          // Since the preview frame size is `containerRect.width * FRAME_SIZE_PERCENT`,
          // and canvas frame size is `EDITOR_WIDTH * FRAME_SIZE_PERCENT`,
          // the ratio is `EDITOR_WIDTH / containerRect.width`. This is tricky as `containerRect.width`
          // is dynamic.

          // A more robust approach:
          // 1. Calculate the scaled image size for the canvas based on `zoom` and `originalImageDimensions`.
          // 2. Calculate the *center* of the image on the canvas *before* any drag offset.
          // 3. Apply the drag offset, scaled appropriately.

          const scaledImageWidth = originalImageDimensions.width * zoom;
          const scaledImageHeight = originalImageDimensions.height * zoom;

          // Initial top-left corner of the image if it were centered in the frame
          // The image is centered relative to the FRAME_ABS_RADIUS.
          // The image is meant to fill the circle. So its dimensions when zoom is 1
          // are equivalent to FRAME_ABS_RADIUS * 2.

          // The current `img` element in the DOM is inside a div that is `FRAME_SIZE_PERCENT` of `imageContainerRef.current`.
          // The `transform` on the `img` element is `translate(${position.x}px, ${position.y}px) scale(${zoom})`.
          // The `position.x` and `position.y` are in pixels relative to the preview's frame size.
          // We need to scale these positions from the preview's pixel dimensions to the canvas's pixel dimensions.

          // The ratio of the canvas editor width to the current preview container width:
          const editorToPreviewRatio = EDITOR_WIDTH / (imageContainerRef.current?.getBoundingClientRect().width || EDITOR_WIDTH);

          // Apply this ratio to the position values
          const canvasOffsetX = position.x * editorToPreviewRatio;
          const canvasOffsetY = position.y * editorToPreviewRatio;

          // Calculate the top-left corner of the image on the canvas.
          // Start with the center of the circle, then subtract half of the scaled image dimensions,
          // then add the scaled offsets.
          const imgCanvasX = circleCenterX - scaledImageWidth / 2 + canvasOffsetX;
          const imgCanvasY = circleCenterY - scaledImageHeight / 2 + canvasOffsetY;
          
          ctx.drawImage(userImage, imgCanvasX, imgCanvasY, scaledImageWidth, scaledImageHeight);
          ctx.restore();

          const dataUrl = canvas.toDataURL('image/png');
          const link = document.createElement('a');
          link.href = dataUrl;
          link.download = 'onchain-summer-booth.png';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        };
      } else {
        // If no user image, download just the background
        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = 'onchain-summer-bg.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    };
  };

  return (
    <TooltipProvider>
      <div className="w-full max-w-6xl mx-auto p-4">
        <div className="grid lg:grid-cols-2 gap-6 lg:gap-8 items-start">
          <Card className="shadow-2xl w-full">
            <CardContent className="p-3 sm:p-4 lg:p-6">
              <div
                ref={imageContainerRef}
                className="relative w-full aspect-square overflow-hidden rounded-lg bg-gray-200 min-h-[280px] sm:min-h-[350px] lg:min-h-[400px]"
                onMouseDown={handleMouseDown}
                onWheel={handleWheel}
                style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
              >
                <Image
                  src={BACKGROUND_IMAGE_URL}
                  alt="Onchain Summer background"
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  priority
                  data-ai-hint="vibrant summer"
                />
                {imageSrc && (
                  <div
                    className="absolute rounded-full overflow-hidden border-2 border-pink-300/50 shadow-lg"
                    style={{
                      width: `${FRAME_SIZE_PERCENT * 100}%`,
                      height: `${FRAME_SIZE_PERCENT * 100}%`,
                      top: `${FRAME_TOP_PERCENT * 100}%`,
                      left: `${FRAME_LEFT_PERCENT * 100}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                  >
                    <img
                      src={imageSrc}
                      alt="User uploaded"
                      className="w-full h-full object-cover"
                      style={{
                        // The user image is scaled *within its parent circular div*.
                        // The parent circular div is already sized to FRAME_SIZE_PERCENT of the container.
                        // So, applying the zoom and position directly here works for the preview.
                        transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                        transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                      }}
                    />
                  </div>
                )}
                <div
                  className="absolute rounded-full pointer-events-none border-2 border-pink-300/50 border-dashed"
                  style={{
                    width: `${FRAME_SIZE_PERCENT * 100}%`,
                    height: `${FRAME_SIZE_PERCENT * 100}%`,
                    top: `${FRAME_TOP_PERCENT * 100}%`,
                    left: `${FRAME_LEFT_PERCENT * 100}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-4 lg:gap-6">
            <Card className="shadow-xl">
              <CardHeader className="pb-4">
                <CardTitle className="font-headline text-2xl sm:text-3xl text-primary">
                  Onchain Summer Lagos
                </CardTitle>
                <CardDescription className="text-sm sm:text-base">
                  Create your profile picture for Onchain Summer. Upload your photo and position it in the frame.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 lg:space-y-6">
                <Button 
                  onClick={() => fileInputRef.current?.click()} 
                  className="w-full h-10 sm:h-11"
                >
                  <Upload className="mr-2 h-4 w-4" /> Upload Photo
                </Button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="zoom-slider" className="flex items-center gap-2 text-sm">
                      <ZoomIn className="h-4 w-4" /> Zoom
                    </Label>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7" 
                      onClick={resetTransform}
                      disabled={!imageSrc}
                    >
                      <RotateCcw className="h-4 w-4" />
                      <span className="sr-only">Reset</span>
                    </Button>
                  </div>
                  <Slider
                    id="zoom-slider"
                    value={[zoom]}
                    onValueChange={v => setZoom(v[0])}
                    min={0.5}
                    max={3}
                    step={0.01}
                    disabled={!imageSrc}
                    className="w-full"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4">
                  <Button 
                    onClick={generateAndDownload} 
                    disabled={!imageSrc}
                    className="h-10 sm:h-11"
                  >
                    <Download className="mr-2 h-4 w-4" /> Download
                  </Button>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" disabled className="h-10 sm:h-11">
                        <ZoraIcon />
                        <span className="ml-2">Mint on Zora</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Zora minting coming soon!</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <canvas ref={canvasRef} className="hidden" />
      </div>
    </TooltipProvider>
  );
}