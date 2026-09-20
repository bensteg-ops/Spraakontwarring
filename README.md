# Spraakontwarring

Een eigen webapp om vergaderingen en gesprekken op te nemen, automatisch te
transcriberen met sprekerherkenning, en om te zetten in notulen en een
mindmap — vergelijkbaar met wat Notuly doet.

## Wat de app doet

1. **Opnemen** — start een opname direct in de browser (microfoon), of upload
   een bestaand audio-/videobestand.
2. **Transcriptie met sprekerherkenning** — het gesprek wordt automatisch
   omgezet in tekst, opgesplitst per spreker (Spreker A, B, C, ...).
3. **Sprekers hernoemen** — geef de sprekers echte namen; dit werkt direct
   door in het transcript en de notulen.
4. **Notulen** — een AI-model schrijft automatisch Nederlandstalige notulen:
   aanwezigen, samenvatting, besproken onderwerpen, besluiten en actiepunten.
5. **Mindmap** — dezelfde AI zet de kernonderwerpen om in een visuele
   mindmap, te downloaden als SVG-afbeelding.
6. **Exporteren** — notulen downloaden als Word (.docx) of PDF-bestand.
7. **Stemprofielen** — leg een keer een stem vast van iemand die vaak
   meedoet (bv. een collega), en de app herkent die persoon automatisch in
   volgende opnames, zodat je niet elke keer opnieuw hoeft te hernoemen.
8. **Delen met anderen** — iedereen maakt zijn eigen, gratis account aan
   (e-mail + wachtwoord) en ziet alleen zijn eigen opnames, notulen en
   stemprofielen. Ideaal om met een heel team dezelfde app te gebruiken
   zonder elkaars gesprekken te zien.

## Benodigde accounts (beide hebben een gratis proefperiode)

- **AssemblyAI** — voor transcriptie en sprekerherkenning.
  Aanmelden: https://www.assemblyai.com/dashboard/signup
- **Anthropic (Claude)** — voor het genereren van notulen en mindmap.
  Aanmelden: https://console.anthropic.com/

## Extra vereiste voor stemprofielen: ffmpeg

De stemprofielen-functie (automatische sprekerherkenning tussen opnames)
heeft **ffmpeg** nodig op de server waar je de app draait. Dit is gratis en
open source. De rest van de app (opnemen, transcriberen, notulen, mindmap,
Word/PDF-export) werkt ook prima **zonder** ffmpeg — dan blijft alleen de
automatische naamherkenning uit en hernoem je sprekers zelf, zoals altijd al
kon.

Installeren:

- macOS: `brew install ffmpeg`
- Ubuntu/Debian: `sudo apt install ffmpeg`
- Windows: installeer via https://ffmpeg.org/download.html en zorg dat
  `ffmpeg` in je PATH staat

Als ffmpeg ontbreekt, laat de app dit gewoon zien in het stemprofielen-
paneel en werkt verder alles normaal.

## Installatie

```bash
cd spraakontwarring
npm install
cp .env.example .env
```

Open `.env` en vul je twee API-sleutels in:

```
ASSEMBLYAI_API_KEY=jouw_sleutel
ANTHROPIC_API_KEY=jouw_sleutel
```

## Starten

```bash
npm start
```

Ga in je browser naar **http://localhost:3000**. Maak daar je eigen account
aan (e-mailadres + wachtwoord) — dat hoeft nergens vooraf geregistreerd te
worden, dat doet de app zelf voor je.

Voor ontwikkelen met automatisch herladen:

```bash
npm run dev
```

## Delen met anderen

Iedereen die bij de app kan (via hetzelfde webadres, op hetzelfde netwerk of
via internet als je de app online zet) kan zelf een gratis account aanmaken
en heeft daarna zijn eigen, privé werkruimte: eigen opnames, notulen en
stemprofielen, onzichtbaar voor anderen. Er is geen aparte uitnodiging nodig
— je geeft simpelweg het webadres van de app door.

Let op: omdat iedereen met het webadres zelf een account kan aanmaken, is
het verstandig de app niet zomaar publiek op het internet te zetten zonder
hier bewust voor te kiezen — deel het adres alleen met wie je vertrouwt.

## Gebruik

1. Klik op **"Opname starten"** om direct op te nemen, of upload een bestand
   via **"Bestand uploaden"**. Geef eventueel een titel mee en kies de taal
   (standaard Nederlands).
2. Zodra je stopt met opnemen (of het bestand is geüpload), verwerkt de app
   het gesprek op de achtergrond: uploaden → transcriberen → notulen en
   mindmap genereren. Dit duurt meestal ongeveer even lang als de opname
   zelf.
3. Klik in de lijst links op een opname om het transcript, de notulen en de
   mindmap te bekijken via de tabbladen.
4. Pas bovenaan het transcript de sprekersnamen aan. Klik daarna op
   **"Opnieuw genereren"** bij de notulen als je wilt dat de notulen de
   nieuwe namen gebruiken.
5. Klik bij de notulen op **"Word"** of **"PDF"** om ze te downloaden, of op
   **"Kopiëren"** om de tekst te plakken in een ander programma.
6. Klik bij de mindmap op **"SVG downloaden"** om de afbeelding te bewaren.

## Stemprofielen gebruiken (sprekers automatisch herkennen)

1. Vul in het paneel **"Stemprofielen"** links de naam van iemand in.
2. Klik op **"Opnemen"** en laat die persoon ~15-20 seconden gewoon praten
   (of upload een bestaand kort audiofragment van diegene via **"Upload"**).
3. Klik nogmaals op de knop om de opname te stoppen; het profiel wordt
   automatisch opgeslagen.
4. Herhaal dit voor iedereen die je vaak wilt herkennen (bv. vaste
   teamleden).
5. Bij elke nieuwe vergadering vergelijkt de app automatisch de stemmen in
   de opname met je opgeslagen profielen. Bij een goede match krijgt die
   spreker meteen de juiste naam in plaats van "Spreker A/B/C" — je kunt dit
   altijd nog handmatig corrigeren.

Let op: dit gebruikt een relatief eenvoudige, lokale stemvergelijking (geen
zwaar AI-model), dus het werkt het best in rustige omgevingen met duidelijk
verschillende stemmen. Bij twijfel laat de app de standaardnaam staan in
plaats van te gokken.

## Waar staan de gegevens?

Alles blijft op je eigen machine/server:

- Audiobestanden: `data/audio/`
- Transcript, notulen, mindmap en metadata: `data/db.json`
- Stemprofielen: `data/speakers.json`
- Accounts (e-mail + versleuteld wachtwoord): `data/users.json`

Er wordt niets opgeslagen bij Anthropic of AssemblyAI na verwerking (ga voor
de exacte bewaartermijnen van die diensten na op hun eigen documentatie/
privacybeleid, zeker als je met vertrouwelijke vergaderingen werkt).

## Technisch

- **Backend:** Node.js + Express (`server.js`, `lib/`)
- **Frontend:** losse HTML/CSS/JS, geen build-stap nodig (`public/`)
- **Transcriptie:** AssemblyAI REST API (`speaker_labels: true`)
- **Notulen/mindmap:** Anthropic Messages API (Claude)
- **Word/PDF-export:** `docx` en `pdfkit` (pure JavaScript, geen externe tools)
- **Stemprofielen:** ffmpeg (audio decoderen) + MFCC-kenmerken via `meyda`,
  vergeleken met cosine similarity — een lichte, dependency-vrije aanpak
  zonder Python/GPU-vereisten
- **Accounts:** wachtwoorden gehashed met `bcryptjs`, sessies via een
  ondertekend JWT-token in een `httpOnly`-cookie (`jsonwebtoken`); elke
  gebruiker heeft een eigen, geïsoleerde set opnames en stemprofielen
- **Opslag:** simpele JSON-bestanden + audiobestanden op schijf (geen
  database nodig, prima voor persoonlijk/klein teamgebruik)

## Uitbreidingsideeën

- Delen van één specifieke opname met iemand anders via een link (nu is
  alles privé per account).
- Wachtwoord vergeten / opnieuw instellen via e-mail.
- Een nauwkeuriger stemherkenningsmodel (bv. een deep-learning speaker-
  embedding) voor grotere groepen sprekers of rumoerigere opnames.
