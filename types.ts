
export enum ToolType {
  RECOLOR = 'recolor',
  REMOVE_BG = 'remove_bg',
  ID_PHOTO = 'id_photo',
  CHANGE_ACCESSORY = 'change_accessory',
  RESTORATION = 'restoration',
  OBJECT_EDITING = 'object_editing',
  VECTOR_CONVERSION = 'vector_conversion',
  ADVANCED_RECOLOR = 'advanced_recolor',
  MARKETING_DESIGN = 'marketing_design',
  PORTRAIT_EDITING = 'portrait_editing',
  LOGO_DESIGN = 'logo_design',
  THUMBNAIL_DESIGN = 'thumbnail_design',
  PRODUCT_LABEL = 'product_label',
  INVITATION_DESIGN = 'invitation_design',
  IMAGE_RESIZER = 'image_resizer',
  TEXT_TO_IMAGE = 'text_to_image',
  BEFORE_AFTER = 'before_after',
  COMPONENT_GENERATION = 'component_generation'
}

export type Language = 'vi' | 'en';

export interface ImageFile {
  file: File;
  previewUrl: string;
  base64: string;
  mimeType: string;
}

export interface TextOverlay {
  id: string;
  text: string;
  x: number; // percentage
  y: number; // percentage
  fontFamily: string;
  fontSize: number;
  color: string;
  isBold: boolean;
  isItalic: boolean;
  hasShadow: boolean; // Kept for backward compatibility, though 'drop_shadow' effect supersedes it
  effect?: 'none' | 'drop_shadow' | 'outline' | 'glow' | 'emboss' | 'gradient' | 'texture' | 'blur' | 'neon' | 'long_shadow' | '3d';
}

export interface BeforeAfterConfig {
    width: number;
    height: number;
    aspectRatio: '1:1' | '4:3' | '16:9' | '9:16';
    ppi: number;
    arrangement: 'left-right' | 'top-bottom' | 'diagonal';
    padding: number;
    gap: number;
    backgroundColor: string;
    borderColor: string;
    borderWidth: number;
    frameStyle: string;
    logoOpacity: number;
    customPrompt: string;
    textElements: TextOverlay[];
}

export interface BeforeAfterHistoryItem {
  id: string;
  beforeImage?: string;
  afterImage?: string;
  resultImage: string;
  config: BeforeAfterConfig;
  timestamp: number;
}

export interface ComponentGenerationConfig {
    imageCount: number;
    width: string;
    height: string;
    aspectRatio: '1:1' | '4:3' | '9:16' | '16:9' | 'custom';
    ppi: number;
    style: string;
    enhancements: {
        lightBalance: boolean;
        denoise: boolean;
        hdr: boolean;
        sharpen: boolean;
    };
    customPrompt: string;
}

export interface ComponentGenerationHistoryItem {
    id: string;
    componentImages: string[]; // array of base64
    results: string[];
    config: ComponentGenerationConfig;
    prompt: string;
    timestamp: number;
}

export interface InvitationDesignConfig {
    designMode: 'sample' | 'custom';
    cardType: string;
    content: string;
    fontStyle: string;
    fontSize: string;
    textColor: string;
    quality: string;
    upscale: string;
    customPrompt: string;
}

export interface IdPhotoConfig {
    size: string;
    bgColorType: string;
    customBgColor: string;
    attireMode: string;
    attirePreset: string;
    hairStyle: string;
    keepFeatures: boolean;
    smoothSkin: boolean;
}

export interface RestorationConfig {
    customPrompt: string;
    fixHair: boolean;
    isAsian: boolean;
    fixClothes: boolean;
    fixBackground: boolean;
    keepIdentity: boolean;
    denoise: boolean;
    faceEnhance: boolean;
    colorize: boolean;
    restoreLevel: number;
    resolution: string;
    style: string;
}

export type VectorStyle = 'flat' | 'cartoon' | 'realistic' | 'line_art' | 'pop_art';

export interface VectorConfig {
    style: VectorStyle;
    quality: string;
    upscale: string;
    customPrompt: string;
}

export interface ColorMapping {
    id: string;
    sourceColor: string;
    targetColor: string;
    sourceCoords?: { x: number, y: number };
}

export interface AdvancedRecolorConfig {
    mode: 'single' | 'batch';
    colorSource: 'ref_image' | 'hex' | 'palette' | 'point_mapping';
    targetColor: string;
    quality: string;
    upscale: string;
    customPrompt: string;
    colorMappings: ColorMapping[];
}

export interface MarketingDesignConfig {
    materialType: string;
    width: string;
    height: string;
    industry: string;
    style: string;
    primaryColor: string;
    fontStyle: string;
    adContent: string;
    quality: string;
    upscale: string;
    customPrompt: string;
}

export interface PortraitConfig {
    mode: 'single' | 'batch';
    autoAdjust: boolean;
    adjustments: {
      brightness: number;
      contrast: number;
      saturation: number;
      temperature: number;
      gamma: number;
    };
    style: string;
    beauty: {
      wrinkles: boolean;
      redEye: boolean;
      greyHair: boolean;
      smoothSkin: boolean;
      blemishes: boolean;
      lipTint: {
          enabled: boolean;
          color: string;
      }
    };
    quality: string;
    upscale: string;
    customPrompt: string;
    mask?: string;
}

export interface LogoDesignConfig {
    industry: string;
    style: string;
    structure: string;
    brandName: string;
    colorMode: 'custom' | 'auto_image';
    colors: string[];
    quality: string;
    upscale: string;
    customPrompt: string;
}

export interface ThumbnailDesignConfig {
    style: string;
    textContent: string;
    font: string;
    typography: string;
    textColor: string;
    aspectRatio: string;
    quality: string;
    upscale: string;
    customPrompt: string;
}

export interface ProductLabelConfig {
    mode: 'single' | 'batch';
    styleMode: 'original' | 'new';
    style: string;
    quality: string;
    upscale: string;
    customPrompt: string;
}

export interface RemoveBgConfig {
    mode: 'single' | 'batch';
    lightBalance: boolean;
    denoise: boolean;
    antiAlias: boolean;
    quality: string;
    upscale: string;
    customPrompt: string;
    mask?: string;
}

export interface ImageResizerConfig {
    mode: 'single' | 'batch';
    targetWidth: string;
    targetHeight: string;
    maintainAspectRatio: boolean;
    ppi: number;
    enhancements: {
      lightBalance: boolean;
      denoise: boolean;
      hdr: boolean;
      sharpen: boolean;
    };
    customPrompt: string;
    mask?: string;
}

export interface TextToImageConfig {
    count: number;
    width: string;
    height: string;
    aspectRatio: string;
    ppi: number;
    style: string;
    enhancements: {
      lightBalance: boolean;
      denoise: boolean;
      hdr: boolean;
      sharpen: boolean;
    };
    customPrompt: string;
    mask?: string;
}

export interface BatchItem {
    id: string;
    file: File;
    previewUrl: string;
    status: 'pending' | 'processing' | 'done' | 'error';
    resultUrl?: string;
}

export interface RemoveBgHistoryItem {
    id: string;
    originalImage: string;
    resultImage: string;
    config: RemoveBgConfig;
    timestamp: number;
}

export interface VectorHistoryItem {
    id: string;
    originalImage: string;
    resultImage: string;
    config: VectorConfig;
    timestamp: number;
}

export interface AdvancedRecolorHistoryItem {
    id: string;
    originalImage: string;
    resultImage: string;
    config: AdvancedRecolorConfig;
    prompt: string;
    timestamp: number;
}

export interface MarketingHistoryItem {
    id: string;
    originalImage: string;
    additionalImages: string[];
    resultImage: string;
    config: MarketingDesignConfig;
    timestamp: number;
}

export interface PortraitHistoryItem {
    id: string;
    originalImage: string;
    resultImage: string;
    config: PortraitConfig;
    timestamp: number;
}

export interface LogoHistoryItem {
    id: string;
    originalImage: string;
    additionalAssets: string[];
    results: string[];
    config: LogoDesignConfig;
    timestamp: number;
}

export interface ThumbnailHistoryItem {
    id: string;
    originalImage: string;
    additionalAssets: string[];
    results: string[];
    config: ThumbnailDesignConfig;
    timestamp: number;
}

export interface ProductLabelHistoryItem {
    id: string;
    originalImage: string;
    labelImage?: string;
    resultImage: string;
    config: ProductLabelConfig;
    timestamp: number;
}

export interface InvitationHistoryItem {
    id: string;
    originalImage?: string;
    additionalAssets: string[];
    resultImage: string;
    config: InvitationDesignConfig;
    timestamp: number;
}

export interface ImageResizerHistoryItem {
    id: string;
    originalImage: string;
    resultImage: string;
    config: ImageResizerConfig;
    timestamp: number;
}

export interface TextToImageHistoryItem {
    id: string;
    refImage?: string;
    results: string[];
    config: TextToImageConfig;
    prompt: string;
    timestamp: number;
}

export interface IdPhotoHistoryItem {
    id: string;
    originalImage: string;
    resultImage: string;
    config: IdPhotoConfig;
    prompt: string;
    timestamp: number;
}

export enum TaskStatus {
    TODO = 'todo',
    IN_PROGRESS = 'in_progress',
    DONE = 'done'
}

export interface Task {
    name: string;
    status: TaskStatus;
}

export interface AnalysisResult {
    artisticStyle: string;
    colorPalette: string[];
    mood: string;
    composition: string;
    technicalDetails: string;
    keywords: string[];
}

export interface TextElement {
    id: string;
    content: string;
    fontFamily: string;
    fontSize: number;
    color: string;
    fontWeight: string;
    fontStyle: string;
    textAlign: 'left' | 'center' | 'right';
    opacity: number;
    shadow: boolean;
    x: number;
    y: number;
}

export interface CardState {
    width: number;
    height: number;
    backgroundColor: string;
    backgroundImage: string | null;
    filterBlur: number;
    filterBrightness: number;
    textElements: TextElement[];
    selectedElementId: string | null;
}

export interface FontOption {
    name: string;
    value: string;
}

export interface GeneratedImage {
    id: string;
    url: string;
}

export enum Industry {
    REAL_ESTATE = 'real_estate',
    TECH = 'tech',
    FOOD = 'food',
    FASHION = 'fashion'
}

export enum LogoStyle {
    MODERN = 'modern',
    CLASSIC = 'classic',
    MINIMAL = 'minimal'
}

export interface ImageState {
    file: File | null;
    previewUrl: string | null;
}

export interface DesignSuggestion {
    backgroundColor: string;
    textColor: string;
    frameColor: string;
    accentColor: string;
    fontStyle: string;
    title: string;
    subtitle: string;
    marketingHook: string;
    emoji: string;
}

export type ViewMode = 'slider' | 'side-by-side' | 'stacked';
