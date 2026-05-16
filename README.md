# Angielskie Słownictwo – Fiszki

Prosta aplikacja webowa do nauki angielskiego słownictwa z fiszkami. Działa jako statyczna strona – nie wymaga backendu.

## Uruchomienie lokalne

Otwieranie `index.html` bezpośrednio w przeglądarce (`file://...`) **nie zadziała** ze względu na blokadę CORS przy `fetch()`. Potrzebny jest lokalny serwer HTTP.

### Opcja 1 – Python (zalecane)

```bash
cd "angielski slownictwo"
python3 -m http.server 8080
```

Następnie otwórz `http://localhost:8080` w przeglądarce.

### Opcja 2 – Node.js / npx

```bash
npx serve .
```

### Opcja 3 – rozszerzenie VS Code

Zainstaluj rozszerzenie **Live Server** (Ritwick Dey), kliknij prawym przyciskiem na `index.html` → *Open with Live Server*.

---

## Wdrożenie na GitHub Pages

1. Utwórz nowe repozytorium na GitHubie (np. `angielski-fiszki`).
2. Wypchnij pliki:

   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/<twoj-login>/angielski-fiszki.git
   git push -u origin main
   ```

3. W ustawieniach repozytorium (Settings → Pages) ustaw Source na **Deploy from a branch**, Branch: `main`, folder: `/ (root)`.
4. Po chwili aplikacja będzie dostępna pod adresem:
   `https://<twoj-login>.github.io/angielski-fiszki/`

---

## Struktura projektu

```
angielski slownictwo/
├── index.html       # Szkielet HTML
├── style.css        # Style (mobile-first)
├── app.js           # Logika aplikacji
├── data/
│   └── words.json   # Słówka (tablica JSON)
└── README.md
```

## Format words.json

```json
[
  {
    "english": "trial",
    "polish": "proces sądowy",
    "category": "LAW"
  }
]
```

Dostępne kategorie: `GENERAL`, `LAW`, `IDIOM`, `POLITICS`, `DISCUSSION`.

---

## Obsługa gestów

| Gest | Akcja |
|------|-------|
| Tapnięcie / kliknięcie fiszki | Odwróć fiszkę |
| Przeciągnięcie w lewo / prawo (≥ 80 px) | Następna fiszka |
| Przycisk „Odwróć" | Odwróć fiszkę |
| Przycisk „Następna" | Następna losowa fiszka |
| Przycisk „Wszystkie" | Zaznacz wszystkie kategorie |
| Przycisk „Wyczyść" | Odznacz wszystkie kategorie |
