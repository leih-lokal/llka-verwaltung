/**
 * Documentation content for help modals
 * Content is written in markdown format
 */

export const DOCUMENTATION = {
  
  customerForm: `

## Basisdaten

### ID
Die eindeutige Nutzer-ID wird automatisch vergeben. Das ist normalerweise die nächst-höhere Zahl, basierend auf der höchsten ID in der Datenbank. **Bitte ändere die ID nur, wenn du weißt, was du tust.**

### Vorname & Nachname
Der vollständige Name des Kunden. **Pflichtfelder**: Beide Felder müssen ausgefüllt sein.

### E-Mail
E-Mail-Adresse für Benachrichtigungen und Newsletter. Auch wenn dieses Feld nicht erforderlich ist, sollte jeder Nutzer eine E-Mail-Adresse haben.

### Telefon
Telefonnummer für Rückfragen und Erinnerungen.

### Straße & Hausnummer
Vollständige Straßenadresse. **Beispiel**: "Musterstraße 42a". Hier sind auch Zusatzinformationen wie C/O oder Apartmentnummer möglich.

### PLZ & Stadt
Postleitzahl und Ortsname.

## Mitgliedschaft

### Mitglied seit
Datum der ersten Registrierung.

### Verlängert am
Datum der letzten Mitgliedschaftsverlängerung. Aktualisiere dieses Datum bei der zwei-jährlichen Verlängerung. Die Datenbank verwendet es als Referenz für die nächste Verlängerung.

### Newsletter
Ob der Nutzer den Newsletter erhalten möchte.

## Zusätzliche Informationen

### Markierungsfarbe
Visuelle Hervorhebung in der Nutzerliste. Diese Farben sollten eine einheitliche Bedeutung innerhalb der Tabelle haben. Aktuell wird es folgendermaßen verwendet:

- ROT: Aktiver Problemnutzer. Keine Ausleihen möglich.
- GELB: Fehlende Informationen wie Telefonnummer oder Ausweis.
- GRÜN: Teil des Teams.
- BLAU: Noch nicht zum Newsletter hinzugefügt.

### Bemerkung
Interne Notizen zum Kunden. Diese werden zusammen mit der Farbe oben angezeigt.

**Wichtig**: Diese Notizen sind nur für Mitarbeiter sichtbar!
`,

  rentalForm: `

## Nutzer auswählen

Suche nach Nutzer-ID oder Name. **Tipp**: Die Suche ignoriert führende Nullen (0451 findet 451).

## Artikel auswählen

Suche nach Artikel-ID, Name, Marke oder Modell. **Mehrfachauswahl**: Du kannst mehrere Artikel zu einer Ausleihe hinzufügen. Hat ein Gegenstand **Instanzen**, also mehrere Exemplare, können so viele ausgeliehen werden, wie verfügbar sind.

## Datum

### Ausgeliehen am
Das Datum der Ausgabe (standardmäßig heute).

### Rückgabe erwartet
Das geplante Rückgabedatum.

**Standard-Leihfrist**: Standardmäßig 7, üblicherweise 21 Tage. Verwende die Taste 3W um schnell 21 Tage zu setzen.

### Verlängert am
Falls die Ausleihe verlängert wurde, das neue Rückgabedatum. **Optional**: Nur ausfüllen bei Verlängerung.

### Zurückgegeben am
Das tatsächliche Rückgabedatum. **Leer lassen**: Solange die Ausleihe aktiv ist.

## Kaution (Pfand)

### Pfand gegeben
Der bei Ausgabe hinterlegte Kautionsbetrag. **Automatik**: Wird aus den Artikeln berechnet, kann aber angepasst werden.

### Pfand zurück
Der bei Rückgabe erstattete Betrag. **Abzüge**: Bei Beschädigung oder Verlust kann ein Teil einbehalten werden.

## Mitarbeiter

Normalerweise werden diese Felder automatisch gefüllt. Solange eine Identität gesetzt ist, werden die Felder mit dem Kürzel der Identität gefüllt. Ansonsten werden diese Felder manuell eingetragen.

## Tipps

- Prüfe bei Rücknahme immer die Teileliste des Artikels.
- Dokumentiere Beschädigungen sofort und trage sie in Linear ein.

## Teilrückgaben

Die Software erlaubt es dir, einzelne Gegenstände eines Leihvorgangs als zurückgegeben zu markieren, ohne den gesamten Vorgang schließen zu müssen. Aufgrund einer aktuellen technischen Einschränkung werden diese Gegenstände jedoch erst wieder für neue Ausleihen als „verfügbar“ freigegeben, sobald der gesamte Leihvorgang (also alle zugehörigen Objekte) vollständig abgeschlossen ist.

In der Praxis stellt dies selten ein Problem dar, da Nutzer ihre Gegenstände meist gesammelt zurückbringen oder für parallele Ausleihen separate Vorgänge nutzen. Die Einschränkung ist bekannt und wird in einem zukünftigen Update behoben.
`,

  reservationForm: `
  
## Abholcode

Der Abholcode (intern OTP) wird dem Nutzer in der Email zur Reservierung mitgeteilt. Hiermit könnt ihr einfach Reservierungen selbst mit ähnlichen Gegenständen zuordnen.

### Neunutzer ("Townie")

Person, die noch nicht im System registriert ist. Ist dieses Feld aktiv, kann direkt aus den Daten ein neuer Nutzer erstellt werden. Dafür muss aber zumindest ein Name eingetragen werden, nur eine Email ist nicht genug.

### Artikelsuche
Suche nach Artikel-ID, Name oder Kategorie. **Mehrfachauswahl**: Mehrere Artikel können reserviert werden. **Instanzen werden hier ignoriert und sind nur im Leihvorgang verfügbar.**

### Abholdatum

Das geplante Datum der Abholung. **Muss in der Zukunft und während den Öffnungszeiten liegen.**
`,

  itemForm: `

### ID
Eindeutige Gegenstands-ID. Die ersten zwei Ziffern bestimmen das Regal, in dem sich der Gegenstand befindet.

- **00-19:** Hauptlager
- **20-39:** Annex
- **4X:** Büro & Frei_Räume
- **5X:** Gartenschuppen
- **6X:** Partyschuppen

**Wichtig**: Die ID wird automatisch bei der Erstellung vergeben und sollte normalerweise nicht geändert werden, da sie auf gedruckten Etiketten verwendet wird.

### Name
Der Hauptname des Artikels, wie er in Listen und bei der Suche angezeigt wird. Verwende einen kurzen, deskriptiven Namen ohne Marken.

**Beispiele**:
- "Waffeleisen" ✓
- "Gerät zum Waffeln backen" ✗ (nicht suchbar)
- "Waffeleisen, belgisch, rot" ✗ (zu viel Detail)
- "Cuisinart Waffeleisen" ✗ (keine Marken)

### Marke
Der Hersteller oder die Marke des Artikels. Wird immer in Sentence Case angezeigt. Hersteller mit Abkürzungen (HP, AEG, WMF) werden nur bis zu drei Buchstaben großgeschreiben. Kann leer sein, in diesem Fall wird ein Schrägstrich ( **/** ) eingegeben. 

**Beispiele**:
- "Parkside" ✓
- "Aeg" ✗ (Abkürzung unter 4, AEG)
- "PROFI COOK" ✗ (Versalien, Profi Cook)
- "king craft" ✗ (Sentence Case, King Craft)

### Modell
Die genaue Modellbezeichnung des Herstellers. Steht meist auf einem Aufkleber am Gerät oder in der Bedienungsanleitung. Kann nicht alleine stehen, darf aber leer sein. In diesem Fall wird ein Schrägstrich ( **/** ) eingegeben.

**Beispiele**:
- "X1 Carbon" ✓
- "Bambu Lab X1 Carbon" ✗ (Enthält Marke)
- "SN77218482" ✗ (Seriennummer)

### Beschreibung
Ausführliche Beschreibung des Artikels für Kunden.

- Beschreibe Funktionen und Besonderheiten
- Erwähne Größe, Kapazität oder Leistung falls relevant
- Halte es kundenfreundlich und verständlich

**Beispiel**: "Belgisches Waffeleisen für herzförmige Waffeln. 1000W Leistung, Antihaftbeschichtung, spülmaschinenfeste Platten. Für 2 Waffeln gleichzeitig."

### Kategorien
Ordne den Artikel einer oder mehreren Kategorien zu.

**Verfügbare Kategorien**:
- **Küche**: Küchengeräte und Kochutensilien
- **Haushalt**: Reinigung, Wäsche, allgemeine Haushaltshilfen
- **Garten**: Gartengeräte und Outdoor
- **Kinder**: Spielzeug und Kinderartikel
- **Freizeit**: Sport, Camping, Hobby
- **Heimwerken**: Werkzeuge und Baugeräte
- **Sonstige**: Alles andere

### Kaution (Pfand)
Der Kautionsbetrag in Euro, den Kunden bei Ausleihe hinterlegen. Die Gesamtkaution einer Ausleihe wird automatisch aus allen Artikeln berechnet.

**Empfehlung**: Orientiere dich am Wiederbeschaffungswert (ca. 10-30% des Neupreises). Bei Gegenständen mit hohem Kriminalpotential (bspw. Bolzenschneider) ist eine hohe Summe empfohlen. Es wird empfohlen, einen Pfandbetrag zu wählen, der in 5 endet. So bleiben öfter €5 in der Spendenkasse.

### UVP (Unverbindliche Preisempfehlung)
Der ungefähre Neupreis des Artikels in Euro. Kannst du den Preis nicht finden, sind Schätzungen akzeptabel. Wird bei der Statistik verwendet, um zu berechnen, wie viel Geld ein Nutzer durch Ausleihen gespart hat.

### Anzahl Exemplare
Anzahl der identischen Exemplare dieses Artikels im Bestand.

### Status
Aktueller Verfügbarkeitsstatus des Artikels.

**Statusoptionen**:
- **Auf Lager**: Verfügbar zum Ausleihen (grün)
- **Ausgeliehen**: Aktuell verliehen (wird automatisch gesetzt)
- **Reserviert**: Für Kunde reserviert
- **Reparatur**: In Reparatur, nicht verfügbar
- **Verloren**: Nicht mehr auffindbar
- **Zu verkaufen**: Wird aus Sortiment genommen
- **Gelöscht**: Archiviert (nicht mehr sichtbar)

**Automatik**: Der Status "Ausgeliehen" wird beim Ausleihen automatisch gesetzt.

### Bilder

Lade Produktfotos hoch (mehrere gleichzeitig möglich).

**Empfehlungen**:
- **Erstes Bild** wird als Hauptbild in Tabellen verwendet
- Zeige den Artikel aus verschiedenen Winkeln
- Fotografiere wichtige Details (Bedienelemente, Anschlüsse)
- Zeige Zubehör und Einzelteile
- **Max. 5 Bilder** pro Artikel empfohlen

### Synonyme
Alternative Suchbegriffe, kommagetrennt. **Wichtig**: Diese verbessern die Auffindbarkeit bei der Suche erheblich!

**Beispiele**:
- Waffeleisen: "Belgische Waffeln, Herzwaffeln, Waffle Maker"
- Pürierstab: "Mixer, Stabmixer, Blender, Zauberstab"
- Akkuschrauber: "Bohrmaschine, Schlagbohrer, Akkubohrer"

**Tipp**: Denke an umgangssprachliche Begriffe und englische Bezeichnungen.

### Verpackung
Beschreibung der Originalverpackung (falls vorhanden).

**Beispiele**:
- "Karton mit Schaumstoff-Einlage"
- "Kunststoffkoffer mit Formschale"
- "Stoffbeutel"
- "Keine Originalverpackung"

**Warum wichtig**: Hilft bei der Rückgabe zu prüfen, ob alles vollständig ist.

### Anleitung
URL zur Online-Anleitung, falls möglich. Ansonsten können hier direkte Anweisungen eingetragen werden.

### Teile
Anzahl der Teile.

### Markierungsfarbe
Visuelle Hervorhebung in der Artikelliste.

- **Rot**: Problematische Artikel (häufig defekt, Verlustrisiko)
- **Orange**: Auslaufende Artikel
- **Gelb**: Artikel mit besonderen Hinweisen
- **Grün**: Besonders beliebte Artikel, VIP-Artikel
- **Blau**: Neuanschaffungen, wertvolle Artikel
- **Türkis**: Team-Favoriten
- **Rosa**: Saisonale Artikel
- **Lila**: Artikel für spezielle Veranstaltungen
`,
} as const;

export type DocumentationKey = keyof typeof DOCUMENTATION;
