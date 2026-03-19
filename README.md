# Golden Cut – Live-Termin-App mit Supabase

Das ist die echte Web-App-Version für deine Online-Terminbuchung.

## Was diese Version kann

- Kunden wählen Leistung, Datum und Uhrzeit
- Buchung wird online in Supabase gespeichert
- Golden Cut kann sich einloggen
- Dashboard zeigt alle Terminanfragen
- Termine können bestätigt, abgelehnt oder storniert werden
- Premium-Look passend zur Golden-Cut-Website

## 1. Supabase-Projekt anlegen

1. Auf Supabase ein neues Projekt erstellen.
2. Im Projekt unter **SQL Editor** die Datei `supabase/schema.sql` komplett ausführen.
3. Unter **Authentication > Users** einen Admin-Benutzer anlegen.
4. Unter **Settings / API** die Werte für:
   - `Project URL`
   - `anon public key`
   kopieren.

Supabase erstellt den JavaScript-Client mit deiner Projekt-URL und deinem Key. Die `supabase-js` Bibliothek ist die offizielle JavaScript-Library für Datenbankzugriffe und Auth. citeturn126210search0turn126210search3

## 2. Umgebungsvariablen eintragen

1. Die Datei `.env.example` kopieren und als `.env.local` speichern.
2. Eintragen:

```env
NEXT_PUBLIC_SUPABASE_URL=https://DEIN-PROJEKT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=DEIN_ANON_KEY
```

## 3. Lokal starten

```bash
npm install
npm run dev
```

Dann im Browser öffnen:

```bash
http://localhost:3000
```

## 4. Admin-Login

Im Dashboard nutzt die App E-Mail/Passwort-Login über Supabase Auth. Supabase unterstützt Passwort-Login offiziell über `signInWithPassword`. citeturn126210search1turn126210search4

## 5. Sicherheit

Die Tabellen im `public` Schema sollten mit Row Level Security geschützt werden. Supabase empfiehlt dafür RLS auf Tabellen, Views und Funktionen, damit Browser-Clients nicht ungewollt auf Daten zugreifen können. citeturn126210search2turn126210search16turn126210search18

In dieser App gilt:
- Services und Barber sind öffentlich lesbar
- neue Termine dürfen öffentlich als `pending` angelegt werden
- lesen und ändern dürfen nur eingeloggte Nutzer

## 6. Veröffentlichung

Diese App kannst du danach bei **Vercel** oder **Netlify** veröffentlichen.

Für die erste Live-Version fehlen nur noch optionale Extras wie:
- Bestätigungsmails
- SMS oder WhatsApp
- Urlaub / Pausen / geschlossene Tage
- mehrere Standorte

## Wichtiger Hinweis

Die freie-Zeiten-Logik basiert aktuell auf festen Öffnungszeiten im Code und auf bereits gespeicherten Terminen. Das reicht für eine echte erste Live-Version. Wenn du später Urlaub, Pausen oder Sonderzeiten brauchst, ergänzen wir noch Tabellen für Verfügbarkeiten und Sperrzeiten.
