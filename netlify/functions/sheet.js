// netlify/functions/sheet.js
// Proxy seguro para Google Sheets — SHEET_ID y SHEET_GID nunca llegan al cliente

const SHEET_ID  = process.env.SHEET_ID;
const SHEET_GID = process.env.SHEET_GID || "0"; // gid numérico de la pestaña (0 = primera)

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "public, max-age=60",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  // ── Validar variables de entorno ──────────────────────────────────────
  if (!SHEET_ID) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "SHEET_ID no configurado.",
        hint: "Agregá SHEET_ID en Site settings → Environment variables en Netlify."
      }),
    };
  }

  try {
    // URL con gid numérico — funciona con sheets públicos y con "Publicar en la web"
    const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;

    const res = await fetch(csvUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    // ── Diagnóstico detallado según el status code ────────────────────
    if (!res.ok) {
      const hints = {
        401: "El Sheet es privado. Andá a Archivo → Compartir → Cualquier persona con el enlace puede ver.",
        403: "Sin permisos. Asegurate de que el Sheet sea público (ver arriba).",
        404: "SHEET_ID incorrecto. Copiá el ID de la URL del Sheet: /spreadsheets/d/ESTE_ID/edit",
        429: "Demasiadas solicitudes. Google está limitando el acceso temporalmente.",
      };
      throw new Error(
        `Google Sheets respondió ${res.status}. ${hints[res.status] || "Verificá que el Sheet sea público."}`
      );
    }

    const csv  = await res.text();

    // Detectar respuesta HTML en lugar de CSV (sheet privado / error silencioso)
    if (csv.trim().startsWith("<!DOCTYPE") || csv.trim().startsWith("<html")) {
      throw new Error(
        "Google devolvió HTML en lugar de CSV. " +
        "El Sheet no está publicado o el GID es incorrecto. " +
        "Verificá: Archivo → Compartir → Publicar en la web."
      );
    }

    const rows = parseCSV(csv);

    if (rows.length < 2) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ rows: [], total: 0, warning: "El Sheet está vacío o sin datos." }),
      };
    }

    const colHeaders = rows[0];
    const data = rows.slice(1)
      .map(row => {
        const obj = {};
        colHeaders.forEach((h, i) => {
          // Omitir columna de email — nunca llega al browser
          if (/correo|email|mail/i.test(h)) return;
          obj[h.trim()] = (row[i] ?? "").trim();
        });
        return obj;
      })
      .filter(r => r["Departamento"]); // descartar filas vacías

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ rows: data, total: data.length }),
    };

  } catch (err) {
    console.error("[sheet.js]", err.message);
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};

// ── CSV parser robusto (maneja comas y saltos de línea dentro de comillas) ──
function parseCSV(text) {
  const rows = [];
  let row = [], cur = "", inQ = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const nx = text[i + 1];

    if (ch === '"') {
      if (inQ && nx === '"') { cur += '"'; i++; } // comilla escapada
      else { inQ = !inQ; }
    } else if (ch === "," && !inQ) {
      row.push(cur.trim()); cur = "";
    } else if ((ch === "\n" || (ch === "\r" && nx === "\n")) && !inQ) {
      if (ch === "\r") i++;
      row.push(cur.trim()); rows.push(row);
      row = []; cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur || row.length) { row.push(cur.trim()); rows.push(row); }

  return rows;
}
