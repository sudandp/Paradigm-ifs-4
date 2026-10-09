import React, { useState, useEffect } from 'react';
import { X, Plus, Pin, Trash2, Search, Download, Bookmark, FileText, Check } from 'lucide-react';
import { localNotesService, LocalNote } from '../../services/localNotesService';
import toast from 'react-hot-toast';

interface NotesPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotesPanelModal: React.FC<NotesPanelModalProps> = ({ isOpen, onClose }) => {
  const [notes, setNotes] = useState<LocalNote[]>([]);
  const [search, setSearch] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newTag, setNewTag] = useState('');

  const refreshNotes = () => {
    setNotes(localNotesService.searchNotes(search));
  };

  useEffect(() => {
    if (isOpen) {
      refreshNotes();
    }
  }, [isOpen, search]);

  if (!isOpen) return null;

  const handleSaveNote = () => {
    if (!newContent.trim()) {
      toast.error('Note content cannot be empty');
      return;
    }

    const tags = newTag.split(',').map(t => t.trim()).filter(Boolean);
    localNotesService.addNote(newTitle || 'Untitled Note', newContent, tags);
    toast.success('Note saved locally!');
    setNewTitle('');
    setNewContent('');
    setNewTag('');
    setIsCreating(false);
    refreshNotes();
  };

  const handleDelete = (id: string) => {
    localNotesService.deleteNote(id);
    toast.success('Note deleted');
    refreshNotes();
  };

  const handleTogglePin = (id: string) => {
    localNotesService.togglePin(id);
    refreshNotes();
  };

  const handleExportMarkdown = () => {
    const md = localNotesService.exportMarkdown();
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `paradigm_notes_${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Notes exported as Markdown');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/20 flex items-center justify-center">
              <Bookmark className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                On-Device Notes Hub
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  {notes.length} Notes
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                100% private local storage • Accessible offline anytime
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-white dark:bg-slate-900">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search notes by keyword or tag..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCreating(true)}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Note</span>
            </button>
            <button
              onClick={handleExportMarkdown}
              title="Export all notes to Markdown"
              className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Note Creator Form */}
        {isCreating && (
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-amber-50/40 dark:bg-amber-950/20 space-y-3">
            <input
              type="text"
              placeholder="Note Title (e.g., DG Diesel Reading - B2)"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-amber-500"
            />
            <textarea
              placeholder="Write note contents, equipment readings, or task notes..."
              rows={3}
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-amber-500"
            />
            <div className="flex items-center justify-between gap-3">
              <input
                type="text"
                placeholder="Tags (comma-separated, e.g. mep, diesel, rounds)"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                className="flex-1 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 text-xs text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 focus:outline-none"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsCreating(false)}
                  className="px-3 py-1.5 rounded-xl text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveNote}
                  className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  Save Note
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Notes List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3 divide-y divide-slate-100 dark:divide-slate-800">
          {notes.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-xs">No notes found. Create your first note above!</p>
            </div>
          ) : (
            notes.map((note) => (
              <div key={note.id} className="pt-3 first:pt-0 group">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {note.isPinned && (
                        <Pin className="w-3.5 h-3.5 text-amber-500 fill-amber-500 rotate-45 shrink-0" />
                      )}
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {note.title}
                      </h4>
                      <span className="text-[10px] text-slate-400">
                        {new Date(note.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 whitespace-pre-wrap leading-relaxed">
                      {note.content}
                    </p>
                    {note.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {note.tags.map((t, i) => (
                          <span
                            key={i}
                            className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button
                      onClick={() => handleTogglePin(note.id)}
                      className={`p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer ${
                        note.isPinned ? 'text-amber-500' : 'text-slate-400'
                      }`}
                      title={note.isPinned ? 'Unpin' : 'Pin to top'}
                    >
                      <Pin className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(note.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition cursor-pointer"
                      title="Delete note"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex items-center justify-between text-xs text-slate-500">
          <span>Tip: You can also say &quot;take note: ...&quot; directly to the assistant.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold hover:bg-slate-300 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};

export default NotesPanelModal;
