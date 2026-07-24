
declare global {
  interface Window {
    html2canvas: any;
  }
}

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      } else {
        reject(new Error('Failed to convert file to base64'));
      }
    };
    reader.onerror = (error) => reject(error);
  });
};

export const downloadElementAsImage = async (elementId: string, fileName: string) => {
  const element = document.getElementById(elementId);
  if (!element || !window.html2canvas) return;

  try {
    const canvas = await window.html2canvas(element, {
      backgroundColor: null,
      useCORS: true,
      scale: 2, // Higher quality
      logging: false,
    });

    const link = document.createElement('a');
    link.download = `${fileName}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch (err) {
    console.error('Failed to export image:', err);
    alert('Could not download image. Please try again.');
  }
};
