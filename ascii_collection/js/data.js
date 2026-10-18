// Загрузка содержимого: арты из ascii_arts/*.txt и ссылки из links.txt.
// Файлы читаются через fetch, поэтому сайт нужно открывать через статический сервер.

export const ARTS_DIR = "ascii_arts/";
export const ART_FILES = ["ascii_skulls_vapz.txt", "ascii_no_skulls_vapz.txt"];
export const LINKS_FILE = "links.txt";

// Всё после маркера в строке-разделителе - название арта (напр. "skull38.txt (2026)").
const SEPARATOR = /^\s*-+8<-+\s*(.*)$/;

function createResource() {
  return { status: "idle", items: [], error: "" };
}

const artsResource = createResource();
const linksResource = createResource();

// ---------- arts ----------
export function ensureArts() {
  if (artsResource.status === "idle") {
    loadArts();
  }
  return artsResource;
}

export function reloadArts() {
  artsResource.status = "idle";
  return ensureArts();
}

function loadArts() {
  artsResource.status = "loading";
  artsResource.error = "";

  const requests = ART_FILES.map((file) => fetch(`${ARTS_DIR}${file}`)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`${ARTS_DIR}${file}: HTTP ${response.status}`);
      }
      return response.text();
    })
    .then(parseArts));

  Promise.allSettled(requests).then((results) => {
    const items = [];
    const errors = [];
    results.forEach((result) => {
      if (result.status === "fulfilled") {
        items.push(...result.value);
      } else {
        errors.push(String(result.reason && result.reason.message ? result.reason.message : result.reason));
      }
    });

    if (!items.length) {
      artsResource.status = "error";
      artsResource.error = errors.join("; ") || "no arts in files";
      return;
    }

    artsResource.items = items;
    artsResource.status = "ready";
  });
}

export function parseArts(text) {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let current = null;

  for (const line of lines) {
    const match = line.match(SEPARATOR);
    if (match) {
      if (current) {
        blocks.push(current);
      }
      current = { lines: [], caption: (match[1] || "").trim() };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) {
    blocks.push(current);
  }

  return blocks
    .map((block) => {
      const artLines = block.lines.map(expandTabs);
      // Убираем только пустые строки по краям, ведущие пробелы не трогаем.
      while (artLines.length && !artLines[0].trim()) {
        artLines.shift();
      }
      while (artLines.length && !artLines[artLines.length - 1].trim()) {
        artLines.pop();
      }
      return {
        lines: artLines,
        caption: block.caption,
        width: Math.max(0, ...artLines.map(textLength)),
        height: artLines.length
      };
    })
    .filter((art) => art.height > 0);
}

function expandTabs(line) {
  let out = "";
  for (const char of line) {
    out += char === "\t" ? " ".repeat(8 - (out.length % 8)) : char;
  }
  return out;
}

// Длина в символах Unicode, а не в UTF-16 единицах.
export function textLength(text) {
  return Array.from(text).length;
}

// ---------- links ----------
export function reloadLinks() {
  linksResource.status = "idle";
  return ensureLinks();
}

export function ensureLinks() {
  if (linksResource.status === "idle") {
    loadLinks();
  }
  return linksResource;
}

function loadLinks() {
  linksResource.status = "loading";
  linksResource.error = "";
  fetch(LINKS_FILE)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`${LINKS_FILE}: HTTP ${response.status}`);
      }
      return response.text();
    })
    .then((text) => {
      linksResource.items = parseLinks(text);
      linksResource.status = "ready";
    })
    .catch((error) => {
      linksResource.status = "error";
      linksResource.error = String(error && error.message ? error.message : error);
    });
}

// Строка "Название | https://адрес"; пустые строки и строки с # пропускаются.
export function parseLinks(text) {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const at = line.indexOf("|");
      if (at < 0) {
        return { name: line, url: line };
      }
      const url = line.slice(at + 1).trim();
      return { name: line.slice(0, at).trim() || url, url };
    })
    .filter((link) => link.url);
}
