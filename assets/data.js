(function () {
  const config = window.APP_CONFIG;

  async function loadEvents() {
    const response = await fetch(config.publishedCsvUrl);
    if (!response.ok) {
      throw new Error("Nao foi possivel carregar a planilha.");
    }

    const csvText = await response.text();
    return parseCsv(csvText)
      .map(mapRowToEvent)
      .filter(Boolean)
      .sort((a, b) => a.dateObject - b.dateObject);
  }

  function mapRowToEvent(row) {
    const orderNumber = getByColumn(row, config.columns.orderNumber);
    const clientName = getByColumn(row, config.columns.clientName);
    const deliveryRaw = getByColumn(row, config.columns.deliveryDate);
    const segmentText = getByColumn(row, config.columns.segment);
    const producer = getByColumn(row, config.columns.producer);
    const notes = getByColumn(row, config.columns.notes);

    if (!clientName || !deliveryRaw) {
      return null;
    }

    const dateObject = parseDateValue(deliveryRaw);
    if (!dateObject || dateObject < parseIsoDate(config.minDate)) {
      return null;
    }

    const categories = config.allowedSegments.filter((segment) =>
      normalizeText(segmentText).includes(normalizeText(segment))
    );

    if (categories.length === 0) {
      return null;
    }

    return {
      orderNumber,
      clientName,
      producer,
      notes,
      categories,
      dateObject,
      dateKey: formatDateKey(dateObject),
      title: `O.S. ${orderNumber} • ${clientName}`,
      owner: clientName ? `Cliente: ${clientName}` : "",
      description: `Entrega prevista para ${formatShortDate(dateObject)}.`,
      time: "Entrega"
    };
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
    const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

    if (match) {
      return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
    }

    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? null : new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  }

  function parseIsoDate(value) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
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
    loadEvents
  };
})();
