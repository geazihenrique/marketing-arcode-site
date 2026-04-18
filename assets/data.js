(function () {
  const config = window.APP_CONFIG;
  let vendasRowsCachePromise = null;
  let mktRowsCachePromise = null;

  async function loadQueueItems() {
    const rows = await loadMktRows();

    return rows
      .map(mapMktRowToQueueItem)
      .filter(Boolean)
      .sort((a, b) => {
        if (!a.dueDateTime && !b.dueDateTime) {
          return a.content.localeCompare(b.content, "pt-BR");
        }
        if (!a.dueDateTime) {
          return 1;
        }
        if (!b.dueDateTime) {
          return -1;
        }
        return a.dueDateTime - b.dueDateTime;
      });
  }

  async function loadCalendarItems() {
    const rows = await loadVendasRows();

    return rows
      .map(mapVendasRowToCalendarItem)
      .filter(Boolean)
      .sort((a, b) => a.dateObject - b.dateObject);
  }

  async function loadEvents() {
    return loadCalendarItems();
  }

  async function searchRecords(query) {
    const normalizedQuery = normalizeText(query).trim();

    if (!normalizedQuery) {
      return [];
    }

    const rows = await loadVendasRows();

    return rows
      .map(mapVendasRowToSearchRecord)
      .filter(Boolean)
      .filter((record) => matchesSearch(record, normalizedQuery))
      .sort((a, b) => a.dateObject - b.dateObject);
  }

  async function loadVendasRows() {
    if (!vendasRowsCachePromise) {
      vendasRowsCachePromise = fetchCsv(config.vendasOsCsvUrl);
    }

    return vendasRowsCachePromise;
  }

  async function loadMktRows() {
    if (!mktRowsCachePromise) {
      mktRowsCachePromise = fetchCsv(config.mktCsvUrl);
    }

    return mktRowsCachePromise;
  }

  async function fetchCsv(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Não foi possível carregar a planilha.");
    }

    const csvText = await response.text();
    return parseCsv(csvText);
  }

  function mapMktRowToQueueItem(row) {
    const postDateRaw = getByColumn(row, "A");
    const postTimeRaw = getByColumn(row, "B");
    const channel = getByColumn(row, "D");
    const content = getByColumn(row, "E");
    const responsibleEditing = getByColumn(row, "G");
    const responsibleCapture = getByColumn(row, "H");
    const responsiblePosting = getByColumn(row, "I");
    const statusRaw = getByColumn(row, "J");

    const contentNormalized = normalizeText(content);
    const statusNormalized = normalizeStatus(statusRaw);

    if (!content || contentNormalized === "CONTEUDO") {
      return null;
    }

    const dueParsed = parseQueueDueDateTime(postDateRaw, postTimeRaw);
    const dueDateTime = dueParsed ? dueParsed.dateTime : null;
    const hasDueDate = Boolean(dueDateTime);
    const statusLabel = formatStatusLabel(statusRaw);
    const responsibleCurrent = deriveCurrentResponsible(
      statusNormalized,
      responsibleEditing,
      responsibleCapture,
      responsiblePosting
    );

    return {
      content,
      channel,
      status: statusLabel,
      statusNormalized,
      dueDateTime,
      hasDueDate,
      dueLabel: formatQueueDueLabel(dueDateTime, dueParsed ? dueParsed.hasTime : false),
      responsibleCurrent,
      isPublished: statusNormalized === "PUBLICADO"
    };
  }

  function mapVendasRowToCalendarItem(row) {
    const orderNumber = getByColumn(row, "A");
    const clientName = getByColumn(row, "B");
    const deliveryRaw = getByColumn(row, "D");
    const producer = getByColumn(row, "I");
    const categoryRaw = getByColumn(row, "F");

    if (!deliveryRaw) {
      return null;
    }

    const dateObject = parseDateValue(deliveryRaw);

    if (!dateObject) {
      return null;
    }

    if (!orderNumber && normalizeText(clientName) === "NOME DO CLIENTE") {
      return null;
    }

    return {
      orderNumber: orderNumber || "Sem O.S.",
      clientName: clientName || "Sem cliente",
      producer: producer || "Sem produtor",
      dateObject,
      dateKey: formatDateKey(dateObject),
      categoryRaw,
      categoryType: getHighlightCategoryType(categoryRaw)
    };
  }

  function mapVendasRowToSearchRecord(row) {
    const orderNumber = getByColumn(row, "A");
    const clientName = getByColumn(row, "B");
    const deliveryRaw = getByColumn(row, "D");
    const sheetDescription = getByColumn(row, "E");

    if (!orderNumber || !clientName || !deliveryRaw) {
      return null;
    }

    const dateObject = parseDateValue(deliveryRaw);

    if (!dateObject) {
      return null;
    }

    return {
      orderNumber,
      clientName,
      sheetDescription,
      deliveryDate: formatShortDate(dateObject),
      dateObject,
      searchText: normalizeText(`${orderNumber} ${clientName} ${sheetDescription}`)
    };
  }

  function getHighlightCategoryType(value) {
    const normalized = normalizeText(value);

    if (normalized.includes("EVENTO")) {
      return "EVENTO";
    }

    if (normalized.includes("FEIRA")) {
      return "FEIRA";
    }

    if (normalized.includes("STAND")) {
      return "STAND";
    }

    return null;
  }

  function deriveCurrentResponsible(status, editing, capture, posting) {
    const editingFirst = pickFirst([editing, capture, posting]);
    const postingFirst = pickFirst([posting, editing, capture]);

    if (status === "EM EDICAO" || status === "EM PRODUCAO" || status === "FILA") {
      return editingFirst;
    }

    if (status === "AGENDADO" || status === "PUBLICADO") {
      return postingFirst;
    }

    if (status === "IDEIA") {
      return pickFirst([editing, capture, posting]);
    }

    return pickFirst([editing, capture, posting]);
  }

  function pickFirst(values) {
    const found = values.find((value) => String(value || "").trim() !== "");
    return found ? String(found).trim() : "Sem responsável";
  }

  function formatQueueDueLabel(dueDateTime, hasTime) {
    if (!dueDateTime) {
      return "Sem prazo";
    }

    if (!hasTime) {
      return formatShortDate(dueDateTime);
    }

    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(dueDateTime);
  }

  function formatStatusLabel(statusRaw) {
    const normalized = normalizeStatus(statusRaw);

    const labels = {
      FILA: "Fila",
      "EM EDICAO": "Em edição",
      "EM PRODUCAO": "Em produção",
      AGENDADO: "Agendado",
      IDEIA: "Ideia",
      PUBLICADO: "Publicado"
    };

    return labels[normalized] || (statusRaw ? String(statusRaw).trim() : "Sem status");
  }

  function normalizeStatus(value) {
    return normalizeText(value).replace(/\s+/g, " ").trim();
  }

  function parseQueueDueDateTime(dateRaw, timeRaw) {
    const date = parseDateValue(dateRaw);

    if (!date) {
      return null;
    }

    const time = parseTimeValue(timeRaw);

    if (!time) {
      return {
        dateTime: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0),
        hasTime: false
      };
    }

    return {
      dateTime: new Date(date.getFullYear(), date.getMonth(), date.getDate(), time.hours, time.minutes, 0, 0),
      hasTime: true
    };
  }

  function parseTimeValue(value) {
    const text = String(value || "").trim();

    if (!text) {
      return null;
    }

    const match = text.match(/(\d{1,2})[:hH](\d{2})/);

    if (!match) {
      return null;
    }

    const hours = Number(match[1]);
    const minutes = Number(match[2]);

    if (Number.isNaN(hours) || Number.isNaN(minutes) || hours > 23 || minutes > 59) {
      return null;
    }

    return { hours, minutes };
  }

  function matchesSearch(record, normalizedQuery) {
    const queryDigits = normalizedQuery.replace(/\D/g, "");
    const orderDigits = normalizeText(record.orderNumber).replace(/\D/g, "");

    if (queryDigits && orderDigits === queryDigits) {
      return true;
    }

    return record.searchText.includes(normalizedQuery);
  }

  function getByColumn(row, letter) {
    const index = columnLetterToIndex(letter);
    return String(row[index] || "").trim();
  }

  function columnLetterToIndex(letter) {
    return letter.toUpperCase().charCodeAt(0) - 65;
  }

  function parseCsv(text) {
    const rows = [];
    let current = "";
    let row = [];
    let inQuotes = false;

    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      const nextChar = text[index + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          index += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (char === "," && !inQuotes) {
        row.push(current);
        current = "";
        continue;
      }

      if ((char === "\n" || char === "\r") && !inQuotes) {
        if (char === "\r" && nextChar === "\n") {
          index += 1;
        }
        row.push(current);
        rows.push(row);
        row = [];
        current = "";
        continue;
      }

      current += char;
    }

    if (current || row.length > 0) {
      row.push(current);
      rows.push(row);
    }

    return rows.filter((entry) => entry.some((value) => value.trim() !== ""));
  }

  function parseDateValue(value) {
    const text = String(value || "").trim();

    if (!text) {
      return null;
    }

    const brMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (brMatch) {
      return new Date(Number(brMatch[3]), Number(brMatch[2]) - 1, Number(brMatch[1]));
    }

    const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      return new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
    }

    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  }

  function formatDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function formatShortDate(date) {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }).format(date);
  }

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase();
  }

  window.DataApi = {
    loadEvents,
    loadQueueItems,
    loadCalendarItems,
    searchRecords
  };
})();
