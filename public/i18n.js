// ---------- Vertalingen van de app-interface (NL / EN / DE) ----------
// T is een object dat na het laden van de taal gevuld wordt met de teksten
// van de gekozen taal. app.js gebruikt overal T.iets in plaats van vaste
// Nederlandse tekst, zodat alles direct meeverandert als de taal wisselt.

const TRANSLATIONS = {
  nl: {
    authSubtitle: "Log in of maak een gratis account aan. Je opnames zijn privé — alleen jij ziet ze.",
    tabLogin: "Inloggen",
    tabRegister: "Account aanmaken",
    loginEmailPh: "E-mailadres",
    loginPasswordPh: "Wachtwoord",
    loginSubmit: "Inloggen",
    registerNamePh: "Je naam (optioneel)",
    registerEmailPh: "E-mailadres",
    registerPasswordPh: "Wachtwoord (minstens 8 tekens)",
    registerSubmit: "Account aanmaken",
    logout: "Uitloggen",
    recordStart: "Opname starten",
    recordStop: "Stop opname",
    uploadLabel: "📁 Bestand uploaden",
    titlePh: "Titel van vergadering (optioneel)",
    langConvNl: "Nederlands (gesprek)",
    langConvEn: "Engels (gesprek)",
    langConvAuto: "Taal automatisch detecteren",
    minutesLangAuto: "Notulen: zelfde taal als gesprek",
    minutesLangNl: "Notulen: altijd Nederlands",
    minutesLangEn: "Notulen: altijd Engels",
    speakerProfilesTitle: "🗣️ Stemprofielen",
    speakerNamePh: "Naam van de spreker",
    profileRecord: "🎙️ Opnemen",
    profileStop: "⏹ Stop",
    profileUpload: "📁 Upload",
    recordingListHeader: "Eerdere opnames",
    emptyStateText: "Selecteer een opname of start een nieuwe opname links.",
    backToList: "← Terug",
    backToListTitle: "Terug naar opnames",
    deleteRecordingTitle: "Opname verwijderen",
    tabTranscript: "Transcript",
    tabMinutes: "Notulen",
    tabMindmap: "Mindmap",
    regenerate: "🔄 Opnieuw genereren",
    copy: "📋 Kopiëren",
    copied: "✅ Gekopieerd",
    exportWord: "⬇️ Word",
    exportPdf: "⬇️ PDF",
    downloadSvg: "⬇️ SVG downloaden",
    uiLangTitle: "Taal van de app",
    statusUploading: "Uploaden…",
    statusTranscribing: "Transcriberen…",
    statusTranscribed: "Transcript klaar",
    statusGenerating: "Notulen maken…",
    statusDone: "Klaar",
    statusError: "Fout",
    noTranscript: "Nog geen transcript. Status:",
    noMinutes: "Nog geen notulen. Status:",
    noMindmap: "Nog geen mindmap. Status:",
    speakerPrefix: "Spreker",
    meetingDefault: "Vergadering",
    consentText:
      "Bevestig toestemming:\n\n" +
      "“Ik neem dit gesprek op zodat ik automatisch een verslag kan maken — vind je dat goed?”\n\n" +
      "Klik op OK als de deelnemer(s) akkoord zijn gegaan.",
    micError: "Kon microfoon niet gebruiken: ",
    uploadFailed: "Upload mislukt",
    uploadError: "Er ging iets mis bij het uploaden: ",
    deleteConfirm: (title) => `Opname "${title}" verwijderen?`,
    nameRequired: "Vul eerst een naam in voor deze spreker.",
    profileSaveFailed: "Opslaan van stemprofiel mislukt",
    profileSaveError: "Kon stemprofiel niet opslaan: ",
    profileSaved: (name) => `Stemprofiel "${name}" opgeslagen.`,
    profileRecordingStatus: "Aan het opnemen — laat de persoon ~15-20 sec spreken, klik dan op stop.",
    profileProcessing: "Verwerken…",
    loadProfilesFailed: "Kon profielen niet laden",
    ffmpegMissing: "ffmpeg ontbreekt op de server",
    noProfilesYet: "Nog geen stemprofielen. Neem een stem van ~15 sec op om iemand automatisch te laten herkennen.",
    deleteProfileTitle: "Profiel verwijderen",
    loginFailed: "Inloggen mislukt",
    registerFailed: "Account aanmaken mislukt",
    locale: "nl-NL",
  },
  en: {
    authSubtitle: "Log in or create a free account. Your recordings are private — only you can see them.",
    tabLogin: "Log in",
    tabRegister: "Create account",
    loginEmailPh: "Email address",
    loginPasswordPh: "Password",
    loginSubmit: "Log in",
    registerNamePh: "Your name (optional)",
    registerEmailPh: "Email address",
    registerPasswordPh: "Password (at least 8 characters)",
    registerSubmit: "Create account",
    logout: "Log out",
    recordStart: "Start recording",
    recordStop: "Stop recording",
    uploadLabel: "📁 Upload file",
    titlePh: "Meeting title (optional)",
    langConvNl: "Dutch (conversation)",
    langConvEn: "English (conversation)",
    langConvAuto: "Detect language automatically",
    minutesLangAuto: "Minutes: same language as conversation",
    minutesLangNl: "Minutes: always Dutch",
    minutesLangEn: "Minutes: always English",
    speakerProfilesTitle: "🗣️ Voice profiles",
    speakerNamePh: "Speaker's name",
    profileRecord: "🎙️ Record",
    profileStop: "⏹ Stop",
    profileUpload: "📁 Upload",
    recordingListHeader: "Previous recordings",
    emptyStateText: "Select a recording or start a new one on the left.",
    backToList: "← Back",
    backToListTitle: "Back to recordings",
    deleteRecordingTitle: "Delete recording",
    tabTranscript: "Transcript",
    tabMinutes: "Minutes",
    tabMindmap: "Mind map",
    regenerate: "🔄 Regenerate",
    copy: "📋 Copy",
    copied: "✅ Copied",
    exportWord: "⬇️ Word",
    exportPdf: "⬇️ PDF",
    downloadSvg: "⬇️ Download SVG",
    uiLangTitle: "App language",
    statusUploading: "Uploading…",
    statusTranscribing: "Transcribing…",
    statusTranscribed: "Transcript ready",
    statusGenerating: "Generating minutes…",
    statusDone: "Done",
    statusError: "Error",
    noTranscript: "No transcript yet. Status:",
    noMinutes: "No minutes yet. Status:",
    noMindmap: "No mind map yet. Status:",
    speakerPrefix: "Speaker",
    meetingDefault: "Meeting",
    consentText:
      "Confirm consent:\n\n" +
      "“I'm recording this conversation so I can automatically create a report — is that okay with you?”\n\n" +
      "Click OK once the participant(s) have agreed.",
    micError: "Could not use microphone: ",
    uploadFailed: "Upload failed",
    uploadError: "Something went wrong while uploading: ",
    deleteConfirm: (title) => `Delete recording "${title}"?`,
    nameRequired: "Please enter a name for this speaker first.",
    profileSaveFailed: "Failed to save voice profile",
    profileSaveError: "Could not save voice profile: ",
    profileSaved: (name) => `Voice profile "${name}" saved.`,
    profileRecordingStatus: "Recording — let the person speak for ~15-20 sec, then click stop.",
    profileProcessing: "Processing…",
    loadProfilesFailed: "Could not load profiles",
    ffmpegMissing: "ffmpeg is missing on the server",
    noProfilesYet: "No voice profiles yet. Record ~15 sec of someone's voice so they can be recognized automatically.",
    deleteProfileTitle: "Delete profile",
    loginFailed: "Login failed",
    registerFailed: "Account creation failed",
    locale: "en-US",
  },
  de: {
    authSubtitle: "Melde dich an oder erstelle ein kostenloses Konto. Deine Aufnahmen sind privat — nur du siehst sie.",
    tabLogin: "Anmelden",
    tabRegister: "Konto erstellen",
    loginEmailPh: "E-Mail-Adresse",
    loginPasswordPh: "Passwort",
    loginSubmit: "Anmelden",
    registerNamePh: "Dein Name (optional)",
    registerEmailPh: "E-Mail-Adresse",
    registerPasswordPh: "Passwort (mindestens 8 Zeichen)",
    registerSubmit: "Konto erstellen",
    logout: "Abmelden",
    recordStart: "Aufnahme starten",
    recordStop: "Aufnahme stoppen",
    uploadLabel: "📁 Datei hochladen",
    titlePh: "Titel der Besprechung (optional)",
    langConvNl: "Niederländisch (Gespräch)",
    langConvEn: "Englisch (Gespräch)",
    langConvAuto: "Sprache automatisch erkennen",
    minutesLangAuto: "Protokoll: gleiche Sprache wie Gespräch",
    minutesLangNl: "Protokoll: immer Niederländisch",
    minutesLangEn: "Protokoll: immer Englisch",
    speakerProfilesTitle: "🗣️ Sprachprofile",
    speakerNamePh: "Name des Sprechers",
    profileRecord: "🎙️ Aufnehmen",
    profileStop: "⏹ Stopp",
    profileUpload: "📁 Hochladen",
    recordingListHeader: "Frühere Aufnahmen",
    emptyStateText: "Wähle eine Aufnahme aus oder starte links eine neue.",
    backToList: "← Zurück",
    backToListTitle: "Zurück zu den Aufnahmen",
    deleteRecordingTitle: "Aufnahme löschen",
    tabTranscript: "Transkript",
    tabMinutes: "Protokoll",
    tabMindmap: "Mindmap",
    regenerate: "🔄 Neu generieren",
    copy: "📋 Kopieren",
    copied: "✅ Kopiert",
    exportWord: "⬇️ Word",
    exportPdf: "⬇️ PDF",
    downloadSvg: "⬇️ SVG herunterladen",
    uiLangTitle: "Sprache der App",
    statusUploading: "Wird hochgeladen…",
    statusTranscribing: "Wird transkribiert…",
    statusTranscribed: "Transkript fertig",
    statusGenerating: "Protokoll wird erstellt…",
    statusDone: "Fertig",
    statusError: "Fehler",
    noTranscript: "Noch kein Transkript. Status:",
    noMinutes: "Noch kein Protokoll. Status:",
    noMindmap: "Noch keine Mindmap. Status:",
    speakerPrefix: "Sprecher",
    meetingDefault: "Besprechung",
    consentText:
      "Zustimmung bestätigen:\n\n" +
      "„Ich nehme dieses Gespräch auf, um automatisch ein Protokoll zu erstellen — ist das für dich in Ordnung?“\n\n" +
      "Klicke auf OK, sobald die Teilnehmer zugestimmt haben.",
    micError: "Mikrofon konnte nicht verwendet werden: ",
    uploadFailed: "Upload fehlgeschlagen",
    uploadError: "Beim Hochladen ist etwas schiefgelaufen: ",
    deleteConfirm: (title) => `Aufnahme "${title}" löschen?`,
    nameRequired: "Bitte gib zuerst einen Namen für diesen Sprecher ein.",
    profileSaveFailed: "Speichern des Sprachprofils fehlgeschlagen",
    profileSaveError: "Sprachprofil konnte nicht gespeichert werden: ",
    profileSaved: (name) => `Sprachprofil "${name}" gespeichert.`,
    profileRecordingStatus: "Aufnahme läuft — lass die Person ca. 15-20 Sek. sprechen und klicke dann auf Stopp.",
    profileProcessing: "Wird verarbeitet…",
    loadProfilesFailed: "Profile konnten nicht geladen werden",
    ffmpegMissing: "ffmpeg fehlt auf dem Server",
    noProfilesYet: "Noch keine Sprachprofile. Nimm ca. 15 Sek. einer Stimme auf, damit die Person automatisch erkannt werden kann.",
    deleteProfileTitle: "Profil löschen",
    loginFailed: "Anmeldung fehlgeschlagen",
    registerFailed: "Kontoerstellung fehlgeschlagen",
    locale: "de-DE",
  },
};

// T wordt gevuld met de huidige taal en blijft daarna hetzelfde object —
// app.js leest steeds T.iets, dus zodra T opnieuw gevuld wordt (taalwissel)
// pakken alle volgende weergaves automatisch de nieuwe taal.
const T = {};

function currentLang() {
  const saved = localStorage.getItem("uiLang");
  if (saved && TRANSLATIONS[saved]) return saved;
  return "nl";
}

function applyTranslations(lang) {
  if (!TRANSLATIONS[lang]) lang = "nl";
  Object.assign(T, TRANSLATIONS[lang]);

  document.documentElement.lang = lang;

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (T[key] !== undefined) el.textContent = T[key];
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (T[key] !== undefined) el.placeholder = T[key];
  });
  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    const key = el.getAttribute("data-i18n-title");
    if (T[key] !== undefined) el.title = T[key];
  });

  const uiLangSelect = document.getElementById("uiLangSelect");
  if (uiLangSelect) uiLangSelect.value = lang;

  // app.js registreert hier (indien nodig) een functie die dynamisch
  // getoonde teksten (lijst, detailscherm, stemprofielen) opnieuw tekent.
  if (typeof window.onLanguageChange === "function") {
    window.onLanguageChange();
  }
}

function setLang(lang) {
  localStorage.setItem("uiLang", lang);
  applyTranslations(lang);
}

document.addEventListener("DOMContentLoaded", () => {
  applyTranslations(currentLang());
  const uiLangSelect = document.getElementById("uiLangSelect");
  if (uiLangSelect) {
    uiLangSelect.addEventListener("change", () => setLang(uiLangSelect.value));
  }
});
