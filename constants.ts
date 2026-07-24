
import { Industry, LogoStyle } from './types';

export const INDUSTRIES = Object.values(Industry);
export const STYLES = Object.values(LogoStyle);

export const DEFAULT_COLORS = [
  '#000000', // Black
  '#FFFFFF', // White
  '#FF0000', // Red
  '#0000FF', // Blue
  '#FFFF00', // Yellow
  '#008000', // Green
];

export const COLORS = [
  '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', 
  '#FFFF00', '#00FFFF', '#FF00FF', '#C0C0C0', '#808080', 
  '#800000', '#808000', '#008000', '#800080', '#008080', '#000080'
];

export const FONTS = [
  // Standard
  { name: 'Roboto', value: "'Roboto', sans-serif" },
  { name: 'Open Sans', value: "'Open Sans', sans-serif" },
  { name: 'Montserrat', value: "'Montserrat', sans-serif" },
  { name: 'Playfair Display', value: "'Playfair Display', serif" },
  
  // 12 AI Generated / Artistic Fonts
  { name: 'AI Thư Pháp (Calligraphy)', value: "'Great Vibes', cursive" },
  { name: 'AI Brush Art', value: "'Comforter Brush', cursive" },
  { name: 'AI Cyberpunk', value: "'Orbitron', sans-serif" },
  { name: 'AI Futuristic', value: "'Exo 2', sans-serif" },
  { name: 'AI Handwriting', value: "'Sacramento', cursive" },
  { name: 'AI Vintage', value: "'Rye', serif" },
  { name: 'AI Horror', value: "'Creepster', system-ui" },
  { name: 'AI Comic', value: "'Bangers', system-ui" },
  { name: 'AI Pixel', value: "'Press Start 2P', system-ui" },
  { name: 'AI Cinematic', value: "'Cinzel', serif" },
  { name: 'AI Typewriter', value: "'Special Elite', monospace" },
  { name: 'AI Marker', value: "'Permanent Marker', cursive" },
];

export const DEFAULT_BACKGROUNDS = [
  'https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1513151233558-d860c5398176?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1530103862676-de3c9ca5958b?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1520697830682-bbb6e85e2b0b?auto=format&fit=crop&w=800&q=80',
];

export const CARD_SIZES = [
  { name: 'Facebook Post', width: 940, height: 788 },
  { name: 'Instagram Post', width: 1080, height: 1080 },
  { name: 'Instagram Story', width: 1080, height: 1920 },
  { name: 'Twitter Post', width: 1600, height: 900 },
  { name: 'A4', width: 2480, height: 3508 },
  { name: 'Card', width: 1050, height: 600 },
];
