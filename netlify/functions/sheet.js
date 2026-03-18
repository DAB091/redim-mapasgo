// netlify/functions/sheet.js
const SHEET_ID  = process.env.SHEET_ID;
const SHEET_GID = process.env.SHEET_GID || "0";
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "https://redim-sgo.netlify.app";

exports.handler = async (event) => {
  const origin  = event.headers["origin"]  || "";
  const referer = event.headers["referer"] || "";

  const headers = {
    "Access-Control-Allow-Origin":  ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "public, max-age=60",
  };

  // Preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  // Bloquear acceso directo (navegador, curl, Postman, etc.)
  // Solo permitir requests que vengan del propio sitio
  const fromSite =
    origin.startsWith(ALLOWED_ORIGIN) ||
    referer.startsWith(ALLOWED_ORIGIN);

  if (!fromSite) {
    return {
      statusCode: 403,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Acceso no autorizado." }),
    };
  }

  if (!SHEET_ID) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "SHEET_ID no configurado." }),
    };
  }

  try {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;

    const res = await fetch(csvUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    if (!res.ok) {
      const hints = {
        401: "El Sheet es privado.",
        403: "Sin permisos. Asegurate de que el Sheet sea público.",
        404: "SHEET_ID incorrecto.",
        429: "Demasiadas solicitudes.",
      };
      throw new Error(`Google Sheets respondió ${res.status}. ${hints[res.status] || ""}`);
    }

    const csv = await res.text();

    if (csv.trim().startsWith("<!DOCTYPE") || csv.trim().startsWith("<html")) {
      throw new Error("Google devolvió HTML en lugar de CSV. Verificá que el Sheet sea público.");
    }

    const rows = parseCSV(csv);

    if (rows.length < 2) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ rows: [], total: 0 }),
      };
    }

    const colHeaders = rows[0];
    const data = rows.slice(1)
      .map(row => {
        const obj = {};
        colHeaders.forEach((h, i) => {
          if (/correo|email|mail/i.test(h)) return;
          obj[h.trim()] = (row[i] ?? "").trim();
        });
        return obj;
      })
      .filter(r => r["Departamento"]);

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

function parseCSV(text) {
  const rows = [];
  let row = [], cur = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], nx = text[i + 1];
    if (ch === '"') {
      if (inQ && nx === '"') { cur += '"'; i++; }
      else { inQ = !inQ; }
    } else if (ch === "," && !inQ) {
      row.push(cur.trim()); cur = "";
    } else if ((ch === "\n" || (ch === "\r" && nx === "\n")) && !inQ) {
      if (ch === "\r") i++;
      row.push(cur.trim()); rows.push(row);
      row = []; cur = "";
    } else { cur += ch; }
  }
  if (cur || row.length) { row.push(cur.trim()); rows.push(row); }
  return rows;
}
