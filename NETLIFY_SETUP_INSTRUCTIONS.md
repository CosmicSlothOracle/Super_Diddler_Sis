# Netlify Setup Instructions

Das GitHub-Repository ist jetzt bereit! Folge diesen Schritten, um das automatische Netlify-Deployment einzurichten.

## Status

✅ GitHub-Repository: https://github.com/CosmicSlothOracle/Super_Diddler_Sis
✅ Alle Dateien sind committed und gepusht
✅ `netlify.toml` ist bereits konfiguriert

## Nächste Schritte im Netlify Dashboard

### 1. Netlify Dashboard öffnen
- URL: https://app.netlify.com
- Mit deinem bestehenden Account einloggen

### 2. Neues Site erstellen
1. Klicke auf **"Add new site"** (oben rechts)
2. Wähle **"Import an existing project"**
3. Klicke auf **"Deploy with GitHub"**

### 3. GitHub OAuth (falls noch nicht verbunden)
- Netlify leitet dich zu GitHub weiter
- Autorisiere Netlify, auf deine Repositories zuzugreifen
- Wähle die Berechtigungen (mindestens für `Super_Diddler_Sis` Repository)

### 4. Repository auswählen
- Suche nach: `Super_Diddler_Sis`
- Oder: `CosmicSlothOracle/Super_Diddler_Sis`
- Klicke auf das Repository

### 5. Build-Einstellungen konfigurieren

**WICHTIG**: Diese Einstellungen sind kritisch!

- **Branch to deploy**: `main` (sollte bereits ausgewählt sein)
- **Build command**: **LEER LASSEN** (oder `echo 'No build step'`)
- **Publish directory**: `.` (Punkt = Root-Verzeichnis)
- **Base directory**: **LEER LASSEN**

### 6. Environment Variables
- Keine notwendig für initiales Deployment
- Kann leer bleiben

### 7. Deploy auslösen
- Klicke auf **"Deploy site"**
- Netlify startet automatisch den ersten Deploy
- Du siehst den Fortschritt im Dashboard

### 8. Deployment-URL
- Nach erfolgreichem Deploy erhältst du eine URL wie:
  - `https://random-name-123.netlify.app`
- Diese URL ist deine Live-Site!

## Nach dem ersten Deploy

### Build-Logs prüfen
1. Gehe zu **Deploys** → Neuester Deploy
2. Klicke auf den Deploy, um die Logs zu sehen
3. Prüfe auf Fehler oder Warnings
4. Build sollte erfolgreich sein (keine Build-Schritte nötig)

### Live-Site testen
1. Öffne die generierte Netlify-URL
2. Öffne Browser-DevTools (F12)
3. Prüfe Console auf Fehler
4. Prüfe Network-Tab: Werden alle Assets geladen?
5. Teste Gameplay: Input, Rendering, Audio

## Continuous Deployment

✅ **Automatisch aktiviert!**

- Jeder Push auf `main` Branch löst automatisch ein neues Deploy aus
- Pull Requests bekommen automatisch Preview-URLs
- Keine weitere Konfiguration nötig

## Troubleshooting

### Problem: Build schlägt fehl
**Lösung**:
- Prüfe Build-Logs im Netlify Dashboard
- Stelle sicher, dass Build command **leer** ist
- Prüfe dass Publish directory `.` (Punkt) ist

### Problem: Assets werden nicht geladen (404)
**Lösung**:
- Prüfe Browser-Konsole auf CORS-Fehler
- Prüfe Network-Tab: Welche Dateien fehlen?
- Stelle sicher, dass alle Dateien committed sind

### Problem: index.html wird nicht gefunden
**Lösung**:
- Prüfe dass `index.html` im Root-Verzeichnis liegt (✅ bereits der Fall)
- Prüfe dass Publish directory `.` (Root) ist

### Problem: Site zeigt "Page not found"
**Lösung**:
- Prüfe dass `netlify.toml` im Repository ist (✅ bereits vorhanden)
- Die Redirect-Regel sollte alle Routes zu `index.html` leiten

## Nächste Schritte (Optional)

1. **Custom Domain**:
   - Site Settings → Domain Management
   - "Add custom domain" → Domain eingeben
   - DNS-Einstellungen bei Domain-Provider anpassen

2. **Netlify Analytics aktivieren**:
   - Site Settings → Analytics
   - Für Traffic-Statistiken

3. **README.md aktualisieren**:
   - Füge die Netlify-URL zum README hinzu
   - Commit und Push

## Erfolgskriterien

- [ ] Netlify-Site erfolgreich erstellt
- [ ] Erster Deploy erfolgreich
- [ ] Live-Site lädt ohne Fehler
- [ ] Assets werden korrekt geladen
- [ ] Spiel ist spielbar im Browser
- [ ] Continuous Deployment funktioniert

## Support

Falls Probleme auftreten:
1. Prüfe Netlify-Build-Logs
2. Prüfe Browser-Konsole (F12)
3. Prüfe Network-Tab für fehlende Assets
4. Siehe auch: [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)

