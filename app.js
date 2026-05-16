'use strict';

// ─── Konfiguracja ────────────────────────────────────────────────────────────

const STORAGE_KEY     = 'fiszki_categories';
const PROGRESS_KEY    = 'fiszki_progress';
const SWIPE_THRESHOLD = 80; // px

// ─── Stan aplikacji ───────────────────────────────────────────────────────────

let allWords         = [];
let categories       = [];
let activeCategories = new Set();
let currentWord      = null;
let lastWord         = null;
let isFlipped        = false;
let isShowingCompletion = false;
let completionTimeout   = null;

// ─── Elementy DOM ─────────────────────────────────────────────────────────────

const cardEl      = document.getElementById('card');
const wordEnEl    = document.getElementById('word-en');
const wordPlEl    = document.getElementById('word-pl');
const chipsEl     = document.getElementById('category-chips');
const noCatMsg    = document.getElementById('no-category-msg');
const cardWrapper = document.getElementById('card-wrapper');
const feedbackEl  = document.getElementById('swipe-feedback');
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

document.addEventListener('pointerdown', e => {
  if (!catPanel.classList.contains('open')) return;
  if (!catPanel.contains(e.target) && !btnCategory.contains(e.target)) {
    closeCategoryPanel();
  }
});

// ─── Kategorie ────────────────────────────────────────────────────────────────

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

function cancelCompletion() {
  isShowingCompletion = false;
  if (completionTimeout) {
    clearTimeout(completionTimeout);
    completionTimeout = null;
  }
  noCatMsg.classList.add('hidden');
}

function toggleCategory(cat) {
  cancelCompletion();
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
  cancelCompletion();
  activeCategories = new Set(categories);
  saveCategoriesToStorage();
  renderChips();
  showNextCard();
}

function clearCategories() {
  cancelCompletion();
  activeCategories.clear();
  saveCategoriesToStorage();
  renderChips();
  showNextCard();
}

function renderChips() {
  chipsEl.querySelectorAll('.chip').forEach(btn => {
    btn.classList.toggle('active', activeCategories.has(btn.dataset.cat));
  });
  const count = activeCategories.size;
  catBadge.textContent = count;
  catBadge.style.display = count > 0 ? '' : 'none';
}

// ─── localStorage – kategorie ─────────────────────────────────────────────────

function saveCategoriesToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...activeCategories]));
}

function loadCategoriesFromStorage() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const arr = JSON.parse(saved);
      activeCategories = new Set(arr.filter(c => categories.includes(c)));
    } catch {
      activeCategories = new Set(categories);
    }
  } else {
    activeCategories = new Set(categories);
  }
}

// ─── localStorage – postęp nauki ──────────────────────────────────────────────

function loadProgress() {
  try {
    const saved = localStorage.getItem(PROGRESS_KEY);
    if (!saved) return { easy: [], hard: [] };
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed.easy) || !Array.isArray(parsed.hard)) {
      return { easy: [], hard: [] };
    }
    // Ignoruj id, których nie ma już w aktualnym words.json
    const allIds = new Set(allWords.map(w => w.id));
    return {
      easy: parsed.easy.filter(id => allIds.has(id)),
      hard: parsed.hard.filter(id => allIds.has(id)),
    };
  } catch {
    return { easy: [], hard: [] };
  }
}

function saveProgress(progress) {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
}

function clearProgress() {
  localStorage.removeItem(PROGRESS_KEY);
}

function markEasy(wordId) {
  const progress = loadProgress();
  if (!progress.easy.includes(wordId)) {
    progress.easy.push(wordId);
  }
  // Jeśli było w hard, usuń
  progress.hard = progress.hard.filter(id => id !== wordId);
  saveProgress(progress);
}

function markHard(wordId) {
  const progress = loadProgress();
  if (!progress.hard.includes(wordId)) {
    progress.hard.push(wordId);
  }
  saveProgress(progress);
}

// ─── Wybieranie słówka ────────────────────────────────────────────────────────

function getActivePool() {
  const progress = loadProgress();
  const easyIds  = new Set(progress.easy);
  return allWords.filter(w =>
    activeCategories.has(w.category) && !easyIds.has(w.id)
  );
}

function pickRandom(pool) {
  if (pool.length === 0) return null;
  if (pool.length === 1) return pool[0];
  const candidates = pool.filter(w => w !== lastWord);
  return candidates[Math.floor(Math.random() * candidates.length)];
}

// ─── Wyświetlanie fiszki ──────────────────────────────────────────────────────

function showNextCard() {
  if (isShowingCompletion) return;

  const pool = getActivePool();

  if (pool.length === 0) {
    cardWrapper.classList.add('hidden');

    if (activeCategories.size === 0) {
      noCatMsg.textContent = 'Wybierz co najmniej jedną kategorię';
      noCatMsg.classList.remove('hidden');
    } else {
      const progress  = loadProgress();
      const easyIds   = new Set(progress.easy);
      const allDone   = allWords.every(w => easyIds.has(w.id));

      if (allDone) {
        // Wszystkie słówka z całego words.json są EASY → globalny reset
        isShowingCompletion = true;
        noCatMsg.textContent = 'All cards completed — starting a new round';
        noCatMsg.classList.remove('hidden');
        clearProgress();
        completionTimeout = setTimeout(() => {
          isShowingCompletion = false;
          completionTimeout   = null;
          noCatMsg.classList.add('hidden');
          showNextCard();
        }, 1800);
      } else {
        // Tylko aktywne kategorie ukończone – nie czyść postępu
        noCatMsg.textContent = 'All cards in selected categories completed';
        noCatMsg.classList.remove('hidden');
      }
    }
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

// ─── Feedback wizualny ────────────────────────────────────────────────────────

function showFeedback(dir, opacity) {
  if (dir === 'left') {
    feedbackEl.textContent = 'EASY';
    feedbackEl.className   = 'easy';
  } else {
    feedbackEl.textContent = 'HARD';
    feedbackEl.className   = 'hard';
  }
  feedbackEl.style.opacity = opacity;
}

function hideFeedback() {
  feedbackEl.style.opacity = 0;
}

// ─── Animacja swipe ───────────────────────────────────────────────────────────

function buildDragTransform(dx) {
  const rotate = dx * 0.07;
  return `translateX(${dx}px) rotate(${rotate}deg)`;
}

/**
 * @param {string}      dir          - 'left' (EASY) lub 'right' (HARD)
 * @param {number|null} fromDx       - bieżące przesunięcie palca (null = przycisk)
 * @param {boolean}     recordResult - czy zapisać wynik do localStorage
 */
function swipeOut(dir, fromDx = null, recordResult = true) {
  cardEl.style.pointerEvents = 'none';

  if (recordResult && currentWord) {
    if (dir === 'left') {
      markEasy(currentWord.id);
    } else {
      markHard(currentWord.id);
    }
  }

  const fromTransform = fromDx !== null ? buildDragTransform(fromDx) : 'none';
  const exitPx        = (window.innerWidth + 300) * (dir === 'left' ? -1 : 1);
  const exitRot       = dir === 'left' ? -12 : 12;
  const toTransform   = `translateX(${exitPx}px) rotate(${exitRot}deg)`;

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

    hideFeedback();
    cardWrapper.style.transform = '';
    cardWrapper.style.opacity   = '0';
    cardEl.style.pointerEvents  = '';

    showNextCard();

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

  // Feedback proporcjonalny do odległości przeciągania
  if (Math.abs(dx) > 20) {
    const opacity = Math.min(Math.abs(dx) / SWIPE_THRESHOLD, 1);
    showFeedback(dx < 0 ? 'left' : 'right', opacity);
  } else {
    hideFeedback();
  }
}

function onPointerUp(e) {
  if (!pointerStart) return;

  const dx         = (pointerCurrent?.x ?? pointerStart.x) - pointerStart.x;
  const wasGesture = isDragging;

  cardEl.classList.remove('dragging');

  if (wasGesture && Math.abs(dx) >= SWIPE_THRESHOLD) {
    // left = EASY, right = HARD
    swipeOut(dx < 0 ? 'left' : 'right', dx);
  } else if (wasGesture) {
    hideFeedback();
    cardWrapper.style.transition = 'transform 0.35s ease';
    cardWrapper.style.transform  = '';
    cardWrapper.addEventListener('transitionend', () => {
      cardWrapper.style.transition = '';
    }, { once: true });
  } else {
    flipCard();
  }

  pointerStart   = null;
  pointerCurrent = null;
  isDragging     = false;
}

function onPointerCancel() {
  cardEl.classList.remove('dragging');
  cardWrapper.style.transform = '';
  hideFeedback();
  pointerStart   = null;
  pointerCurrent = null;
  isDragging     = false;
}

// ─── Rejestracja zdarzeń ──────────────────────────────────────────────────────

cardEl.addEventListener('pointerdown',   onPointerDown);
cardEl.addEventListener('pointermove',   onPointerMove);
cardEl.addEventListener('pointerup',     onPointerUp);
cardEl.addEventListener('pointercancel', onPointerCancel);

cardEl.addEventListener('touchstart', e => e.preventDefault(), { passive: false });

btnCategory.addEventListener('click', toggleCategoryPanel);
btnFlip.addEventListener('click', flipCard);
// Next – przesuwa kartę bez zapisywania wyniku (ani EASY ani HARD)
btnNext.addEventListener('click', () => swipeOut('left', null, false));
btnAll.addEventListener('click', setAllCategories);
btnNone.addEventListener('click', clearCategories);

// ─── Start ────────────────────────────────────────────────────────────────────

loadWords();
