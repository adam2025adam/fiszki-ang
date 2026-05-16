'use strict';

// ─── Konfiguracja ────────────────────────────────────────────────────────────

const STORAGE_KEY     = 'fiszki_categories';
const SWIPE_THRESHOLD = 80; // px – minimalne przesunięcie uznawane za swipe

// ─── Stan aplikacji ───────────────────────────────────────────────────────────

let allWords         = [];
let categories       = []; // wypełniane dynamicznie z words.json
let activeCategories = new Set();
let currentWord      = null;
let lastWord         = null;
let isFlipped        = false;

// ─── Elementy DOM ─────────────────────────────────────────────────────────────

const cardEl      = document.getElementById('card');
const wordEnEl    = document.getElementById('word-en');
const wordPlEl    = document.getElementById('word-pl');
const chipsEl     = document.getElementById('category-chips');
const noCatMsg    = document.getElementById('no-category-msg');
const cardWrapper = document.getElementById('card-wrapper');
const btnFlip     = document.getElementById('btn-flip');
const btnNext     = document.getElementById('btn-next');
const btnAll      = document.getElementById('btn-all');
const btnNone     = document.getElementById('btn-none');
const btnCategory = document.getElementById('btn-category');
const catPanel    = document.getElementById('cat-panel');
const catBadge    = document.getElementById('cat-badge');

// ─── Ładowanie danych ─────────────────────────────────────────────────────────

async function loadWords() {
  try {
    const res = await fetch('./data/words.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    allWords   = await res.json();
    categories = [...new Set(allWords.map(w => w.category))].sort();

    if (categories.length === 0) {
      noCatMsg.textContent = 'Brak słówek w pliku data/words.json';
      noCatMsg.classList.remove('hidden');
      return;
    }

    init();
  } catch (err) {
    noCatMsg.textContent = 'Błąd ładowania danych – odśwież stronę';
    noCatMsg.classList.remove('hidden');
    console.error('Nie udało się pobrać words.json:', err);
  }
}

// ─── Inicjalizacja ────────────────────────────────────────────────────────────

function init() {
  buildCategoryChips();
  loadCategoriesFromStorage();
  renderChips();
  showNextCard();
}

// ─── Panel kategorii ──────────────────────────────────────────────────────────

function toggleCategoryPanel() {
  const isOpen = catPanel.classList.contains('open');
  if (isOpen) {
    closeCategoryPanel();
  } else {
    catPanel.classList.add('open');
    catPanel.setAttribute('aria-hidden', 'false');
    btnCategory.setAttribute('aria-expanded', 'true');
  }
}

function closeCategoryPanel() {
  catPanel.classList.remove('open');
  catPanel.setAttribute('aria-hidden', 'true');
  btnCategory.setAttribute('aria-expanded', 'false');
}

// Zamknij panel po kliknięciu poza nim
document.addEventListener('pointerdown', e => {
  if (!catPanel.classList.contains('open')) return;
  if (!catPanel.contains(e.target) && !btnCategory.contains(e.target)) {
    closeCategoryPanel();
  }
});

// ─── Kategorie ────────────────────────────────────────────────────────────────

/** Tworzy chip dla każdej kategorii */
function buildCategoryChips() {
  chipsEl.innerHTML = '';
  categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className   = 'chip';
    btn.textContent = cat;
    btn.dataset.cat = cat;
    btn.addEventListener('click', () => toggleCategory(cat));
    chipsEl.appendChild(btn);
  });
}

function toggleCategory(cat) {
  if (activeCategories.has(cat)) {
    activeCategories.delete(cat);
  } else {
    activeCategories.add(cat);
  }
  saveCategoriesToStorage();
  renderChips();
  showNextCard();
}

function setAllCategories() {
  activeCategories = new Set(categories);
  saveCategoriesToStorage();
  renderChips();
  showNextCard();
}

function clearCategories() {
  activeCategories.clear();
  saveCategoriesToStorage();
  renderChips();
  showNextCard();
}

/** Aktualizuje wygląd chipów i odznakę na przycisku */
function renderChips() {
  chipsEl.querySelectorAll('.chip').forEach(btn => {
    btn.classList.toggle('active', activeCategories.has(btn.dataset.cat));
  });
  const count = activeCategories.size;
  catBadge.textContent = count;
  catBadge.style.display = count > 0 ? '' : 'none';
}

// ─── localStorage ─────────────────────────────────────────────────────────────

function saveCategoriesToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...activeCategories]));
}

function loadCategoriesFromStorage() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const arr = JSON.parse(saved);
      // Zachowaj tylko te kategorie, które faktycznie istnieją w JSON
      activeCategories = new Set(arr.filter(c => categories.includes(c)));
    } catch {
      activeCategories = new Set(categories);
    }
  } else {
    activeCategories = new Set(categories);
  }
}

// ─── Wybieranie słówka ────────────────────────────────────────────────────────

function getActivePool() {
  return allWords.filter(w => activeCategories.has(w.category));
}

/** Wybiera losowe słówko, unikając powtórzenia jeśli pula > 1 */
function pickRandom(pool) {
  if (pool.length === 0) return null;
  if (pool.length === 1) return pool[0];
  const candidates = pool.filter(w => w !== lastWord);
  return candidates[Math.floor(Math.random() * candidates.length)];
}

// ─── Wyświetlanie fiszki ──────────────────────────────────────────────────────

function showNextCard() {
  const pool = getActivePool();

  if (pool.length === 0) {
    noCatMsg.classList.remove('hidden');
    cardWrapper.classList.add('hidden');
    return;
  }

  noCatMsg.classList.add('hidden');
  cardWrapper.classList.remove('hidden');

  lastWord    = currentWord;
  currentWord = pickRandom(pool);

  resetFlipWithoutAnimation();

  wordEnEl.textContent = currentWord.english;
  wordPlEl.textContent = currentWord.polish;
}

// ─── Odwracanie fiszki ────────────────────────────────────────────────────────

function setFlipped(value) {
  isFlipped = value;
  cardEl.classList.toggle('flipped', isFlipped);
  btnFlip.classList.toggle('showing-back', isFlipped);
}

function flipCard() {
  setFlipped(!isFlipped);
}

function resetFlipWithoutAnimation() {
  cardEl.classList.add('no-flip-transition');
  setFlipped(false);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    cardEl.classList.remove('no-flip-transition');
  }));
}

// ─── Animacja swipe (Web Animations API) ─────────────────────────────────────

/**
 * Buduje string transformacji dla cardWrapper podczas przeciągania.
 * Tylko 2D – flip obsługuje cardEl przez klasę .flipped.
 */
function buildDragTransform(dx) {
  const rotate = dx * 0.07;
  return `translateX(${dx}px) rotate(${rotate}deg)`;
}

/**
 * Animuje cardWrapper poza ekran i ładuje następną fiszkę.
 * @param {string} dir        - 'left' lub 'right'
 * @param {number|null} fromDx - aktualne przesunięcie palca (null = kliknięcie przycisku)
 */
function swipeOut(dir, fromDx = null) {
  cardEl.style.pointerEvents = 'none';

  // Punkt startowy: bieżąca pozycja wrappera
  const fromTransform = fromDx !== null ? buildDragTransform(fromDx) : 'none';

  // Punkt docelowy: poza ekranem
  const exitPx      = (window.innerWidth + 300) * (dir === 'left' ? -1 : 1);
  const exitRot     = dir === 'left' ? -12 : 12;
  const toTransform = `translateX(${exitPx}px) rotate(${exitRot}deg)`;

  const anim = cardWrapper.animate(
    [
      { transform: fromTransform, opacity: 1 },
      { transform: toTransform,   opacity: 0 },
    ],
    { duration: 280, easing: 'ease-in', fill: 'forwards' }
  );

  anim.onfinish = () => {
    anim.commitStyles();
    anim.cancel();

    cardWrapper.style.transform     = '';
    cardWrapper.style.opacity       = '0'; // tymczasowo ukryj podczas zamiany treści
    cardEl.style.pointerEvents      = '';

    showNextCard();

    // Slide-in nowej fiszki po dwóch klatkach (żeby przeglądarka zaaplikowała nową treść)
    requestAnimationFrame(() => requestAnimationFrame(() => {
      cardWrapper.style.opacity = '';
      cardWrapper.classList.add('anim-slide-in');
      cardWrapper.addEventListener('animationend', () => {
        cardWrapper.classList.remove('anim-slide-in');
      }, { once: true });
    }));
  };
}

// ─── Obsługa gestów (pointer events) ─────────────────────────────────────────

let pointerStart   = null;
let pointerCurrent = null;
let isDragging     = false;

function onPointerDown(e) {
  if (e.pointerType === 'touch' && e.isPrimary === false) return;

  pointerStart   = { x: e.clientX, y: e.clientY };
  pointerCurrent = { x: e.clientX, y: e.clientY };
  isDragging     = false;

  cardEl.setPointerCapture(e.pointerId);
}

function onPointerMove(e) {
  if (!pointerStart) return;

  pointerCurrent = { x: e.clientX, y: e.clientY };
  const dx = pointerCurrent.x - pointerStart.x;
  const dy = pointerCurrent.y - pointerStart.y;

  if (!isDragging && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
    isDragging = true;
    cardEl.classList.add('dragging');
  }

  if (!isDragging) return;

  // Swipe obsługuje cardWrapper; cardEl odpowiada tylko za flip
  cardWrapper.style.transform = buildDragTransform(dx);
}

function onPointerUp(e) {
  if (!pointerStart) return;

  const dx         = (pointerCurrent?.x ?? pointerStart.x) - pointerStart.x;
  const wasGesture = isDragging;

  cardEl.classList.remove('dragging');

  if (wasGesture && Math.abs(dx) >= SWIPE_THRESHOLD) {
    // Swipe: cardWrapper kontynuuje ruch z miejsca puszczenia
    swipeOut(dx < 0 ? 'left' : 'right', dx);
  } else if (wasGesture) {
    // Krótki drag poniżej progu: powrót na środek z animacją transition
    cardWrapper.style.transition = 'transform 0.35s ease';
    cardWrapper.style.transform  = '';
    cardWrapper.addEventListener('transitionend', () => {
      cardWrapper.style.transition = '';
    }, { once: true });
  } else {
    // Czysty tap bez przeciągania: odwróć fiszkę
    flipCard();
  }

  pointerStart   = null;
  pointerCurrent = null;
  isDragging     = false;
}

function onPointerCancel() {
  cardEl.classList.remove('dragging');
  cardWrapper.style.transform = '';
  pointerStart   = null;
  pointerCurrent = null;
  isDragging     = false;
}

// ─── Rejestracja zdarzeń ──────────────────────────────────────────────────────

cardEl.addEventListener('pointerdown',   onPointerDown);
cardEl.addEventListener('pointermove',   onPointerMove);
cardEl.addEventListener('pointerup',     onPointerUp);
cardEl.addEventListener('pointercancel', onPointerCancel);

// Blokuje przewijanie strony podczas przeciągania fiszki
cardEl.addEventListener('touchstart', e => e.preventDefault(), { passive: false });

btnCategory.addEventListener('click', toggleCategoryPanel);
btnFlip.addEventListener('click', flipCard);
btnNext.addEventListener('click', () => swipeOut('left'));
btnAll.addEventListener('click', setAllCategories);
btnNone.addEventListener('click', clearCategories);

// ─── Start ────────────────────────────────────────────────────────────────────

loadWords();
