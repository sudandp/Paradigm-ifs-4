/**
 * Local Notes & Scratchpad Service
 * Stores notes 100% on-device in localStorage/IndexedDB with tagging, pinning, search, and export.
 * Syncs with Supabase in the background when online and authenticated.
 */

import { supabase } from './supabase';

export interface LocalNote {
  id: string;
  title: string;
  content: string;
  tags: string[];
  isPinned: boolean;
  color?: string;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = 'paradigm_digital_notes_v1';

export class LocalNotesService {
  private static instance: LocalNotesService;
  private notes: LocalNote[] = [];

  private constructor() {
    this.loadNotes();
  }

  public static getInstance(): LocalNotesService {
    if (!LocalNotesService.instance) {
      LocalNotesService.instance = new LocalNotesService();
    }
    return LocalNotesService.instance;
  }

  private loadNotes() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.notes = JSON.parse(raw);
      } else {
        // Sample default welcome note
        this.notes = [
          {
            id: 'note_welcome',
            title: '📌 Welcome to Your Digital Companion Notes',
            content: 'Take quick notes during site rounds or meetings. You can say "take note: DG diesel reading 820L" and your assistant will save it here!',
            tags: ['welcome', 'quick-tips'],
            isPinned: true,
            color: 'indigo',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ];
        this.saveNotes();
      }
    } catch {
      this.notes = [];
    }
  }

  private saveNotes() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.notes));
    } catch (e) {
      console.warn('Failed to save local notes:', e);
    }
  }

  public getAllNotes(): LocalNote[] {
    return [...this.notes].sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }

  public addNote(title: string, content: string, tags: string[] = [], color: string = 'slate'): LocalNote {
    const newNote: LocalNote = {
      id: `note_${Date.now()}`,
      title: title.trim() || 'Quick Note',
      content: content.trim(),
      tags,
      isPinned: false,
      color,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.notes.unshift(newNote);
    this.saveNotes();
    this.syncToCloud(newNote);
    return newNote;
  }

  public updateNote(id: string, updates: Partial<LocalNote>): LocalNote | null {
    const idx = this.notes.findIndex(n => n.id === id);
    if (idx === -1) return null;

    this.notes[idx] = {
      ...this.notes[idx],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    this.saveNotes();
    return this.notes[idx];
  }

  public deleteNote(id: string): boolean {
    const prevLen = this.notes.length;
    this.notes = this.notes.filter(n => n.id !== id);
    if (this.notes.length !== prevLen) {
      this.saveNotes();
      return true;
    }
    return false;
  }

  public togglePin(id: string): boolean {
    const note = this.notes.find(n => n.id === id);
    if (note) {
      note.isPinned = !note.isPinned;
      note.updatedAt = new Date().toISOString();
      this.saveNotes();
      return true;
    }
    return false;
  }

  public searchNotes(query: string): LocalNote[] {
    const q = query.toLowerCase().trim();
    if (!q) return this.getAllNotes();

    return this.notes.filter(n =>
      n.title.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q) ||
      n.tags.some(t => t.toLowerCase().includes(q))
    );
  }

  public exportMarkdown(): string {
    return this.notes
      .map(n => `# ${n.title}\n*Saved: ${new Date(n.createdAt).toLocaleString()} | Tags: ${n.tags.join(', ')}*\n\n${n.content}\n\n---`)
      .join('\n\n');
  }

  public exportJSON(): string {
    return JSON.stringify(this.notes, null, 2);
  }

  /**
   * Background cloud sync when online and user is authenticated
   */
  private async syncToCloud(note: LocalNote) {
    if (!navigator.onLine) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('user_offline_notes').upsert({
        id: note.id,
        user_id: user.id,
        title: note.title,
        content: note.content,
        tags: note.tags,
        is_pinned: note.isPinned,
        updated_at: note.updatedAt
      });
    } catch {
      // Offline fallback silent
    }
  }
}

export const localNotesService = LocalNotesService.getInstance();
