// netlify/functions/sheet.js
// Proxy seguro para Google Sheets — el SHEET_ID nunca llega al cliente

const SHEET_ID  = process.env.SHEET_ID;   // variable de entorno en Netlify
const API_KEY   = process.env.SHEETS_API_KEY; // opcional si el sheet es público
const SHEET_TAB = process.env.SHEET_TAB || "Hoja 1"; // nombre de la pestaña

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "public, max-age=60", // cache 60s
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (!SHEET_ID) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "SHEET_ID no configurado en variables de entorno." }),
    };
  }

  try {
    // Google Sheets publicado como CSV (no requiere API key)
    const tab     = encodeURIComponent(SHEET_TAB);
    const csvUrl  = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${tab}`;

    const res  = await fetch(csvUrl);
    if (!res.ok) throw new Error(`Google Sheets devolvió ${res.status}`);

    const csv  = await res.text();
    const rows = parseCSV(csv);

    if (rows.length < 2) {
      return { statusCode: 200, headers, body: JSON.stringify({ rows: [] }) };
    }

    const colHeaders = rows[0];
    const data = rows.slice(1).map(row => {
      const obj = {};
      colHeaders.forEach((h, i) => {
        // Omitir email para no exponer datos personales
        if (h.toLowerCase().includes("correo") || h.toLowerCase().includes("email")) return;
        obj[h] = row[i] ?? "";
      });
      return obj;
    }).filter(r => r["Departamento"]); // filas vacías

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ rows: data, total: data.length }),
    };

  } catch (err) {
    console.error("sheet.js error:", err.message);
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({ error: "No se pudo obtener el Sheet: " + err.message }),
    };
  }
};

// CSV parser simple (maneja comas dentro de comillas)
function parseCSV(text) {
  return text.trim().split("\n").map(line => {
    const cols = [];
    let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQ = !inQ; }
      else if (ch === "," && !inQ) { cols.push(cur.trim()); cur = ""; }
      else { cur += ch; }
    }
    cols.push(cur.trim());
    return cols;
  });
}
