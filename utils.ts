import { CardState } from "./types";

export const generateId = () => Math.random().toString(36).substr(2, 9);

export const downloadCard = async (cardState: CardState, canvasRef: HTMLDivElement) => {
  // Create a real canvas element to draw everything
  const canvas = document.createElement('canvas');
  canvas.width = cardState.width;
  canvas.height = cardState.height;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) return;

  // Fill background color
  ctx.fillStyle = cardState.backgroundColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw background image if exists
  if (cardState.backgroundImage) {
    await new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        // Apply basic filters using ctx.filter (supported in modern browsers)
        const blur = `blur(${cardState.filterBlur}px)`;
        const brightness = `brightness(${cardState.filterBrightness}%)`;
        ctx.filter = `${blur} ${brightness}`;
        
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Reset filter
        ctx.filter = 'none';
        resolve();
      };
      img.onerror = reject;
      img.src = cardState.backgroundImage;
    });
  }

  // Draw Text
  cardState.textElements.forEach(text => {
    ctx.save();
    
    // Construct font string
    const style = text.fontStyle;
    const weight = text.fontWeight;
    const size = text.fontSize;
    const family = text.fontFamily.split(',')[0].replace(/['"]/g, ''); // Simple cleanup
    ctx.font = `${style} ${weight} ${size}px ${family}`;
    
    ctx.fillStyle = text.color;
    ctx.globalAlpha = text.opacity;
    ctx.textAlign = text.textAlign;
    ctx.textBaseline = 'top';

    if (text.shadow) {
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
    }

    // Convert % position to pixels
    // Note: In CSS left: 50% translates -50% centers the element itself. 
    // For simple canvas drawing, we approximate based on alignment.
    let x = (text.x / 100) * cardState.width;
    const y = (text.y / 100) * cardState.height;

    // Adjust X based on alignment because CSS transform translate(-50%) handles centering
    // visually in DOM, but here we need manual adjustment or rely on textAlign
    // If we rely on textAlign, x should be the anchor point.
    // In DOM implementation: 
    // left: x%, transform: translate(-50%, -50%) means x is the center.
    // So for canvas, x is the center.
    
    // However, text might be multiline. Canvas fillText doesn't support multiline natively.
    const lines = text.content.split('\n');
    const lineHeight = text.fontSize * 1.2;

    lines.forEach((line, index) => {
      ctx.fillText(line, x, y + (index * lineHeight) - ((lines.length * lineHeight) / 2)); 
      // Subtracting half total height to simulate translate(-50%, -50%) vertical centering
    });

    ctx.restore();
  });

  // Download
  const link = document.createElement('a');
  link.download = 'my-card-design.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
};