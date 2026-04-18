(function () {
  const weekdayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
  const queueFilterOptions = ["Todos", "Edicao", "Producao", "Agendado", "Ideia", "Hoje", "Semana"];

  const state = {
    queueItems: [],
    calendarItems: [],
    queueFilter: "Todos",
    queueError: null,
    calendarError: null,
    currentMonth: startOfMonth(new Date()),
    selectedDate: formatDateKey(new Date())
  };

  document.addEventListener("DOMContentLoaded", async () => {
    const page = document.body.dataset.page;
    renderLoadingState(page);
    bindSearchForm();

    if (page === "calendar") {
      await loadCalendarSource();
      setSourceStatus(state.calendarError ? "Erro ao carregar planilha" : "Planilha VENDAS OS conectada");
    } else {
      await loadQueueSource();
      setSourceStatus(state.queueError ? "Erro ao carregar planilha" : "Planilha MKT conectada");
    }

    if (page === "home") {
      renderHome();
    }

    if (page === "queue") {
      renderQueuePage();
    }

    if (page === "calendar") {
      initCalendarPage();
    }

    if (page === "agenda") {
      renderUpcomingPage();
    }
  });

  async function loadQueueSource() {
    try {
      state.queueItems = await window.DataApi.loadQueueItems();
      state.queueError = null;
    } catch (_error) {
      state.queueItems = [];
      state.queueError = "Não foi possível carregar a aba MKT agora.";
    }
  }

  async function loadCalendarSource() {
    try {
      state.calendarItems = await window.DataApi.loadCalendarItems();
      state.calendarError = null;
    } catch (_error) {
      state.calendarItems = [];
      state.calendarError = "Não foi possível carregar a aba VENDAS OS agora.";
    }
  }

  function renderLoadingState(page) {
    if (page === "home") {
      setText("statOverdueCount", "...");
      setText("statDueTodayCount", "...");
      setText("statNoDueCount", "...");
      fillNode("homeOverdueList", renderSkeletonCards(2));
      fillNode("homeDueTodayList", renderSkeletonCards(2));
      fillNode("homeScheduledList", renderSkeletonCards(2));
      fillNode("homeIdeasNoDueList", renderSkeletonCards(2));
    }

    if (page === "queue") {
      fillNode("queueCounters", renderSkeletonCounters());
      fillNode("queueFilters", renderSkeletonFilters());
      fillNode(
        "queueGroups",
        `<section class="panel queue-group"><div class="event-list">${renderSkeletonCards(4)}</div></section>`
      );
      fillNode("searchResults", renderSkeletonCards(2));
    }

    if (page === "calendar") {
      fillNode("calendarUpcomingList", renderSkeletonCards(2));
      fillNode("selectedDayEvents", renderSkeletonCards(2));
      fillNode(
        "calendarGrid",
        `<div class="empty-state">Carregando calendário...</div>`
      );
      fillNode("searchResults", renderSkeletonCards(2));
    }

    if (page === "agenda") {
      fillNode("agendaGroupedList", renderSkeletonCards(4));
      fillNode("searchResults", renderSkeletonCards(2));
    }
  }

  function renderHome() {
    renderEditorialReminders();
    initializeSearchPanel();

    const overdueNode = document.getElementById("homeOverdueList");
    const dueTodayNode = document.getElementById("homeDueTodayList");
    const scheduledNode = document.getElementById("homeScheduledList");
    const ideasNode = document.getElementById("homeIdeasNoDueList");

    if (!overdueNode || !dueTodayNode || !scheduledNode || !ideasNode) {
      return;
    }

    if (state.queueError) {
      renderErrorState(overdueNode, state.queueError);
      renderErrorState(dueTodayNode, state.queueError);
      renderErrorState(scheduledNode, state.queueError);
      renderErrorState(ideasNode, state.queueError);
      setText("statOverdueCount", "0");
      setText("statDueTodayCount", "0");
      setText("statNoDueCount", "0");
      return;
    }

    const operational = getOperationalQueueItems();
    const now = new Date();
    const today = startOfDay(now);
    const tomorrow = addDays(today, 1);

    const overdue = operational.filter((item) => item.hasDueDate && item.dueDateTime < now);
    const dueToday = operational.filter(
      (item) => item.hasDueDate && item.dueDateTime >= today && item.dueDateTime < tomorrow
    );
    const scheduledNext = operational.filter(
      (item) => item.statusNormalized === "AGENDADO" && item.hasDueDate && item.dueDateTime >= tomorrow
    );
    const ideasNoDue = operational.filter((item) => item.statusNormalized === "IDEIA" && !item.hasDueDate);

    setText("statOverdueCount", String(overdue.length));
    setText("statDueTodayCount", String(dueToday.length));
    setText("statNoDueCount", String(operational.filter((item) => !item.hasDueDate).length));

    overdueNode.innerHTML = renderQueueCards(overdue.slice(0, 6), "Sem itens atrasados.");
    dueTodayNode.innerHTML = renderQueueCards(dueToday.slice(0, 6), "Nenhuma entrega vence hoje.");
    scheduledNode.innerHTML = renderQueueCards(
      scheduledNext.slice(0, 6),
      "Nenhum agendamento futuro no momento."
    );
    ideasNode.innerHTML = renderQueueCards(ideasNoDue.slice(0, 6), "Nenhuma ideia sem prazo.");
  }

  function renderQueuePage() {
    initializeSearchPanel();

    const countersNode = document.getElementById("queueCounters");
    const filtersNode = document.getElementById("queueFilters");
    const groupsNode = document.getElementById("queueGroups");

    if (!countersNode || !filtersNode || !groupsNode) {
      return;
    }

    if (state.queueError) {
      countersNode.innerHTML = "";
      filtersNode.innerHTML = "";
      renderErrorState(groupsNode, state.queueError);
      return;
    }

    const now = new Date();
    const today = startOfDay(now);
    const operational = getOperationalQueueItems();

    const counters = {
      "Em edição": operational.filter((item) => item.statusNormalized === "EM EDICAO").length,
      "Em produção": operational.filter((item) => item.statusNormalized === "EM PRODUCAO").length,
      Agendado: operational.filter((item) => item.statusNormalized === "AGENDADO").length,
      Ideia: operational.filter((item) => item.statusNormalized === "IDEIA").length,
      "Sem prazo": operational.filter((item) => !item.hasDueDate).length
    };

    countersNode.innerHTML = Object.entries(counters)
      .map(
        ([label, value]) => `
          <article class="queue-counter">
            <span>${label}</span>
            <strong>${value}</strong>
          </article>
        `
      )
      .join("");

    filtersNode.innerHTML = queueFilterOptions
      .map(
        (option) =>
          `<button class="filter-chip ${state.queueFilter === option ? "is-active" : ""}" data-filter="${option}">${formatFilterLabel(option)}</button>`
      )
      .join("");

    filtersNode.querySelectorAll("[data-filter]").forEach((button) => {
      button.addEventListener("click", () => {
        state.queueFilter = button.dataset.filter;
        renderQueuePage();
      });
    });

    const filtered = applyQueueFilter(operational, state.queueFilter, today);
    const groups = {
      Atrasados: filtered.filter((item) => item.hasDueDate && item.dueDateTime < now),
      Hoje: filtered.filter((item) => item.hasDueDate && isSameDate(item.dueDateTime, today)),
      Próximos: filtered.filter((item) => item.hasDueDate && item.dueDateTime > endOfDay(today)),
      "Sem prazo": filtered.filter((item) => !item.hasDueDate)
    };

    groupsNode.innerHTML = Object.entries(groups)
      .map(
        ([title, items]) => `
          <section class="panel queue-group">
            <div class="section-head">
              <h3>${title}</h3>
              <span class="muted-text">${items.length} ${items.length === 1 ? "item" : "itens"}</span>
            </div>
            <div class="event-list">${renderQueueCards(items, `Nenhum item em ${title.toLowerCase()}.`)}</div>
          </section>
        `
      )
      .join("");
  }

  function initCalendarPage() {
    initializeSearchPanel();

    const weekdayHeader = document.getElementById("weekdayHeader");
    const prevMonthBtn = document.getElementById("prevMonthBtn");
    const nextMonthBtn = document.getElementById("nextMonthBtn");
    const todayBtn = document.getElementById("todayBtn");

    if (!weekdayHeader || !prevMonthBtn || !nextMonthBtn || !todayBtn) {
      return;
    }

    weekdayHeader.innerHTML = weekdayNames.map((name) => `<div class="weekday">${name}</div>`).join("");

    prevMonthBtn.addEventListener("click", () => {
      state.currentMonth = addMonths(state.currentMonth, -1);
      renderCalendarPage();
    });

    nextMonthBtn.addEventListener("click", () => {
      state.currentMonth = addMonths(state.currentMonth, 1);
      renderCalendarPage();
    });

    todayBtn.addEventListener("click", () => {
      const today = new Date();
      state.currentMonth = startOfMonth(today);
      state.selectedDate = formatDateKey(today);
      renderCalendarPage();
    });

    renderCalendarPage();
  }

  function renderCalendarPage() {
    const monthLabel = document.getElementById("currentMonthLabel");
    const upcomingNode = document.getElementById("calendarUpcomingList");
    const gridNode = document.getElementById("calendarGrid");
    const selectedDateLabel = document.getElementById("selectedDateLabel");
    const selectedDayNode = document.getElementById("selectedDayEvents");

    if (!monthLabel || !upcomingNode || !gridNode || !selectedDateLabel || !selectedDayNode) {
      return;
    }

    if (state.calendarError) {
      renderErrorState(upcomingNode, state.calendarError);
      renderErrorState(selectedDayNode, state.calendarError);
      gridNode.innerHTML = "";
      return;
    }

    monthLabel.textContent = formatMonthLabel(state.currentMonth);
    upcomingNode.innerHTML = renderCalendarDetailCards(getUpcomingCalendarItems().slice(0, 5), "Sem próximas entregas.");
    gridNode.innerHTML = renderCalendarGrid(state.calendarItems, state.currentMonth, state.selectedDate);
    bindCalendarInteractions();

    selectedDateLabel.textContent = formatLongDateLabel(state.selectedDate);
    selectedDayNode.innerHTML = renderCalendarDetailCards(
      state.calendarItems.filter((item) => item.dateKey === state.selectedDate),
      "Nenhuma entrega para esta data."
    );
  }

  function renderUpcomingPage() {
    initializeSearchPanel();

    const listNode = document.getElementById("agendaGroupedList");
    if (!listNode) {
      return;
    }

    if (state.queueError) {
      renderErrorState(listNode, state.queueError);
      return;
    }

    const future = getUpcomingQueueItems().filter((item) => item.hasDueDate);
    const grouped = groupQueueByDate(future);
    const keys = Array.from(grouped.keys()).sort();

    if (keys.length === 0) {
      listNode.innerHTML = '<p class="empty-state">Nenhuma próxima entrega encontrada.</p>';
      return;
    }

    listNode.innerHTML = keys
      .map((key) => {
        const items = grouped.get(key) || [];
        return `
          <article class="agenda-group">
            <div class="section-head">
              <h3>${formatLongDateLabel(key)}</h3>
              <span class="muted-text">${items.length} ${items.length === 1 ? "entrega" : "entregas"}</span>
            </div>
            ${renderQueueCards(items, "")}
          </article>
        `;
      })
      .join("");
  }

  function applyQueueFilter(items, filterName, today) {
    if (filterName === "Todos") {
      return items;
    }

    if (filterName === "Edicao") {
      return items.filter((item) => item.statusNormalized === "EM EDICAO" || item.statusNormalized === "FILA");
    }

    if (filterName === "Producao") {
      return items.filter((item) => item.statusNormalized === "EM PRODUCAO");
    }

    if (filterName === "Agendado") {
      return items.filter((item) => item.statusNormalized === "AGENDADO");
    }

    if (filterName === "Ideia") {
      return items.filter((item) => item.statusNormalized === "IDEIA");
    }

    if (filterName === "Hoje") {
      return items.filter((item) => item.hasDueDate && isSameDate(item.dueDateTime, today));
    }

    if (filterName === "Semana") {
      const end = endOfDay(addDays(today, 6));
      return items.filter((item) => item.hasDueDate && item.dueDateTime >= today && item.dueDateTime <= end);
    }

    return items;
  }

  function formatFilterLabel(filterName) {
    const labels = {
      Todos: "Todos",
      Edicao: "Edição",
      Producao: "Produção",
      Agendado: "Agendado",
      Ideia: "Ideia",
      Hoje: "Hoje",
      Semana: "Semana"
    };

    return labels[filterName] || filterName;
  }

  function renderQueueCards(items, emptyMessage) {
    if (items.length === 0) {
      return `<p class="empty-state">${emptyMessage}</p>`;
    }

    return items
      .map(
        (item) => `
          <article class="event-card queue-item-card">
            <div class="queue-subline">${item.channel ? escapeHtml(item.channel) : "Canal não informado"}</div>
            <h3>${escapeHtml(item.content)}</h3>
            <div class="queue-item-grid">
              <div>
                <span class="queue-label">Prazo</span>
                <strong>${escapeHtml(item.dueLabel)}</strong>
              </div>
              <div>
                <span class="queue-label">Status</span>
                <span class="status-chip">${escapeHtml(item.status)}</span>
              </div>
              <div>
                <span class="queue-label">Responsável atual</span>
                <strong>${escapeHtml(item.responsibleCurrent)}</strong>
              </div>
            </div>
          </article>
        `
      )
      .join("");
  }

  function renderCalendarGrid(items, monthDate, selectedDate) {
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);
    const gridStart = startOfWeek(monthStart);
    const gridEnd = endOfWeek(monthEnd);
    const groups = groupCalendarByDate(items);
    const todayKey = formatDateKey(new Date());
    const days = [];

    for (let cursor = new Date(gridStart); cursor <= gridEnd; cursor = addDays(cursor, 1)) {
      const key = formatDateKey(cursor);
      const dayItems = groups.get(key) || [];
      const previewItems = dayItems.slice(0, 2);
      const extraCount = dayItems.length - previewItems.length;

      days.push(`
        <button class="day-cell ${cursor.getMonth() !== monthStart.getMonth() ? "outside-month" : ""} ${key === selectedDate ? "selected" : ""} ${key === todayKey ? "today" : ""}" data-date="${key}">
          <div class="day-number">${cursor.getDate()}</div>
          <div class="day-count">${dayItems.length ? `${dayItems.length} ${dayItems.length === 1 ? "entrega" : "entregas"}` : ""}</div>
          <div class="calendar-mini-list">
            ${previewItems.map((item) => renderCalendarMiniCard(item)).join("")}
            ${extraCount > 0 ? `<div class="calendar-more">+${extraCount} mais</div>` : ""}
          </div>
        </button>
      `);
    }

    return days.join("");
  }

  function renderCalendarMiniCard(item) {
    return `
      <article class="calendar-mini-card ${getCalendarCategoryClass(item.categoryType)}">
        ${item.categoryType ? `<span class="calendar-badge">${item.categoryType}</span>` : ""}
        <div class="calendar-os">OS ${escapeHtml(item.orderNumber)}</div>
        <div class="calendar-client">${escapeHtml(item.clientName)}</div>
        <div class="calendar-producer">${escapeHtml(item.producer)}</div>
      </article>
    `;
  }

  function renderCalendarDetailCards(items, emptyMessage) {
    if (items.length === 0) {
      return `<p class="empty-state">${emptyMessage}</p>`;
    }

    return items
      .map(
        (item) => `
          <article class="event-card calendar-detail-card ${getCalendarCategoryClass(item.categoryType)}">
            <div class="calendar-detail-header">
              <strong>OS ${escapeHtml(item.orderNumber)}</strong>
              ${item.categoryType ? `<span class="calendar-badge">${item.categoryType}</span>` : ""}
            </div>
            <p class="detail-line"><span class="detail-label">Cliente / Solicitante:</span> <span class="calendar-client">${escapeHtml(item.clientName)}</span></p>
            <p class="detail-line"><span class="detail-label">Produtor:</span> ${escapeHtml(item.producer)}</p>
          </article>
        `
      )
      .join("");
  }

  function getCalendarCategoryClass(categoryType) {
    if (categoryType === "EVENTO") {
      return "calendar-highlight calendar-highlight-evento";
    }

    if (categoryType === "FEIRA") {
      return "calendar-highlight calendar-highlight-feira";
    }

    if (categoryType === "STAND") {
      return "calendar-highlight calendar-highlight-stand";
    }

    return "";
  }

  function bindCalendarInteractions() {
    document.querySelectorAll("[data-date]").forEach((button) => {
      button.addEventListener("click", () => {
        state.selectedDate = button.dataset.date;
        renderCalendarPage();
      });
    });
  }

  function bindSearchForm() {
    const form = document.getElementById("searchForm");
    const input = document.getElementById("searchInput");

    if (!form || !input) {
      return;
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const query = input.value.trim();
      const resultsNode = document.getElementById("searchResults");

      if (!resultsNode) {
        return;
      }

      if (!query) {
        resultsNode.innerHTML = '<p class="empty-state">Digite um número de O.S., nome do cliente ou palavra-chave.</p>';
        return;
      }

      resultsNode.innerHTML = renderSkeletonCards(2);

      try {
        const records = await window.DataApi.searchRecords(query);
        resultsNode.innerHTML = renderSearchResults(records);
      } catch (_error) {
        resultsNode.innerHTML = '<p class="empty-state">Não foi possível concluir a busca agora.</p>';
      }
    });
  }

  function initializeSearchPanel() {
    const resultsNode = document.getElementById("searchResults");

    if (!resultsNode) {
      return;
    }

    if (!resultsNode.innerHTML.trim()) {
      resultsNode.innerHTML = '<p class="empty-state">Digite um número de O.S., nome do cliente ou palavra-chave.</p>';
    }
  }

  function renderSearchResults(records) {
    if (records.length === 0) {
      return '<p class="empty-state">Nenhum resultado encontrado.</p>';
    }

    return records
      .map(
        (record) => `
          <article class="event-card search-card">
            <h3>O.S. ${escapeHtml(record.orderNumber)} • ${escapeHtml(record.clientName)}</h3>
            <div class="event-meta">
              <span>Entrega: ${escapeHtml(record.deliveryDate)}</span>
            </div>
            <p class="detail-line"><span class="detail-label">Cliente:</span> ${escapeHtml(record.clientName)}</p>
            <p class="detail-line"><span class="detail-label">Descrição:</span> ${escapeHtml(record.sheetDescription || "Sem descrição")}</p>
          </article>
        `
      )
      .join("");
  }

  function renderEditorialReminders() {
    const today = new Date();
    const todayReminder = getTodayReminder(today);
    const nextReminder = getNextPostReminder(today);

    setText("todayReminderTitle", todayReminder.title);
    setText("todayReminderText", todayReminder.text);
    setText("storiesReminderTitle", "Stories de hoje");
    setText("storiesReminderText", getStoriesReminder(today));
    setText("nextReminderTitle", nextReminder.title);
    setText("nextReminderText", nextReminder.text);
  }

  function getTodayReminder(date) {
    const day = date.getDay();

    if (day === 2) {
      return {
        title: "Dia de postar Carrossel",
        text: "Publicar o carrossel sobre o projeto que será postado na sexta."
      };
    }

    if (day === 5) {
      return {
        title: "Dia de postar Reel de bastidor",
        text: "Publicar o reel com bastidores e reforçar a presença da operação."
      };
    }

    return {
      title: "Dia de movimentar os Stories",
      text: "Sem post fixo no feed hoje. Priorize stories e preparo da próxima postagem."
    };
  }

  function getStoriesReminder() {
    return "Publicar de 3 a 6 stories hoje. Na semana: 1 enquete, 1 caixa de perguntas e 1 prova social.";
  }

  function getNextPostReminder(date) {
    const day = date.getDay();

    if (day < 2) {
      return {
        title: "Próxima postagem: terça",
        text: "A próxima postagem será um Carrossel na terça-feira."
      };
    }

    if (day === 2) {
      return {
        title: "Próxima postagem: sexta",
        text: "Depois do carrossel de hoje, a próxima postagem será um Reel na sexta-feira."
      };
    }

    if (day < 5) {
      return {
        title: "Próxima postagem: sexta",
        text: "A próxima postagem será um Reel de bastidor na sexta-feira."
      };
    }

    return {
      title: "Próxima postagem: terça",
      text: "Depois do reel, a próxima postagem será um Carrossel na terça-feira."
    };
  }

  function getOperationalQueueItems() {
    return state.queueItems.filter((item) => !item.isPublished);
  }

  function getUpcomingQueueItems() {
    const now = new Date();
    return getOperationalQueueItems().filter((item) => item.hasDueDate && item.dueDateTime >= now);
  }

  function getUpcomingCalendarItems() {
    const today = startOfDay(new Date());
    return state.calendarItems.filter((item) => item.dateObject >= today);
  }

  function groupQueueByDate(items) {
    return items.reduce((map, item) => {
      const key = item.hasDueDate ? formatDateKey(item.dueDateTime) : "sem-prazo";
      const existing = map.get(key) || [];
      existing.push(item);
      map.set(key, existing);
      return map;
    }, new Map());
  }

  function groupCalendarByDate(items) {
    return items.reduce((map, item) => {
      const key = item.dateKey;
      const existing = map.get(key) || [];
      existing.push(item);
      map.set(key, existing);
      return map;
    }, new Map());
  }

  function renderSkeletonCards(count) {
    return Array.from({ length: count })
      .map(
        () => `
          <article class="event-card skeleton-card">
            <div class="skeleton-line short"></div>
            <div class="skeleton-line"></div>
            <div class="skeleton-line"></div>
          </article>
        `
      )
      .join("");
  }

  function renderSkeletonCounters() {
    return Array.from({ length: 5 })
      .map(
        () => `
          <article class="queue-counter skeleton-card">
            <div class="skeleton-line short"></div>
            <div class="skeleton-line"></div>
          </article>
        `
      )
      .join("");
  }

  function renderSkeletonFilters() {
    return Array.from({ length: 6 })
      .map(() => '<span class="filter-chip skeleton-filter"></span>')
      .join("");
  }

  function renderErrorState(node, message) {
    node.innerHTML = `<p class="error-state">${escapeHtml(message)}</p>`;
  }

  function setSourceStatus(text) {
    document.querySelectorAll("#sourceStatus").forEach((node) => {
      node.textContent = text;
    });
  }

  function setText(id, text) {
    const node = document.getElementById(id);
    if (node) {
      node.textContent = text;
    }
  }

  function fillNode(id, html) {
    const node = document.getElementById(id);
    if (node) {
      node.innerHTML = html;
    }
  }

  function formatMonthLabel(date) {
    return new Intl.DateTimeFormat("pt-BR", {
      month: "long",
      year: "numeric"
    }).format(date);
  }

  function formatLongDateLabel(dateValue) {
    const date = typeof dateValue === "string" ? parseDateFromKey(dateValue) : dateValue;
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
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  }

  function endOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
  }

  function isSameDate(first, second) {
    return (
      first.getFullYear() === second.getFullYear() &&
      first.getMonth() === second.getMonth() &&
      first.getDate() === second.getDate()
    );
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
