export interface Holiday {
  id?: number;
  name: string;
  date: string; // YYYY-MM-DD
  year: number; // e.g. 2026
  description?: string;
  isOptional?: boolean;
}
