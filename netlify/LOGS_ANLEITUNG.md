# Analytics Logs - Anleitung zum Auslesen

## Übersicht

Das Analytics-System sendet Events von den Usern an die Netlify Function `/api/log-event`. Die Logs werden automatisch im Netlify Dashboard gespeichert.

## Wie man die Logs im Live-Betrieb ausliest

### Option 1: Netlify Dashboard (Einfachste Methode)

1. **Gehe zu deinem Netlify Dashboard**: https://app.netlify.com
2. **Wähle dein Projekt** aus
3. **Navigiere zu**: `Functions` → `log-event`
4. **Klicke auf den Tab "Logs"**
5. Hier siehst du alle Events in Echtzeit

**Vorteile:**
- Keine zusätzliche Konfiguration nötig
- Echtzeit-Logs
- Automatisch verfügbar

**Nachteile:**
- Logs werden nach 24-48 Stunden gelöscht (je nach Plan)
- Keine erweiterte Filterung/Analyse

### Option 2: Netlify CLI (Für lokale Analyse)

1. **Installiere Netlify CLI** (falls noch nicht installiert):
   ```bash
   npm install -g netlify-cli
   ```

2. **Login zu Netlify**:
   ```bash
   netlify login
   ```

3. **Logs live anzeigen**:
   ```bash
   netlify functions:log log-event
   ```

4. **Logs exportieren** (optional):
   ```bash
   netlify functions:log log-event > logs-export.txt
   ```

### Option 3: Logs filtern und analysieren

Die Logs sind im JSON-Format. Du kannst sie mit Tools wie `jq` filtern:

```bash
# Beispiel: Nur "match_end" Events anzeigen
netlify functions:log log-event | grep "match_end"

# Beispiel: JSON-Format parsen (mit jq)
netlify functions:log log-event | jq 'select(.eventType == "match_end")'
```

### Option 4: Externe Log-Services (Für Produktion empfohlen)

Für eine professionelle Lösung solltest du die Events an einen externen Service senden:

**Empfohlene Services:**
- **Logtail** (https://logtail.com) - Einfach, günstig
- **LogRocket** (https://logrocket.com) - Session Replay + Logs
- **Sentry** (https://sentry.io) - Fokus auf Errors
- **Custom Backend API** - Eigene Lösung

**Integration:**
Ändere `netlify/functions/log-event.js` und füge einen zusätzlichen API-Call hinzu:

```javascript
// Beispiel für Logtail
const LOGTAIL_SOURCE_TOKEN = process.env.LOGTAIL_SOURCE_TOKEN;

if (LOGTAIL_SOURCE_TOKEN) {
  await fetch('https://in.logtail.com', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LOGTAIL_SOURCE_TOKEN}`
    },
    body: JSON.stringify({
      message: evt.eventType,
      metadata: evt.data,
      // ...
    })
  });
}
```

## Event-Typen die getrackt werden

- `session_start` - User startet das Spiel
- `session_end` - User verlässt das Spiel
- `match_start` - Match beginnt
- `match_end` - Match endet (mit Winner-Info)
- `input` - User-Inputs (falls aktiviert)
- `error` - JavaScript Errors

## Log-Format

Jedes Event wird als JSON-String geloggt:

```json
{
  "type": "analytics_event",
  "timestamp": "2025-01-10T12:34:56.789Z",
  "eventType": "match_end",
  "userId": "user_abc123",
  "sessionId": "session_1234567890_xyz",
  "data": {
    "winner": 0,
    "winnerCharacter": "cyboard",
    "matchDuration": 120.5
  },
  "receivedAt": "2025-01-10T12:35:00.123Z",
  "ip": "192.168.1.1",
  "userAgent": "Mozilla/5.0..."
}
```

## Wichtige Netlify-Einstellungen

### 1. Function-Logs aktivieren
- **Automatisch aktiviert** - Keine zusätzliche Konfiguration nötig
- Logs werden automatisch für alle Functions gespeichert

### 2. Environment Variables (Optional)
Falls du externe Services nutzen willst, setze Environment Variables im Netlify Dashboard:
- `Site settings` → `Environment variables`
- Beispiel: `LOGTAIL_SOURCE_TOKEN=your_token_here`

### 3. Function Timeout
- Standard: 10 Sekunden
- Für Analytics reicht das aus
- Falls nötig: `netlify.toml` → `[functions]` → `timeout = 10`

## Troubleshooting

### Problem: Keine Logs sichtbar
- **Lösung**: Prüfe ob `analytics-config.js` → `enabled: true` ist
- **Lösung**: Prüfe Browser Console auf Fehler beim Senden
- **Lösung**: Prüfe Netlify Function Logs auf Errors

### Problem: CORS-Fehler
- **Lösung**: Die Function hat bereits CORS-Headers. Falls Probleme: Prüfe `netlify.toml` Redirects

### Problem: Zu viele Events
- **Lösung**: Passe `batchSize` in `analytics-config.js` an
- **Lösung**: Deaktiviere `trackInputs` wenn nicht benötigt

## Nächste Schritte

1. **Teste lokal**: Setze `devMode: true` in `analytics-config.js` → Events werden in `localStorage` gespeichert
2. **Deploy**: Pushe zum main branch → Netlify deployt automatisch
3. **Monitor**: Schaue regelmäßig in Netlify Dashboard → Functions → Logs
4. **Optional**: Integriere externen Log-Service für Langzeit-Speicherung
