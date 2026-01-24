/**
 * Compress an image file to a maximum dimension while maintaining aspect ratio
 * This reduces file size for faster loading while maintaining good quality
 */
export const compressImage = (
  file: File,
  maxDimension: number = 1920,
  quality: number = 0.85
): Promise<File> => {
  return new Promise((resolve, reject) => {
    // If it's not an image, return as-is
    if (!file.type.startsWith('image/')) {
      resolve(file);
      return;
    }

    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = () => {
      let { width, height } = img;

      // Calculate new dimensions while maintaining aspect ratio
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      canvas.width = width;
      canvas.height = height;

      // Draw image with high quality
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
      }

      // Convert to blob
      canvas.toBlob(
        (blob) => {
          if (blob) {
            // Create new file with original name
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            
            console.log(`Image compressed: ${(file.size / 1024 / 1024).toFixed(2)}MB → ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`);
            resolve(compressedFile);
          } else {
            // If compression fails, return original
            resolve(file);
          }
        },
        'image/jpeg',
        quality
      );

      URL.revokeObjectURL(img.src);
    };

    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      // If loading fails, return original file
      resolve(file);
    };

    img.src = URL.createObjectURL(file);
  });
};

/**
 * Compress multiple images in parallel
 */
export const compressImages = async (
  files: File[],
  maxDimension: number = 1920,
  quality: number = 0.85
): Promise<File[]> => {
  return Promise.all(
    files.map((file) => compressImage(file, maxDimension, quality))
  );
};
