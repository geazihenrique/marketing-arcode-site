(function () {
  const STORAGE_KEY = "marketing-arcode-notes";

  function getNotes() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch (_error) {
      return [];
    }
  }

  function saveNote(note) {
    const notes = getNotes();
    notes.unshift({
      ...note,
      createdAt: new Date().toISOString()
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    return notes;
  }

  function deleteNote(createdAt) {
    const notes = getNotes().filter((note) => note.createdAt !== createdAt);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    return notes;
  }

  window.NotesApi = {
    getNotes,
    saveNote,
    deleteNote
  };
})();
