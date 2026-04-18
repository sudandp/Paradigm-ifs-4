export interface UploadedFile {
  name: string;
  type: string;
  size: number;
  preview: string;
  url?: string;
  path?: string | null; // Path in Supabase storage bucket
  file?: File;
  progress?: number;
}
