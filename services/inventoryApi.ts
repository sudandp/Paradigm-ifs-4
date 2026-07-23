import { supabase } from './supabase';
import type { InventoryItem, OpsTicketMaterial } from '../types/operations';

const toSnakeCase = (data: any): any => {
  if (data === '') return null;
  if (Array.isArray(data)) return data.map(item => toSnakeCase(item));
  if (data !== null && typeof data === 'object' && !(data instanceof Date) && !(data instanceof File)) {
    const snaked: Record<string, any> = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        snaked[snakeKey] = toSnakeCase(data[key]);
      }
    }
    return snaked;
  }
  return data;
};

const toCamelCase = (data: any): any => {
  if (Array.isArray(data)) return data.map(item => toCamelCase(item));
  if (data !== null && typeof data === 'object' && !(data instanceof Date)) {
    const camelCased: Record<string, any> = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        const camelKey = key.replace(/_([a-z])/g, g => g[1].toUpperCase());
        camelCased[camelKey] = toCamelCase(data[key]);
      }
    }
    return camelCased;
  }
  return data;
};

export const inventoryApi = {

  // -------------------------------------------------------------------------
  // INVENTORY ITEMS
  // -------------------------------------------------------------------------

  getInventoryItems: async (entityId?: string): Promise<InventoryItem[]> => {
    let query = supabase
      .from('inventory_items')
      .select(`
        *,
        entities:entity_id (name)
      `)
      .order('created_at', { ascending: false });

    if (entityId && entityId !== 'all') {
      query = query.eq('entity_id', entityId);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[InventoryAPI] Error fetching inventory items:', error);
      throw error;
    }

    return (data || []).map(row => {
      const camel = toCamelCase(row);
      if (row.entities) {
        camel.entityName = row.entities.name;
      }
      return camel as InventoryItem;
    });
  },

  createInventoryItem: async (item: Partial<InventoryItem>): Promise<InventoryItem> => {
    const payload = toSnakeCase(item);
    delete payload.id;
    delete payload.created_at;
    delete payload.updated_at;
    delete payload.entity_name;

    const { data, error } = await supabase
      .from('inventory_items')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('[InventoryAPI] Error creating inventory item:', error);
      throw error;
    }
    return toCamelCase(data) as InventoryItem;
  },

  updateInventoryItem: async (id: string, updates: Partial<InventoryItem>): Promise<InventoryItem> => {
    const payload = toSnakeCase(updates);
    delete payload.id;
    delete payload.created_at;
    delete payload.updated_at;
    delete payload.entity_name;

    const { data, error } = await supabase
      .from('inventory_items')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[InventoryAPI] Error updating inventory item:', error);
      throw error;
    }
    return toCamelCase(data) as InventoryItem;
  },

  deleteInventoryItem: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('inventory_items')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[InventoryAPI] Error deleting inventory item:', error);
      throw error;
    }
  },

  // -------------------------------------------------------------------------
  // TICKET / WORK ORDER MATERIAL CONSUMPTION
  // -------------------------------------------------------------------------

  getTicketMaterials: async (ticketId: string): Promise<OpsTicketMaterial[]> => {
    const { data, error } = await supabase
      .from('ops_ticket_materials')
      .select(`
        *,
        inventory_items:item_id (name, item_code, category),
        users:issued_by (name)
      `)
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[InventoryAPI] Error fetching ticket materials:', error);
      throw error;
    }

    return (data || []).map(row => {
      const camel = toCamelCase(row);
      if (row.inventory_items) {
        camel.itemName = row.inventory_items.name;
        camel.itemCode = row.inventory_items.item_code;
        camel.category = row.inventory_items.category;
      }
      if (row.users) {
        camel.issuedByName = row.users.name;
      }
      return camel as OpsTicketMaterial;
    });
  },

  addTicketMaterial: async (material: {
    ticketId: string;
    itemId: string;
    quantityUsed: number;
    unitPrice: number;
    remarks?: string;
  }): Promise<OpsTicketMaterial> => {
    const { data: { session } } = await supabase.auth.getSession();
    const payload = toSnakeCase({
      ...material,
      issuedBy: session?.user?.id || null
    });

    const { data, error } = await supabase
      .from('ops_ticket_materials')
      .insert(payload)
      .select(`
        *,
        inventory_items:item_id (name, item_code, category)
      `)
      .single();

    if (error) {
      console.error('[InventoryAPI] Error adding ticket material:', error);
      throw error;
    }

    const camel = toCamelCase(data);
    if (data.inventory_items) {
      camel.itemName = data.inventory_items.name;
      camel.itemCode = data.inventory_items.item_code;
      camel.category = data.inventory_items.category;
    }
    return camel as OpsTicketMaterial;
  },

  deleteTicketMaterial: async (materialId: string): Promise<void> => {
    const { error } = await supabase
      .from('ops_ticket_materials')
      .delete()
      .eq('id', materialId);

    if (error) {
      console.error('[InventoryAPI] Error deleting ticket material:', error);
      throw error;
    }
  }
};
