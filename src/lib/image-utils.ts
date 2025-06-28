
export async function resizeImage(file: File, maxWidth: number): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        if (img.width <= maxWidth) {
          // If the image is already smaller than the max width, do not resize.
          resolve(file);
          return;
        }

        const canvas = document.createElement('canvas');
        const scale = maxWidth / img.width;
        canvas.width = maxWidth;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Could not get canvas context'));
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return reject(new Error('Canvas to Blob conversion failed'));
            }
            // Use image/jpeg for better compression than png
            const newFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(newFile);
          },
          'image/jpeg',
          0.9 // 90% quality for jpeg
        );
      };
      img.onerror = reject;
      const result = event.target?.result;
      if (typeof result === 'string') {
        img.src = result;
      } else {
        reject(new Error('FileReader did not return a string.'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
