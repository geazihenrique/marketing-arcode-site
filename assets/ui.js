(function () {
  const weekdayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
  const state = {
    events: [],
    currentMonth: startOfMonth(new Date()),
    selectedDate: formatDateKey(new Date()),
    expandedDates: new Set()
  };

  document.addEventListener("DOMContentLoaded", async () => {
    bindGlobalNotesForm();

    try {
      state.events = await window.DataApi.loadEvents();
      setSourceStatus("Planilha Controle de O.S.");
    } catch (_error) {
      setSourceStatus("Erro ao carregar planilha");
    }

    const page = document.body.dataset.page;

    if (page === "home") {
      renderHome();
    }

    if (page === "calendar") {
      initCalendarPage();
    }

    if (page === "agenda") {
      renderAgendaPage();
    }

    if (page === "notes") {
      renderNotesPage();
    }
  });

  function initCalendarPage() {
    const weekdayHeader = document.getElementById("weekdayHeader");
    weekdayHeader.innerHTML = weekdayNames.map((name) => `<div class="weekday">${name}</div>`).join("");

    document.getElementById("prevMonthBtn").addEventListener("click", () => {
      state.currentMonth = addMonths(state.currentMonth, -1);
      renderCalendarPage();
    });

    document.getElementById("nextMonthBtn").addEventListener("click", () => {
      state.currentMonth = addMonths(state.currentMonth, 1);
      renderCalendarPage();
    });

    document.getElementById("todayBtn").addEventListener("click", () => {
      const today = new Date();
      state.currentMonth = startOfMonth(today);
      state.selectedDate = formatDateKey(today);
      renderCalendarPage();
    });

    renderCalendarPage();
  }

  function renderHome() {
    document.getElementById("statMonthCount").textContent = String(getMonthEvents().length);
    document.getElementById("statUpcomingCount").textContent = String(getUpcomingEvents().length);
    document.getElementById("statSegments").textContent = String(getUniqueSegments().length);
    document.getElementById("homeUpcomingList").innerHTML = renderEventCards(getUpcomingEvents().slice(0, 5), "Sem próximas entregas.");
    document.getElementById("recentNotesList").innerHTML = renderNotesCards(window.NotesApi.getNotes().slice(0, 5), "Nenhuma anotação manual ainda.");
  }

  function renderCalendarPage() {
    document.getElementById("currentMonthLabel").textContent = formatMonthLabel(state.currentMonth);
    document.getElementById("calendarUpcomingList").innerHTML = renderEventCards(getUpcomingEvents().slice(0, 5), "Sem próximas entregas.");
    document.getElementById("mobileAgendaList").innerHTML = renderGroupedMonthAgenda();
    document.getElementById("selectedDateLabel").textContent = formatLongDateLabel(state.selectedDate);
    document.getElementById("selectedDayEvents").innerHTML = renderEventCards(
      state.events.filter((event) => event.dateKey === state.selectedDate),
      "Nenhum detalhe para esta data."
    );
    document.getElementById("calendarGrid").innerHTML = renderCalendarGrid();
    bindCalendarInteractions();
  }

  function renderAgendaPage() {
    const groups = groupEventsByDate(state.events);
    const sortedDates = Array.from(groups.keys()).sort();
    document.getElementById("agendaGroupedList").innerHTML = sortedDates
      .map((dateKey) => {
        const dayEvents = groups.get(dateKey) || [];
        return `
          <article class="agenda-group">
            <div class="section-head">
              <h3>${escapeHtml(formatLongDateLabel(dateKey))}</h3>
              <span class="muted-text">${dayEvents.length} entrega(s)</span>
            </div>
            ${renderEventCards(dayEvents, "")}
          </article>
        `;
      })
      .join("");
  }

  function renderNotesPage() {
    document.getElementById("manualNotesList").innerHTML = renderNotesCards(window.NotesApi.getNotes(), "Nenhuma anotação salva.");
    bindDeleteNoteButtons();
  }

  function bindGlobalNotesForm() {
    const form = document.getElementById("manualNoteForm");
    if (!form) {
      return;
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      window.NotesApi.saveNote({
        orderNumber: formData.get("orderNumber"),
        clientName: formData.get("clientName"),
        title: formData.get("title"),
        note: formData.get("note")
      });
      form.reset();
      renderNotesPage();
    });
  }

  function bindDeleteNoteButtons() {
    document.querySelectorAll("[data-delete-note]").forEach((button) => {
      button.addEventListener("click", () => {
        window.NotesApi.deleteNote(button.dataset.deleteNote);
        renderNotesPage();
      });
    });
  }

  function renderCalendarGrid() {
    const monthStart = startOfMonth(state.currentMonth);
    const monthEnd = endOfMonth(state.currentMonth);
    const gridStart = startOfWeek(monthStart);
    const gridEnd = endOfWeek(monthEnd);
    const todayKey = formatDateKey(new Date());
    const eventsByDate = groupEventsByDate(state.events);
    const days = [];

    for (let cursor = new Date(gridStart); cursor <= gridEnd; cursor = addDays(cursor, 1)) {
      const dateKey = formatDateKey(cursor);
      const dayEvents = eventsByDate.get(dateKey) || [];
      const expanded = state.expandedDates.has(dateKey);
      const visibleEvents = expanded ? dayEvents : dayEvents.slice(0, 2);

      days.push(`
        <button class="day-cell ${cursor.getMonth() !== monthStart.getMonth() ? "outside-month" : ""} ${dateKey === todayKey ? "today" : ""} ${dateKey === state.selectedDate ? "selected" : ""}" data-date="${dateKey}">
          <div class="day-number">${cursor.getDate()}</div>
          <div class="day-count">${dayEvents.length ? `${dayEvents.length} entrega(s)` : ""}</div>
          ${visibleEvents.map((event) => `<div class="event-chip">${escapeHtml(event.title)}</div>`).join("")}
          ${
            dayEvents.length > 2
              ? `<span class="expand-btn" data-expand="${dateKey}">${expanded ? "Ver menos" : `Ver mais ${dayEvents.length - visibleEvents.length}`}</span>`
              : ""
          }
        </button>
      `);
    }

    return days.join("");
  }

  function bindCalendarInteractions() {
    document.querySelectorAll("[data-date]").forEach((button) => {
      button.addEventListener("click", () => {
        state.selectedDate = button.dataset.date;
        renderCalendarPage();
      });
    });

    document.querySelectorAll("[data-expand]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        const dateKey = button.dataset.expand;
        if (state.expandedDates.has(dateKey)) {
          state.expandedDates.delete(dateKey);
        } else {
          state.expandedDates.add(dateKey);
        }
        renderCalendarPage();
      });
    });
  }

  function renderGroupedMonthAgenda() {
    const groups = groupEventsByDate(getMonthEvents());
    const sortedDates = Array.from(groups.keys()).sort();

    if (sortedDates.length === 0) {
      return '<p class="empty-state">Nenhuma entrega neste mês.</p>';
    }

    return sortedDates
      .map((dateKey) => `
        <article class="mobile-day-group">
          <div class="section-head">
            <h3>${escapeHtml(formatLongDateLabel(dateKey))}</h3>
            <span class="muted-text">${groups.get(dateKey).length} entrega(s)</span>
          </div>
          ${renderEventCards(groups.get(dateKey), "")}
        </article>
      `)
      .join("");
  }

  function renderEventCards(events, emptyMessage) {
    if (events.length === 0) {
      return `<p class="empty-state">${emptyMessage}</p>`;
    }

    return events
      .map(
        (event) => `
          <article class="event-card">
            <h3>${escapeHtml(event.title)}</h3>
            <div class="event-meta">
              <span>${escapeHtml(formatLongDateLabel(event.dateKey))}</span>
              ${event.categories.length ? `<span>${escapeHtml(event.categories.join(" • "))}</span>` : ""}
            </div>
            ${event.owner ? `<div class="status">${escapeHtml(event.owner)}</div>` : ""}
            ${event.producer ? `<p class="detail-line"><span class="detail-label">Produtor:</span> ${escapeHtml(event.producer)}</p>` : ""}
            ${event.notes ? `<p class="detail-line"><span class="detail-label">Observações:</span> ${escapeHtml(event.notes)}</p>` : ""}
          </article>
        `
      )
      .join("");
  }

  function renderNotesCards(notes, emptyMessage) {
    if (notes.length === 0) {
      return `<p class="empty-state">${emptyMessage}</p>`;
    }

    return notes
      .map(
        (note) => `
          <article class="event-card">
            <h3>${escapeHtml(note.title)}</h3>
            <div class="event-meta">
              <span>O.S. ${escapeHtml(note.orderNumber)}</span>
              <span>${escapeHtml(note.clientName)}</span>
            </div>
            <p class="event-description">${escapeHtml(note.note)}</p>
            <button class="delete-note-btn" data-delete-note="${escapeHtml(note.createdAt)}">Remover</button>
          </article>
        `
      )
      .join("");
  }

  function getMonthEvents() {
    const month = state.currentMonth.getMonth();
    const year = state.currentMonth.getFullYear();
    return state.events.filter((event) => event.dateObject.getMonth() === month && event.dateObject.getFullYear() === year);
  }

  function getUpcomingEvents() {
    const today = startOfDay(new Date());
    return state.events.filter((event) => event.dateObject >= today).slice(0, 8);
  }

  function getUniqueSegments() {
    return Array.from(new Set(state.events.flatMap((event) => event.categories)));
  }

  function groupEventsByDate(events) {
    return events.reduce((map, event) => {
      const existing = map.get(event.dateKey) || [];
      existing.push(event);
      map.set(event.dateKey, existing);
      return map;
    }, new Map());
  }

  function setSourceStatus(text) {
    document.querySelectorAll("#sourceStatus").forEach((node) => {
      node.textContent = text;
    });
  }

  function formatMonthLabel(date) {
    return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(date);
  }

  function formatLongDateLabel(dateKey) {
    const date = typeof dateKey === "string" ? parseDateFromKey(dateKey) : dateKey;
    return new Intl.DateTimeFormat("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric"
    }).format(date);
  }

  function formatDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function parseDateFromKey(key) {
    const [year, month, day] = key.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  function endOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
  }

  function startOfWeek(date) {
    return addDays(date, -date.getDay());
  }

  function endOfWeek(date) {
    return addDays(date, 6 - date.getDay());
  }

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function addDays(date, amount) {
    const result = new Date(date);
    result.setDate(result.getDate() + amount);
    return result;
  }

  function addMonths(date, amount) {
    return new Date(date.getFullYear(), date.getMonth() + amount, 1);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }
})();
