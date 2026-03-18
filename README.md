# Redim – Mapa del Bullying

Mapa interactivo para visualizar datos de encuestas docentes sobre bullying en Santiago del Estero.

## Estructura del proyecto

```
redim/
├── public/
│   └── index.html          # App principal (mapa + paneles)
├── netlify/
│   └── functions/
│       └── sheet.js        # Proxy seguro hacia Google Sheets
├── netlify.toml            # Config de Netlify (rutas, headers de seguridad)
├── .env.example            # Plantilla de variables de entorno
├── .gitignore              # Excluye .env y node_modules
└── README.md
```

## Setup en Netlify

### 1. Subir a GitHub
```bash
git init
git add .
git commit -m "init"
git remote add origin https://github.com/TU_USER/redim.git
git push -u origin main
```

### 2. Conectar en Netlify
1. Ir a [app.netlify.com](https://app.netlify.com)
2. **Add new site** → **Import from Git** → elegir el repo
3. Configuración de build:
   - **Publish directory:** `public`
   - **Functions directory:** `netlify/functions`

### 3. Variables de entorno en Netlify
En **Site settings → Environment variables**, agregar:

| Variable      | Valor                          |
|---------------|--------------------------------|
| `SHEET_ID`    | El ID de tu Google Sheet       |
| `SHEET_TAB`   | Nombre de la pestaña (ej: `Hoja 1`) |

> ⚠️ El `SHEET_ID` **nunca** se expone al navegador. Solo vive en el servidor de Netlify.

### 4. Cómo obtener el SHEET_ID
La URL de tu sheet es:
```
https://docs.google.com/spreadsheets/d/SHEET_ID_AQUI/edit
```
Copiá solo la parte entre `/d/` y `/edit`.

### 5. El Sheet debe estar publicado
En Google Sheets: **Archivo → Compartir → Publicar en la web**  
Publicar como **Página web** (no hace falta CSV, el proxy lo maneja).

---

## Desarrollo local

Para probar localmente necesitás [Netlify CLI](https://docs.netlify.com/cli/get-started/):

```bash
npm install -g netlify-cli
cp .env.example .env
# Editá .env con tu SHEET_ID real
netlify dev
```

La app queda en `http://localhost:8888`

---

## Seguridad implementada

- **SHEET_ID nunca llega al cliente** — solo existe como variable de entorno en Netlify
- **Emails omitidos** — la función `sheet.js` filtra la columna de correo antes de enviar al browser
- **Headers de seguridad** — `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`, etc. via `netlify.toml`
- **CORS controlado** — la función solo acepta `GET` y `OPTIONS`
- **Cache de 60s** — evita hammering a Google Sheets
- **.gitignore** — `.env` nunca se sube al repositorio

---

## Columnas esperadas en el Google Sheet

| Columna | Descripción |
|---|---|
| `Marca temporal` | Fecha/hora del envío |
| `Dirección de correo electrónico` | (se omite automáticamente) |
| `Exclusión` | Escala: Nunca / A veces / Frecuentemente / Siempre |
| `Apodos físicos` | ídem |
| `Temor/inhibición` | ídem |
| `Agresiones físicas` | ídem |
| `Juegos por género` | ídem |
| `Reacción por género` | ídem |
| `Mandatos de género` | ídem |
| `Capacitación abuso` | Opciones de capacitación |
| `Conoce protocolo` | Nivel de conocimiento |
| `Mayor desafío` | Texto |
| `Herramienta ONG` | Texto |
| `Agrupación por género` | escala |
| `Frases exclusión` | escala |
| `Niños solos` | escala |
| `Varones ocupan espacio` | escala |
| `Sectores por género` | escala |
| `Varones cuidado` | escala |
| `Niñas liderazgo` | escala |
| `Expresión emocional` | escala |
| `Lenguaje inclusivo` | escala |
| `Refuerzan estereotipos` | escala |
| `Intervención adulto` | escala |
| `Fomenta diálogo` | escala |
| `Departamento` | Nombre del departamento |
| `Localidad` | Nombre de la localidad |
