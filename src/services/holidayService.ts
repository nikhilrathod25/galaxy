import { supabase } from './supabase';
import { Holiday } from '../types';

export class HolidayService {
  private static mapFromDb(row: any): Holiday {
    return {
      id: Number(row.id),
      name: row.name,
      date: row.date,
      year: Number(row.year),
      description: row.description || undefined,
      isOptional: Boolean(row.is_optional),
    };
  }

  static async getAll(): Promise<Holiday[]> {
    const { data, error } = await supabase.from('holidays').select('*').order('date', { ascending: true });
    if (error) {
      console.error('Error fetching holidays from Supabase:', error);
      return [];
    }
    return (data || []).map(this.mapFromDb);
  }

  static async getByYear(year: number): Promise<Holiday[]> {
    const { data, error } = await supabase
      .from('holidays')
      .select('*')
      .eq('year', year)
      .order('date', { ascending: true });

    if (error) {
      console.error('Error fetching holidays by year:', error);
      return [];
    }
    return (data || []).map(this.mapFromDb);
  }

  static async getByDateRange(startDate: string, endDate: string): Promise<Holiday[]> {
    const { data, error } = await supabase
      .from('holidays')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (error) {
      console.error('Error fetching holidays by range:', error);
      return [];
    }
    return (data || []).map(this.mapFromDb);
  }

  static async getByDate(date: string): Promise<Holiday | undefined> {
    const { data, error } = await supabase.from('holidays').select('*').eq('date', date).maybeSingle();
    if (error || !data) return undefined;
    return this.mapFromDb(data);
  }

  static async create(data: Omit<Holiday, 'id'>): Promise<number> {
    const { data: inserted, error } = await supabase
      .from('holidays')
      .insert({
        name: data.name,
        date: data.date,
        year: data.year,
        description: data.description || null,
        is_optional: Boolean(data.isOptional),
      })
      .select('id')
      .single();

    if (error || !inserted) {
      console.error('Error creating holiday in Supabase:', error);
      throw new Error(error?.message || 'Failed to create holiday.');
    }
    return Number(inserted.id);
  }

  static async update(id: number, data: Partial<Holiday>): Promise<number> {
    const payload: any = {};
    if (data.name !== undefined) payload.name = data.name;
    if (data.date !== undefined) payload.date = data.date;
    if (data.year !== undefined) payload.year = data.year;
    if (data.description !== undefined) payload.description = data.description;
    if (data.isOptional !== undefined) payload.is_optional = data.isOptional;
    payload.updated_at = new Date().toISOString();

    const { error } = await supabase.from('holidays').update(payload).eq('id', id);
    if (error) {
      console.error('Error updating holiday in Supabase:', error);
      throw new Error(error.message || 'Failed to update holiday.');
    }
    return 1;
  }

  static async delete(id: number): Promise<void> {
    const { error } = await supabase.from('holidays').delete().eq('id', id);
    if (error) {
      console.error('Error deleting holiday in Supabase:', error);
      throw new Error(error.message || 'Failed to delete holiday.');
    }
  }

  static async count(): Promise<number> {
    const { count, error } = await supabase.from('holidays').select('*', { count: 'exact', head: true });
    if (error) return 0;
    return count || 0;
  }
}
