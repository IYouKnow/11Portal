import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, Plus, Save, Trash2, X } from "lucide-react";
import {
  createNote,
  deleteNote,
  listNotes,
  updateNote,
  type Note,
} from "../lib/api";

type NotepadPanelProps = {
  storageKey: string;
};

type LegacySavedNote = {
  id?: string;
  title?: string;
  text?: string;
  savedAt?: string;
  updatedAt?: string;
};

type LegacySavedNoteLibrary = {
  activeNoteId?: string | null;
  notes?: LegacySavedNote[] | string[];
};

type LegacyImportResult = {
  notes: Array<{ title: string; text: string }>;
};

function parseLegacyLibrary(rawValue: string | null): LegacyImportResult | null {
  if (rawValue === null) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as LegacySavedNoteLibrary | LegacySavedNote | string;

    if (typeof parsed === "string") {
      return {
        notes: [{ title: "", text: parsed }],
      };
    }

    if (Array.isArray((parsed as LegacySavedNoteLibrary).notes)) {
      const library = parsed as LegacySavedNoteLibrary;
      const legacyNotes = library.notes ?? [];
      const notes = legacyNotes
        .map((note) => {
          if (typeof note === "string") {
            return { title: "", text: note };
          }

          return {
            title: typeof note.title === "string" ? note.title : "",
            text: typeof note.text === "string" ? note.text : "",
          };
        })
        .filter((note) => note.text.length > 0 || note.title.length > 0);

      return {
        notes: notes.length > 0 ? notes : [{ title: "", text: "" }],
      };
    }

    if (typeof (parsed as LegacySavedNote).text === "string") {
      const note = parsed as LegacySavedNote;
      return {
        notes: [
          {
            title: typeof note.title === "string" ? note.title : "",
            text: note.text ?? "",
          },
        ],
      };
    }
  } catch {
    return {
      notes: [{ title: "", text: rawValue }],
    };
  }

  return null;
}

function displayNoteTitle(note: Note) {
  const trimmedTitle = note.title.trim();

  if (!trimmedTitle || trimmedTitle === "Untitled note") {
    return "Draft";
  }

  return trimmedTitle;
}

function sortByUpdatedAt(notes: Note[]) {
  return [...notes].sort((left, right) => {
    const rightTime = new Date(right.updatedAt).getTime();
    const leftTime = new Date(left.updatedAt).getTime();
    return rightTime - leftTime;
  });
}

export function NotepadPanel({ storageKey }: NotepadPanelProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [openNoteIds, setOpenNoteIds] = useState<number[]>([]);
  const [currentNoteId, setCurrentNoteId] = useState<number | null>(null);
  const [draftText, setDraftText] = useState("");
  const [draftTitle, setDraftTitle] = useState("");
  const [isTitlePromptOpen, setIsTitlePromptOpen] = useState(false);
  const [isOpenDrawer, setIsOpenDrawer] = useState(false);
  const [noteSearch, setNoteSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState("Loading notes...");
  const saveTimersRef = useRef<Map<number, number>>(new Map());
  const isMountedRef = useRef(false);
  const isBootstrappingRef = useRef(false);
  const legacyImportedRef = useRef(false);

  const currentNote = useMemo(
    () => notes.find((note) => note.id === currentNoteId) ?? null,
    [currentNoteId, notes],
  );

  const activeNoteLabel = currentNote ? displayNoteTitle(currentNote) : "No note open";

  const syncCurrentDraft = (note: Note) => {
    setCurrentNoteId(note.id);
    setDraftText(note.text);
    setDraftTitle(note.title);
    setIsTitlePromptOpen(false);
  };

  const clearScheduledSave = (noteId: number) => {
    const timerId = saveTimersRef.current.get(noteId);
    if (timerId !== undefined) {
      window.clearTimeout(timerId);
      saveTimersRef.current.delete(noteId);
    }
  };

  const scheduleAutosave = (noteId: number, title: string, text: string) => {
    clearScheduledSave(noteId);

    const timerId = window.setTimeout(async () => {
      try {
        const response = await updateNote(noteId, {
          title,
          text,
        });

        saveTimersRef.current.delete(noteId);
        if (!isMountedRef.current) {
          return;
        }

        setNotes((current) =>
          sortByUpdatedAt(
            current.map((note) => (note.id === response.item.id ? response.item : note)),
          ),
        );
        setStatus("Saved to database");
      } catch {
        saveTimersRef.current.delete(noteId);
        if (isMountedRef.current) {
          setStatus("Could not save note");
        }
      }
    }, 500);

    saveTimersRef.current.set(noteId, timerId);
  };

  useEffect(() => {
    isMountedRef.current = true;
    let cancelled = false;

    const bootstrap = async () => {
      setIsLoading(true);
      setStatus("Loading notes...");
      isBootstrappingRef.current = true;

      try {
        let items = sortByUpdatedAt((await listNotes()).items);

        if (items.length === 0 && !legacyImportedRef.current && typeof window !== "undefined") {
          const legacyLibrary = parseLegacyLibrary(window.localStorage.getItem(storageKey));
          if (legacyLibrary) {
            const created = [];
            for (let index = 0; index < legacyLibrary.notes.length; index += 1) {
              const legacyNote = legacyLibrary.notes[index];
              const result = await createNote({
                title: legacyNote.title,
                text: legacyNote.text,
              });
              created.push(result.item);
            }

            legacyImportedRef.current = true;
            items = sortByUpdatedAt(created);
            if (typeof window !== "undefined") {
              try {
                window.localStorage.removeItem(storageKey);
              } catch {
                // best-effort cleanup
              }
            }
            setStatus("Imported saved notes");
          }
        }

        if (!cancelled) {
          if (items.length === 0) {
            const created = await createNote({ title: "", text: "" });
            items = [created.item];
          }

          const nextActive = items[0] ?? null;
          setNotes(items);
          setOpenNoteIds([nextActive?.id].filter((value): value is number => value !== null));
          setCurrentNoteId(nextActive?.id ?? null);
          setDraftText(nextActive?.text ?? "");
          setDraftTitle(nextActive?.title ?? "");
          setStatus("Saved to database");
        }
      } catch (error) {
        if (!cancelled) {
          setStatus(
            error instanceof Error ? error.message : "Unable to load notes",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          isBootstrappingRef.current = false;
        }
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
      isMountedRef.current = false;
    };
  }, [storageKey]);

  const selectNote = (noteId: number) => {
    const nextNote = notes.find((note) => note.id === noteId);
    if (!nextNote) {
      return;
    }

    setOpenNoteIds((current) =>
      current.includes(noteId) ? current : [...current, noteId],
    );
    syncCurrentDraft(nextNote);
    setIsOpenDrawer(false);
  };

  const handleCreateNote = async () => {
    try {
      const response = await createNote({ title: "", text: "" });
      const nextNote = response.item;

      setNotes((current) => sortByUpdatedAt([...current, nextNote]));
      setOpenNoteIds((current) =>
        current.includes(nextNote.id) ? current : [...current, nextNote.id],
      );
      setCurrentNoteId(nextNote.id);
      setDraftText("");
      setDraftTitle("");
      setStatus("New note created");
      setIsOpenDrawer(false);
    } catch {
      setStatus("Could not create note");
    }
  };

  const handleDeleteNote = async (noteId: number) => {
    clearScheduledSave(noteId);

    try {
      await deleteNote(noteId);
      const nextNotes = notes.filter((note) => note.id !== noteId);
      const nextOpenNoteIds = openNoteIds.filter((id) => id !== noteId);

      if (nextNotes.length === 0) {
        const created = await createNote({ title: "", text: "" });
        const fallbackNote = created.item;
        setNotes([fallbackNote]);
        setOpenNoteIds([fallbackNote.id]);
        setCurrentNoteId(fallbackNote.id);
        setDraftText("");
        setDraftTitle("");
        setIsTitlePromptOpen(false);
        setStatus("Note deleted");
        setIsOpenDrawer(false);
        return;
      }

      setNotes(sortByUpdatedAt(nextNotes));
      setOpenNoteIds(nextOpenNoteIds);
      if (currentNoteId === noteId) {
        const nextActiveId =
          nextOpenNoteIds[nextOpenNoteIds.length - 1] ??
          nextNotes[0]?.id ??
          null;
        const nextActiveNote =
          nextActiveId !== null
            ? nextNotes.find((note) => note.id === nextActiveId) ?? null
            : null;

        setCurrentNoteId(nextActiveNote?.id ?? null);
        setDraftText(nextActiveNote?.text ?? "");
        setDraftTitle(nextActiveNote?.title ?? "");
      }
      setIsTitlePromptOpen(false);
      setStatus("Note deleted");
      setIsOpenDrawer(false);
    } catch {
      setStatus("Could not delete note");
    }
  };

  const handleCloseTab = (noteId: number) => {
    setOpenNoteIds((current) => {
      const nextOpen = current.filter((id) => id !== noteId);

      if (currentNoteId === noteId) {
        const nextActiveId = nextOpen[nextOpen.length - 1] ?? null;
        const nextActiveNote = nextActiveId
          ? notes.find((note) => note.id === nextActiveId) ?? null
          : null;

        setCurrentNoteId(nextActiveId);
        setDraftText(nextActiveNote?.text ?? "");
        setDraftTitle(nextActiveNote?.title ?? "");
        setIsTitlePromptOpen(false);
      }

      return nextOpen;
    });
  };

  const handleSave = () => {
    if (!currentNote) {
      return;
    }

    setDraftTitle(currentNote.title);
    setIsTitlePromptOpen(true);
  };

  const confirmSave = async () => {
    if (!currentNote) {
      return;
    }

    const nextTitle = draftTitle.trim();
    clearScheduledSave(currentNote.id);
    try {
      const response = await updateNote(currentNote.id, {
        title: nextTitle,
        text: draftText,
      });

      setNotes((current) =>
        sortByUpdatedAt(
          current.map((note) => (note.id === response.item.id ? response.item : note)),
        ),
      );
      setDraftTitle(response.item.title);
      setDraftText(response.item.text);
      setCurrentNoteId(response.item.id);
      setStatus("Saved to database");
      setIsTitlePromptOpen(false);
    } catch {
      setStatus("Could not save note");
    }
  };

  const closeNotePicker = () => setIsOpenDrawer(false);

  const openTabs = openNoteIds
    .map((noteId) => notes.find((note) => note.id === noteId))
    .filter((note): note is Note => Boolean(note));

  const allNotes = useMemo(() => sortByUpdatedAt(notes), [notes]);
  const visibleNotes = useMemo(() => {
    const query = noteSearch.trim().toLowerCase();
    if (!query) {
      return allNotes;
    }

    return allNotes.filter((note) => {
      const title = note.title.toLowerCase();
      const text = note.text.toLowerCase();
      return title.includes(query) || text.includes(query);
    });
  }, [allNotes, noteSearch]);

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-[linear-gradient(180deg,rgb(var(--color-panel))_0%,rgb(var(--color-surface))_100%)] text-ink">
      <div className="border-b border-line bg-window-chrome/85 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pb-1">
            {openTabs.length > 0 ? (
              openTabs.map((note) => {
                const isActive = note.id === currentNoteId;

                return (
                  <div
                    key={note.id}
                    className={`flex shrink-0 items-center gap-2 rounded-xl border px-3 py-1.5 text-xs transition ${
                      isActive
                        ? "border-accent/45 bg-accent/12 text-ink"
                        : "border-line bg-surface/80 text-muted hover:border-line-strong/40 hover:bg-surface"
                    }`}
                  >
                    <button
                      className="max-w-[11rem] truncate text-left"
                      onClick={() => selectNote(note.id)}
                      type="button"
                    >
                      {displayNoteTitle(note)}
                    </button>
                    <button
                      aria-label={`Close ${displayNoteTitle(note)}`}
                      className="rounded-md px-1 text-muted transition hover:bg-surface hover:text-ink"
                      onClick={() => handleCloseTab(note.id)}
                      type="button"
                    >
                      x
                    </button>
                  </div>
                );
              })
            ) : (
              <div className="rounded-xl border border-dashed border-line px-3 py-1.5 text-xs text-muted">
                No notes open
              </div>
            )}

            <button
              aria-label="Create new note"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-dashed border-accent/35 bg-accent/10 text-lg leading-none text-accent transition hover:border-accent/55 hover:bg-accent/20"
              onClick={() => void handleCreateNote()}
              type="button"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          <button
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-2xl border border-line bg-surface/80 px-3.5 text-xs font-medium text-muted transition hover:border-accent/30 hover:bg-accent/8 hover:text-ink"
            onClick={() => setIsOpenDrawer((current) => !current)}
            type="button"
          >
            <FileText className="h-3.5 w-3.5" />
            Open
          </button>

          <button
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-2xl border border-accent/30 bg-accent/12 px-3.5 text-xs font-medium text-accent transition hover:border-accent/50 hover:bg-accent/18"
            onClick={() => void handleSave()}
            type="button"
          >
            <Save className="h-3.5 w-3.5" />
            Save
          </button>
        </div>
      </div>

      {status ? (
        <div className="border-b border-line bg-surface/70 px-4 py-2 text-xs text-muted">
          {status}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-5">
        {currentNote ? (
          <textarea
            className="min-h-0 flex-1 resize-none rounded-3xl border border-line bg-panel/90 px-5 py-4 text-sm leading-6 text-ink outline-none transition placeholder:text-muted focus:border-accent/45 focus:ring-2 focus:ring-accent/12"
            placeholder="Start typing your notes here..."
            value={draftText}
            onChange={(event) => {
              const nextText = event.target.value;
              setDraftText(nextText);
              setStatus("Saving...");
              if (currentNote) {
                scheduleAutosave(currentNote.id, currentNote.title, nextText);
              }
            }}
          />
        ) : (
          <div className="grid flex-1 place-items-center rounded-3xl border border-dashed border-line bg-panel/70 px-6 py-10 text-center text-sm text-muted">
            <div className="max-w-sm">
              <p className="font-medium text-ink">No note open</p>
              <p className="mt-2">
                Open a saved note, or create a new one with the plus button.
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <span>
            {draftText.length.toLocaleString()} character{draftText.length === 1 ? "" : "s"}
          </span>
          <span>{activeNoteLabel}</span>
        </div>
      </div>

      {isOpenDrawer ? (
        <div
          className="absolute inset-0 z-10 flex justify-start bg-slate-950/35 backdrop-blur-[2px]"
          onClick={closeNotePicker}
          role="presentation"
        >
          <div
            className="flex h-full w-full max-w-md flex-col border-r border-line bg-panel shadow-[0_30px_90px_rgba(15,23,42,0.24)]"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Open note"
          >
            <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold tracking-tight">Open note</h3>
                <p className="mt-1 text-sm text-muted">
                  Pick any saved note to open it in a tab.
              </p>
            </div>

              <button
                aria-label="Close note picker"
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-surface/80 text-muted transition hover:bg-surface hover:text-ink"
                onClick={closeNotePicker}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="border-b border-line px-5 py-4">
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                Search
              </label>
              <input
                className="mt-2 h-11 w-full rounded-2xl border border-line bg-surface px-4 text-sm text-ink outline-none transition placeholder:text-muted focus:border-accent/45 focus:ring-2 focus:ring-accent/12"
                placeholder="Search title or note text"
                value={noteSearch}
                onChange={(event) => setNoteSearch(event.target.value)}
              />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {visibleNotes.length > 0 ? (
                <div className="grid gap-2">
                  {visibleNotes.map((note) => {
                    const isOpen = openNoteIds.includes(note.id);

                    return (
                      <div
                        key={note.id}
                        className={`rounded-2xl border px-4 py-3 text-left transition ${
                          isOpen
                            ? "border-accent/35 bg-accent/10"
                            : "border-line bg-surface/80 hover:border-accent/20 hover:bg-surface"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <button
                            className="min-w-0 flex-1 text-left"
                            onClick={() => selectNote(note.id)}
                            type="button"
                          >
                            <p className="truncate text-sm font-medium text-ink">
                              {displayNoteTitle(note)}
                            </p>
                            <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted">
                              {note.text.trim() ? note.text.trim() : "Blank note"}
                            </p>
                          </button>
                          <div className="flex shrink-0 items-center gap-1">
                            <span className="rounded-full border border-line bg-panel px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-muted">
                              {isOpen ? "Open" : "Closed"}
                            </span>
                            <button
                              aria-label={`Delete ${displayNoteTitle(note)}`}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-danger/20 bg-danger/10 text-danger-ink transition hover:border-danger/35 hover:bg-danger/15"
                              onClick={() => void handleDeleteNote(note.id)}
                              type="button"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                        <p className="mt-3 text-[11px] text-muted">
                          Updated {new Intl.DateTimeFormat(undefined, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          }).format(new Date(note.updatedAt))}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="grid place-items-center rounded-2xl border border-dashed border-line px-4 py-10 text-center text-sm text-muted">
                  {noteSearch.trim() ? "No notes match your search." : "No saved notes yet."}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {isTitlePromptOpen && currentNote ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/40 px-4 backdrop-blur-[2px]">
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
                onClick={() => setIsTitlePromptOpen(false)}
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
                placeholder="Title this note"
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void confirmSave();
                  }
                }}
              />
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                className="inline-flex h-10 items-center justify-center rounded-2xl border border-line bg-surface/80 px-4 text-sm font-medium text-muted transition hover:bg-surface hover:text-ink"
                onClick={() => setIsTitlePromptOpen(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="inline-flex h-10 items-center gap-2 rounded-2xl border border-accent/30 bg-accent/12 px-4 text-sm font-medium text-accent transition hover:border-accent/50 hover:bg-accent/18"
                onClick={() => void confirmSave()}
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
