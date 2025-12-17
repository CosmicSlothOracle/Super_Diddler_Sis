# Netlify Deployment Guide

## Schnellstart

### Option 1: Via Netlify Dashboard (Empfohlen für erste Tests)

1. **Netlify-Account**: Logge dich bei [netlify.com](https://netlify.com) ein

2. **Neues Site erstellen**:

   - Klicke auf "Add new site" → "Import an existing project"
   - Verbinde dein Git-Repository (GitHub/GitLab/Bitbucket)
   - Oder: "Deploy manually" → ZIP-Datei hochladen

3. **Build-Einstellungen**:

   - **Build command**: Leer lassen oder `echo 'No build'`
   - **Publish directory**: `.` (Punkt = Root-Verzeichnis)
   - **Branch**: `main` oder `master` (je nach Repository)

4. **Deploy**: Netlify erstellt automatisch eine URL (z.B. `https://random-name-123.netlify.app`)

5. **Testen**: Öffne die URL im Browser und teste das Spiel

### Option 2: Via Netlify CLI

```bash
# Netlify CLI installieren
npm install -g netlify-cli

# Login
netlify login

# Im Projekt-Verzeichnis: Site initialisieren
netlify init

# Deploy
netlify deploy --prod
```

## Konfiguration

Die `netlify.toml` Datei ist bereits erstellt und konfiguriert:

- **Static Hosting**: Alle Dateien werden direkt serviert
- **Caching**: Assets werden aggressiv gecacht für bessere Performance
- **Headers**: Sicherheits-Headers sind gesetzt

## Testing vor Deployment

### Lokal testen (ohne Netlify)

```bash
# Option 1: Python HTTP Server
python -m http.server 8000

# Option 2: Node.js serve
npx serve .

# Option 3: PHP (falls installiert)
php -S localhost:8000
```

Öffne dann `http://localhost:8000` im Browser.

**Wichtig**: Teste insbesondere:

- Asset-Loading (Bilder, Audio, JSON)
- Gameplay (Input, Rendering)
- Browser-Konsole auf Fehler prüfen

## Troubleshooting

### Assets werden nicht geladen

**Problem**: CORS-Fehler oder 404-Fehler

**Lösung**:

1. Prüfe Browser-Konsole (F12 → Console)
2. Prüfe Network-Tab: Welche Dateien fehlen?
3. Stelle sicher, dass alle Pfade relativ sind (`assets/...` nicht `/assets/...`)

### Spiel lädt nicht

**Problem**: JavaScript-Fehler

**Lösung**:

1. Öffne Browser-Konsole (F12)
2. Prüfe auf rote Fehler
3. Häufige Ursachen:
   - Fehlende Dateien (404)
   - Syntax-Fehler
   - Browser-Kompatibilität

### Performance-Probleme

**Problem**: Spiel läuft langsam

**Lösung**:

1. Prüfe Browser-Performance-Tools (F12 → Performance)
2. Prüfe Asset-Größen (Network-Tab)
3. Netlify CDN sollte automatisch aktiv sein
4. Für Production: Webpack-Build aktivieren (siehe `WEB_DEPLOYMENT_ANALYSIS.md`)

## Dev-Mode aktivieren (Browser)

Im Browser kannst du den Dev-Mode aktivieren:

1. **Via URL-Parameter**: `https://your-site.netlify.app/?dev`
2. **Via Console**: `localStorage.setItem('devMode', 'true')` dann Seite neu laden

## Custom Domain (Optional)

1. In Netlify Dashboard: Site Settings → Domain Management
2. "Add custom domain" → Domain eingeben
3. DNS-Einstellungen bei deinem Domain-Provider anpassen

## Continuous Deployment

Wenn dein Repository mit Netlify verbunden ist:

- **Automatisches Deploy**: Jeder Push auf `main`/`master` löst automatisch ein Deploy aus
- **Preview-Deploys**: Pull-Requests bekommen automatisch Preview-URLs

## Performance-Optimierung (Später)

Für bessere Performance kannst du später:

1. **Webpack-Build aktivieren**:

   - `webpack.config.js` anpassen
   - Build-Command in Netlify: `npm run build:prod`
   - Publish directory: `dist`

2. **Asset-Optimierung**:

   - Bilder komprimieren
   - Audio-Dateien optimieren
   - Lazy-Loading für große Assets

3. **CDN**: Netlify CDN ist bereits aktiv, aber du kannst zusätzliche CDNs nutzen

## Monitoring

- **Netlify Analytics**: In Dashboard aktivieren für Traffic-Statistiken
- **Error-Logging**: Netlify Functions für Error-Tracking (optional)
- **Performance**: Browser DevTools → Performance-Tab

## Rollback

Falls etwas schiefgeht:

1. Netlify Dashboard → Deploys
2. Klicke auf vorherigen erfolgreichen Deploy
3. "Publish deploy" → Rollback durchgeführt
