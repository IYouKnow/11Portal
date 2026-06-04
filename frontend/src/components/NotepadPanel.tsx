import { useEffect, useMemo, useState } from "react";
import { FileText, Plus, Save, X } from "lucide-react";

type NotepadPanelProps = {
  storageKey: string;
};

type SavedNote = {
  id: string;
  title: string;
  text: string;
  savedAt: string;
  updatedAt: string;
};

type SavedNoteLibrary = {
  activeNoteId: string | null;
  notes: SavedNote[];
};

function createNoteId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `note-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createBlankNote(): SavedNote {
  const now = new Date().toISOString();

  return {
    id: createNoteId(),
    title: "Untitled note",
    text: "",
    savedAt: now,
    updatedAt: now,
  };
}

function normalizeNote(value: Partial<SavedNote> | string): SavedNote {
  const now = new Date().toISOString();

  if (typeof value === "string") {
    return {
      ...createBlankNote(),
      text: value,
      savedAt: now,
      updatedAt: now,
    };
  }

  return {
    id: typeof value.id === "string" && value.id ? value.id : createNoteId(),
    title:
      typeof value.title === "string" && value.title.trim()
        ? value.title
        : "Untitled note",
    text: typeof value.text === "string" ? value.text : "",
    savedAt: typeof value.savedAt === "string" ? value.savedAt : now,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : now,
  };
}

function readLibrary(rawValue: string | null): SavedNoteLibrary {
  const blank = createBlankNote();

  if (rawValue === null) {
    return {
      activeNoteId: blank.id,
      notes: [blank],
    };
  }

  try {
    const parsed = JSON.parse(rawValue) as
      | SavedNoteLibrary
      | Partial<SavedNote>
      | string
      | null;

    if (typeof parsed === "string") {
      const note = normalizeNote(parsed);
      return {
        activeNoteId: note.id,
        notes: [note],
      };
    }

    if (parsed && Array.isArray((parsed as SavedNoteLibrary).notes)) {
      const notes = (parsed as SavedNoteLibrary).notes
        .map((note) => normalizeNote(note))
        .sort((left, right) => {
          const rightTime = new Date(right.updatedAt).getTime();
          const leftTime = new Date(left.updatedAt).getTime();
          return rightTime - leftTime;
        });

      return {
        activeNoteId:
          typeof (parsed as SavedNoteLibrary).activeNoteId === "string"
            ? (parsed as SavedNoteLibrary).activeNoteId
            : notes[0]?.id ?? blank.id,
        notes: notes.length > 0 ? notes : [blank],
      };
    }

    if (parsed && typeof (parsed as Partial<SavedNote>).text === "string") {
      const note = normalizeNote(parsed as Partial<SavedNote>);
      return {
        activeNoteId: note.id,
        notes: [note],
      };
    }
  } catch {
    return {
      activeNoteId: blank.id,
      notes: [normalizeNote(rawValue)],
    };
  }

  return {
    activeNoteId: blank.id,
    notes: [blank],
  };
}

function formatSavedAt(value: string) {
  if (!value) {
    return "Draft";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function NotepadPanel({ storageKey }: NotepadPanelProps) {
  const [notes, setNotes] = useState<SavedNote[]>([]);
  const [currentNoteId, setCurrentNoteId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [title, setTitle] = useState("Untitled note");
  const [status, setStatus] = useState<string>("Loading...");
  const [isTitlePromptOpen, setIsTitlePromptOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [isOpenDrawer, setIsOpenDrawer] = useState(false);

  const currentNote = useMemo(
    () => notes.find((note) => note.id === currentNoteId) ?? null,
    [currentNoteId, notes],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const library = readLibrary(window.localStorage.getItem(storageKey));
      setNotes(library.notes);
      setCurrentNoteId(library.activeNoteId);

      const selectedNote =
        library.notes.find((note) => note.id === library.activeNoteId) ??
        library.notes[0];

      if (selectedNote) {
        setText(selectedNote.text);
        setTitle(selectedNote.title);
        setDraftTitle(selectedNote.title);
        setStatus("Loaded");
      } else {
        const blank = createBlankNote();
        setNotes([blank]);
        setCurrentNoteId(blank.id);
        setText(blank.text);
        setTitle(blank.title);
        setDraftTitle(blank.title);
        setStatus("Ready");
      }
    } catch {
      const blank = createBlankNote();
      setNotes([blank]);
      setCurrentNoteId(blank.id);
      setText(blank.text);
      setTitle(blank.title);
      setDraftTitle(blank.title);
      setStatus("Could not load note");
    }
  }, [storageKey]);

  const persistLibrary = (nextNotes: SavedNote[], nextActiveNoteId: string | null) => {
    if (typeof window === "undefined") {
      return;
    }

    const payload: SavedNoteLibrary = {
      activeNoteId: nextActiveNoteId,
      notes: nextNotes.sort((left, right) => {
        const rightTime = new Date(right.updatedAt).getTime();
        const leftTime = new Date(left.updatedAt).getTime();
        return rightTime - leftTime;
      }),
    };

    window.localStorage.setItem(storageKey, JSON.stringify(payload));
  };

  const selectNote = (noteId: string) => {
    const nextNote = notes.find((note) => note.id === noteId);

    if (!nextNote) {
      return;
    }

    setCurrentNoteId(nextNote.id);
    setText(nextNote.text);
    setTitle(nextNote.title);
    setDraftTitle(nextNote.title);
    setStatus("Opened");
    setIsOpenDrawer(false);
  };

  const handleSave = () => {
    setDraftTitle(title);
    setIsTitlePromptOpen(true);
  };

  const confirmSave = () => {
    if (typeof window === "undefined") {
      return;
    }

    const nextTitle = draftTitle.trim() || "Untitled note";
    const now = new Date().toISOString();
    const nextNoteId = currentNoteId ?? createNoteId();
    const nextNote: SavedNote = {
      id: nextNoteId,
      title: nextTitle,
      text,
      savedAt: currentNote?.savedAt ?? now,
      updatedAt: now,
    };
    const nextNotes = [
      nextNote,
      ...notes.filter((note) => note.id !== nextNoteId),
    ];

    try {
      persistLibrary(nextNotes, nextNoteId);
      setNotes(nextNotes);
      setCurrentNoteId(nextNoteId);
      setTitle(nextTitle);
      setStatus("Saved");
      setIsTitlePromptOpen(false);
      setIsOpenDrawer(false);
    } catch {
      setStatus("Could not save note");
    }
  };

  const closeTitlePrompt = () => {
    setDraftTitle(title);
    setIsTitlePromptOpen(false);
  };

  const handleNewNote = () => {
    const newNote = createBlankNote();
    const nextNotes = [newNote, ...notes];

    try {
      persistLibrary(nextNotes, newNote.id);
      setNotes(nextNotes);
      setCurrentNoteId(newNote.id);
      setText(newNote.text);
      setTitle(newNote.title);
      setDraftTitle(newNote.title);
      setStatus("New note");
      setIsOpenDrawer(false);
    } catch {
      setStatus("Could not create note");
    }
  };

  const sortedNotes = useMemo(
    () =>
      [...notes].sort((left, right) => {
        const rightTime = new Date(right.updatedAt).getTime();
        const leftTime = new Date(left.updatedAt).getTime();
        return rightTime - leftTime;
      }),
    [notes],
  );

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-[linear-gradient(180deg,rgb(var(--color-panel))_0%,rgb(var(--color-surface))_100%)] text-ink">
      <div className="border-b border-line bg-window-chrome/85 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs text-muted">Open, create, and save notes.</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="inline-flex h-9 items-center gap-2 rounded-2xl border border-line bg-surface/80 px-3.5 text-xs font-medium text-muted transition hover:border-accent/30 hover:bg-accent/8 hover:text-ink"
              onClick={() => setIsOpenDrawer((current) => !current)}
              type="button"
            >
              <FileText className="h-3.5 w-3.5" />
              Open
            </button>
            <button
              className="inline-flex h-9 items-center gap-2 rounded-2xl border border-accent/30 bg-accent/12 px-3.5 text-xs font-medium text-accent transition hover:border-accent/50 hover:bg-accent/18"
              onClick={handleSave}
              type="button"
            >
              <Save className="h-3.5 w-3.5" />
              Save
            </button>
            <button
              aria-label="Create new note"
              className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-accent/30 bg-accent/12 text-accent transition hover:border-accent/50 hover:bg-accent/18"
              onClick={handleNewNote}
              type="button"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div
        className={`flex min-h-0 flex-1 gap-4 p-5 ${
          isOpenDrawer ? "grid grid-cols-[280px_minmax(0,1fr)]" : "grid grid-cols-1"
        }`}
      >
        {isOpenDrawer ? (
          <aside className="flex min-h-0 flex-col overflow-hidden rounded-[2rem] border border-line bg-panel/80 shadow-soft">
            <div className="border-b border-line px-4 py-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">
                Notes
              </h3>
              <p className="mt-1 text-xs text-muted">
                Select a note to open it. The newest note appears first.
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {sortedNotes.length > 0 ? (
                <div className="grid gap-2">
                  {sortedNotes.map((note) => {
                    const isActive = note.id === currentNoteId;

                    return (
                      <button
                        key={note.id}
                        className={`rounded-2xl border px-4 py-3 text-left transition ${
                          isActive
                            ? "border-accent/35 bg-accent/10"
                            : "border-line bg-surface/80 hover:border-accent/20 hover:bg-surface"
                        }`}
                        onClick={() => selectNote(note.id)}
                        type="button"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-ink">
                              {note.title}
                            </p>
                            <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted">
                              {note.text.trim()
                                ? note.text.trim()
                                : "Blank note"}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-full border border-line bg-panel px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-muted">
                            {isActive ? "Open" : "File"}
                          </span>
                        </div>
                        <p className="mt-3 text-[11px] text-muted">
                          Updated {formatSavedAt(note.updatedAt)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="grid place-items-center rounded-2xl border border-dashed border-line px-4 py-10 text-center text-sm text-muted">
                  No saved notes yet.
                  <span className="mt-1 text-xs">Use + to create one.</span>
                </div>
              )}
            </div>
          </aside>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <textarea
            className="min-h-0 flex-1 resize-none rounded-3xl border border-line bg-panel/90 px-5 py-4 text-sm leading-6 text-ink outline-none transition placeholder:text-muted focus:border-accent/45 focus:ring-2 focus:ring-accent/12"
            placeholder="Start typing your notes here..."
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              setStatus("Unsaved changes");
            }}
          />

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
            <span>
              {text.length.toLocaleString()} character{text.length === 1 ? "" : "s"}
            </span>
            <span>Saved in browser storage only</span>
          </div>
        </div>
      </div>

      {isTitlePromptOpen ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/40 px-4 backdrop-blur-[2px]">
          <div className="w-full max-w-md rounded-[2rem] border border-line bg-panel p-5 shadow-[0_30px_90px_rgba(15,23,42,0.24)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold tracking-tight">Save note</h3>
                <p className="mt-1 text-sm text-muted">
                  Give this note a title before it is saved.
                </p>
              </div>

              <button
                aria-label="Close save dialog"
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-surface/80 text-muted transition hover:bg-surface hover:text-ink"
                onClick={closeTitlePrompt}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 grid gap-2">
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                Note title
              </label>
              <input
                autoFocus
                className="h-11 rounded-2xl border border-line bg-surface px-4 text-sm text-ink outline-none transition placeholder:text-muted focus:border-accent/45 focus:ring-2 focus:ring-accent/12"
                placeholder="Untitled note"
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    confirmSave();
                  }
                }}
              />
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                className="inline-flex h-10 items-center justify-center rounded-2xl border border-line bg-surface/80 px-4 text-sm font-medium text-muted transition hover:bg-surface hover:text-ink"
                onClick={closeTitlePrompt}
                type="button"
              >
                Cancel
              </button>
              <button
                className="inline-flex h-10 items-center gap-2 rounded-2xl border border-accent/30 bg-accent/12 px-4 text-sm font-medium text-accent transition hover:border-accent/50 hover:bg-accent/18"
                onClick={confirmSave}
                type="button"
              >
                <Save className="h-4 w-4" />
                Save note
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
