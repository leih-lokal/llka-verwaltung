/**
 * Dashboard notes section with markdown support and drag-and-drop reordering
 */
'use client';

import { useEffect, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { StickyNote, Plus, Pencil, Trash2, GripVertical } from 'lucide-react';
import { collections } from '@/lib/pocketbase/client';
import { useRealtimeSubscription } from '@/hooks/use-realtime-subscription';
import type { Note } from '@/types';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// 7 muted background colors for notes
const NOTE_COLORS = [
  { value: '#fef9c3', label: 'Gelb' },
  { value: '#fecaca', label: 'Rot' },
  { value: '#bfdbfe', label: 'Blau' },
  { value: '#bbf7d0', label: 'Grün' },
  { value: '#e9d5ff', label: 'Lila' },
  { value: '#fed7aa', label: 'Orange' },
  { value: '#e5e5e5', label: 'Grau' },
];

interface SortableNoteProps {
  note: Note;
  onEdit: (note: Note) => void;
  onDelete: (id: string) => void;
}

function SortableNote({ note, onEdit, onDelete }: SortableNoteProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: note.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
    >
      <div
        className="group relative rounded-lg p-4 shadow-md hover:shadow-lg transition-all"
        style={{ backgroundColor: note.background_color }}
      >
        <div
          className="absolute top-2 left-2 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
          {...listeners}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="pl-6 pr-16 min-h-[60px]">
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {note.content || '*(Leere Notiz)*'}
            </ReactMarkdown>
          </div>
        </div>
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onEdit(note)}
            className="h-7 w-7 hover:bg-black/10"
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onDelete(note.id)}
            className="h-7 w-7 hover:bg-black/10"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function DashboardNotes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [noteColor, setNoteColor] = useState(NOTE_COLORS[0].value);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    loadNotes();
  }, []);

  // Real-time subscription for live updates
  useRealtimeSubscription<Note>('note', {
    onCreated: (note) => {
      setNotes((prev) => {
        // Check if note already exists (avoid duplicates)
        if (prev.some((n) => n.id === note.id)) {
          return prev;
        }
        // Add note and re-sort by order_index
        const updated = [...prev, note];
        return updated.sort((a, b) => a.order_index - b.order_index);
      });
    },
    onUpdated: (note) => {
      setNotes((prev) => {
        // Update note and re-sort by order_index
        const updated = prev.map((n) => (n.id === note.id ? note : n));
        return updated.sort((a, b) => a.order_index - b.order_index);
      });
    },
    onDeleted: (note) => {
      setNotes((prev) => prev.filter((n) => n.id !== note.id));
    },
  });

  async function loadNotes() {
    try {
      setLoading(true);
      const result = await collections.notes().getFullList<Note>({
        sort: 'order_index',
      });
      setNotes(result);
    } catch (error) {
      console.error('Failed to load notes:', error);
      toast.error('Fehler beim Laden der Notizen');
    } finally {
      setLoading(false);
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = notes.findIndex((n) => n.id === active.id);
      const newIndex = notes.findIndex((n) => n.id === over.id);

      const newNotes = arrayMove(notes, oldIndex, newIndex);
      setNotes(newNotes);

      // Update order_index for all notes
      try {
        await Promise.all(
          newNotes.map((note, index) =>
            collections.notes().update(note.id, { order_index: index })
          )
        );
      } catch (error) {
        console.error('Failed to update note order:', error);
        toast.error('Fehler beim Aktualisieren der Reihenfolge');
        // Reload notes to restore correct order
        loadNotes();
      }
    }
  }

  function handleAddNote() {
    setEditingNote(null);
    setNoteContent('');
    setNoteColor(NOTE_COLORS[0].value);
    setIsDialogOpen(true);
  }

  function handleEditNote(note: Note) {
    setEditingNote(note);
    setNoteContent(note.content);
    setNoteColor(note.background_color);
    setIsDialogOpen(true);
  }

  async function handleSaveNote() {
    try {
      const data = {
        content: noteContent,
        background_color: noteColor,
        order_index: editingNote ? editingNote.order_index : notes.length,
      };

      if (editingNote) {
        await collections.notes().update(editingNote.id, data);
        toast.success('Notiz aktualisiert');
      } else {
        await collections.notes().create(data);
        toast.success('Notiz erstellt');
      }

      setIsDialogOpen(false);
      loadNotes();
    } catch (error) {
      console.error('Failed to save note:', error);
      toast.error('Fehler beim Speichern der Notiz');
    }
  }

  async function handleDeleteNote(id: string) {
    if (!confirm('Notiz wirklich löschen?')) return;

    try {
      await collections.notes().delete(id);
      toast.success('Notiz gelöscht');
      loadNotes();
    } catch (error) {
      console.error('Failed to delete note:', error);
      toast.error('Fehler beim Löschen der Notiz');
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2">
          <StickyNote className="h-5 w-5" />
          <span>Notizen</span>
        </CardTitle>
        <Button size="sm" onClick={handleAddNote}>
          <Plus className="mr-1 h-4 w-4" />
          Neu
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Lädt...</p>
        ) : notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Keine Notizen vorhanden. Erstelle eine neue Notiz!
          </p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={notes.map((n) => n.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-3">
                {notes.map((note) => (
                  <SortableNote
                    key={note.id}
                    note={note}
                    onEdit={handleEditNote}
                    onDelete={handleDeleteNote}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingNote ? 'Notiz bearbeiten' : 'Neue Notiz'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Inhalt (Markdown unterstützt)
                </label>
                <Textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="# Überschrift&#10;&#10;- Punkt 1&#10;- Punkt 2&#10;&#10;**Fett** und *kursiv*"
                  className="min-h-[200px] font-mono text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Hintergrundfarbe
                </label>
                <div className="flex gap-2">
                  {NOTE_COLORS.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setNoteColor(color.value)}
                      className={`w-10 h-10 rounded-md border-2 transition-all ${
                        noteColor === color.value
                          ? 'border-primary scale-110'
                          : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: color.value }}
                      title={color.label}
                    />
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Vorschau
                </label>
                <div
                  className="rounded-lg p-4 border min-h-[100px]"
                  style={{ backgroundColor: noteColor }}
                >
                  <div className="prose prose-sm max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {noteContent || '*(Leere Notiz)*'}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button onClick={handleSaveNote}>Speichern</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
