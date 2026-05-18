import { React, ReactDOM, html, lucide } from './deps.js';
import { NAMES } from './names.js';

const { useState, useEffect, useMemo, useCallback, useRef } = React;
const { Baby, Download, Heart, Import, RotateCcw, Search, Sparkles, Trophy, Upload } = lucide;

const STORAGE_KEY = 'baby-name-tinder:v1';
const ACTIONS = {
  no: { label: 'Nein', score: 0, emoji: '👎', key: '1' },
  like: { label: 'Like', score: 1, emoji: '💛', key: '2' },
  super: { label: 'Super Like', score: 2, emoji: '💖', key: '3' },
  duper: { label: 'Perfekt', score: 3, emoji: '✨', key: '4' },
};

const defaultState = {
  userName: 'Ich',
  filter: 'all',
  sessionGoal: 25,
  ratings: {},
  preferences: { origin: {}, style: {}, length: {}, rarity: {}, gender: {} },
  createdAt: new Date().toISOString(),
  lastActiveAt: null,
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...defaultState, ...JSON.parse(raw) } : defaultState;
  } catch { return defaultState; }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function bump(obj, key, delta) {
  return { ...obj, [key]: (obj[key] || 0) + delta };
}

function updatePreferences(preferences, name, score) {
  const delta = score === 0 ? -0.2 : score;
  let next = structuredClone(preferences);
  name.origin.forEach((x) => (next.origin = bump(next.origin, x, delta)));
  name.style.forEach((x) => (next.style = bump(next.style, x, delta)));
  next.length = bump(next.length, name.length, delta);
  next.rarity = bump(next.rarity, name.rarity, delta);
  next.gender = bump(next.gender, name.gender, delta);
  return next;
}

function scoreName(name, preferences) {
  const originScore = name.origin.reduce((sum, x) => sum + (preferences.origin[x] || 0), 0);
  const styleScore = name.style.reduce((sum, x) => sum + (preferences.style[x] || 0), 0);
  const lengthScore = preferences.length[name.length] || 0;
  const rarityScore = preferences.rarity[name.rarity] || 0;
  return Math.random() * 1.8 + originScore * 0.35 + styleScore * 0.45 + lengthScore * 0.25 + rarityScore * 0.15;
}

function googleUrl(name) {
  return `https://www.google.com/search?q=${encodeURIComponent(`Bedeutung Vorname ${name}`)}`;
}

function chatGptUrl(name) {
  return `https://chat.openai.com/?q=${encodeURIComponent(`Was bedeutet der Vorname ${name}, woher kommt er und wie wirkt er im deutschsprachigen Raum?`)}`;
}

function getGenderLabel(gender) {
  return gender === 'female' ? '👧 Mädchen' : gender === 'male' ? '👦 Junge' : '✨ Unisex';
}

function getActionByScore(score) {
  return Object.values(ACTIONS).find((a) => a.score === score) || ACTIONS.no;
}

function App() {
  const [state, setState] = useState(loadState);
  const [tab, setTab] = useState('swipe');
  const [partnerData, setPartnerData] = useState(null);
  const [toast, setToast] = useState('');
  const [cardKey, setCardKey] = useState(0);
  const fileInputRef = useRef(null);

  useEffect(() => saveState(state), [state]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const filteredNames = useMemo(() => {
    return NAMES.filter((n) => state.filter === 'all' || n.gender === state.filter);
  }, [state.filter]);

  const deck = useMemo(() => {
    return filteredNames
      .filter((n) => state.ratings[n.id] === undefined)
      .map((n) => ({ ...n, displayScore: scoreName(n, state.preferences) }))
      .sort((a, b) => b.displayScore - a.displayScore);
  }, [state.ratings, state.preferences, filteredNames]);

  const currentName = deck[0];
  const total = filteredNames.length;
  const ratedCount = total - deck.length;
  const likedNames = NAMES.filter((n) => state.ratings[n.id] > 0).sort((a, b) => state.ratings[b.id] - state.ratings[a.id]);
  const sessionProgress = Math.min(100, Math.round(((ratedCount % state.sessionGoal) / state.sessionGoal) * 100));
  const nextMilestone = [25, 50, 100, 250, 500].find((x) => ratedCount < x) || 1000;

  const rateCurrent = useCallback((score) => {
    if (!currentName) return;
    setState((prev) => ({
      ...prev,
      ratings: { ...prev.ratings, [currentName.id]: score },
      preferences: updatePreferences(prev.preferences, currentName, score),
      lastActiveAt: new Date().toISOString(),
    }));
    setCardKey((k) => k + 1);
    if ([25, 50, 100, 250, 500].includes(ratedCount + 1)) {
      setToast(`🎉 Meilenstein: ${ratedCount + 1} Namen bewertet!`);
    }
  }, [currentName, ratedCount]);

  useEffect(() => {
    if (tab !== 'swipe') return;
    function handleKey(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      switch (e.key) {
        case '1': case 'ArrowLeft': rateCurrent(0); break;
        case '2': case 'ArrowDown': rateCurrent(1); break;
        case '3': case 'ArrowUp': rateCurrent(2); break;
        case '4': case 'ArrowRight': rateCurrent(3); break;
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [tab, rateCurrent]);

  function exportJson() {
    const payload = {
      appVersion: '1.0',
      userName: state.userName || 'Person A',
      createdAt: new Date().toISOString(),
      ratings: state.ratings,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `baby-namen-${payload.userName.toLowerCase().replaceAll(' ', '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importJson(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data.ratings) throw new Error('Keine Ratings gefunden');
        setPartnerData(data);
        setTab('match');
        setToast(`✅ Partner-Datei importiert: ${data.userName || 'Partner'}`);
      } catch { setToast('❌ JSON konnte nicht gelesen werden.'); }
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  function resetAll() {
    const ok = window.confirm('Wirklich alle lokalen Bewertungen löschen? Das kann nicht rückgängig gemacht werden.');
    if (!ok) return;
    setState({ ...defaultState, createdAt: new Date().toISOString() });
    setPartnerData(null);
    setToast('🗑️ Alles zurückgesetzt.');
  }

  return html`
    <main className="app">
      <header className="topbar">
        <div className="brand">
          <${Baby} size=${24} strokeWidth=${2.5} />
          <span>Baby Name Tinder</span>
        </div>
        <button className="ghost" onClick=${resetAll} title="Alle Bewertungen zurücksetzen" aria-label="Zurücksetzen">
          <${RotateCcw} size=${18} />
        </button>
      </header>

      <nav className="tabs" role="tablist" aria-label="Hauptnavigation">
        <button role="tab" aria-selected=${tab === 'swipe'} className=${tab === 'swipe' ? 'active' : ''} onClick=${() => setTab('swipe')}>
          Swipen
        </button>
        <button role="tab" aria-selected=${tab === 'favorites'} className=${tab === 'favorites' ? 'active' : ''} onClick=${() => setTab('favorites')}>
          Favoriten
        </button>
        <button role="tab" aria-selected=${tab === 'match'} className=${tab === 'match' ? 'active' : ''} onClick=${() => setTab('match')}>
          Matching
        </button>
      </nav>

      ${tab === 'swipe' && html`
        <section className="screen" role="tabpanel" aria-label="Swipen">
          <div className="settings-card">
            <label htmlFor="user-name">Dein Name</label>
            <input
              id="user-name"
              value=${state.userName}
              onChange=${(e) => setState({ ...state, userName: e.target.value })}
              placeholder="z. B. Marlon"
            />
            <label htmlFor="name-filter">Namensfilter</label>
            <select id="name-filter" value=${state.filter} onChange=${(e) => setState({ ...state, filter: e.target.value })}>
              <option value="all">Alle Namen</option>
              <option value="female">Mädchen</option>
              <option value="male">Jungen</option>
              <option value="unisex">Unisex</option>
            </select>
            <label htmlFor="session-goal">Session-Ziel</label>
            <select id="session-goal" value=${state.sessionGoal} onChange=${(e) => setState({ ...state, sessionGoal: Number(e.target.value) })}>
              <option value=${10}>10 Namen</option>
              <option value=${25}>25 Namen</option>
              <option value=${50}>50 Namen</option>
            </select>
          </div>

          <${Progress} ratedCount=${ratedCount} total=${total} sessionProgress=${sessionProgress} nextMilestone=${nextMilestone} />

          ${currentName ? html`<${NameCard} key=${cardKey} name=${currentName} />` : html`<${EmptyDeck} />`}

          <div className="action-grid" role="group" aria-label="Bewertungsoptionen">
            <button className="no" onClick=${() => rateCurrent(0)} aria-label="Nein – Name ablehnen">
              ${ACTIONS.no.emoji}<span>Nein</span>
            </button>
            <button className="like" onClick=${() => rateCurrent(1)} aria-label="Like – Name merken">
              ${ACTIONS.like.emoji}<span>Like</span>
            </button>
            <button className="super" onClick=${() => rateCurrent(2)} aria-label="Super Like">
              ${ACTIONS.super.emoji}<span>Super</span>
            </button>
            <button className="duper" onClick=${() => rateCurrent(3)} aria-label="Perfekt – Lieblingsname">
              ${ACTIONS.duper.emoji}<span>Perfekt</span>
            </button>
          </div>

          <div className="keyboard-hint" aria-hidden="true">
            <span><kbd>1</kbd>Nein</span>
            <span><kbd>2</kbd>Like</span>
            <span><kbd>3</kbd>Super</span>
            <span><kbd>4</kbd>Perfekt</span>
          </div>
        </section>
      `}

      ${tab === 'favorites' && html`
        <section className="screen" role="tabpanel" aria-label="Favoriten">
          <${Stats} state=${state} total=${total} />
          <div className="toolbar">
            <button onClick=${exportJson} aria-label="Bewertungen als JSON exportieren">
              <${Download} size=${18} /> Exportieren
            </button>
            <button onClick=${() => fileInputRef.current.click()} aria-label="Partner-JSON importieren">
              <${Upload} size=${18} /> Importieren
            </button>
            <input hidden type="file" accept="application/json" ref=${fileInputRef} onChange=${importJson} aria-hidden="true" />
          </div>
          <h2>Deine Favoriten (${likedNames.length})</h2>
          <${NameList} names=${likedNames} ratings=${state.ratings} />
        </section>
      `}

      ${tab === 'match' && html`
        <section className="screen" role="tabpanel" aria-label="Matching">
          ${!partnerData ? html`
            <div className="empty-state">
              <${Import} size=${38} strokeWidth=${1.5} />
              <h2>Partner-Datei importieren</h2>
              <p>Exportiere zuerst deine Bewertungen und importiere dann die JSON-Datei deines Partners, um gemeinsame Favoriten zu finden.</p>
              <button onClick=${() => fileInputRef.current.click()}>
                <${Upload} size=${18} /> JSON importieren
              </button>
              <input hidden type="file" accept="application/json" ref=${fileInputRef} onChange=${importJson} aria-hidden="true" />
            </div>
          ` : html`<${Matching} own=${state} partner=${partnerData} />`}
        </section>
      `}

      ${toast && html`<div className="toast" role="status" aria-live="polite">${toast}</div>`}
    </main>
  `;
}

function Progress({ ratedCount, total, sessionProgress, nextMilestone }) {
  const percent = Math.round((ratedCount / total) * 100);
  return html`
    <div className="progress-card" role="region" aria-label="Fortschritt">
      <div className="progress-top">
        <span>${ratedCount} von ${total} geschafft</span>
        <strong>Noch ${Math.max(0, nextMilestone - ratedCount)} bis ${nextMilestone}</strong>
      </div>
      <div className="bar" role="progressbar" aria-valuenow=${percent} aria-valuemin=${0} aria-valuemax=${100}>
        <span style=${{ width: `${percent}%` }} />
      </div>
      <div className="session-row">
        <${Trophy} size=${17} />
        <span>Session-Fortschritt: ${sessionProgress}%</span>
      </div>
    </div>
  `;
}

function NameCard({ name }) {
  return html`
    <article className="name-card" aria-label=${`Name: ${name.name}`}>
      <div className="pill">${getGenderLabel(name.gender)}</div>
      <h1>${name.name}</h1>
      <p>${name.origin.join(' · ')}</p>
      <div className="tags" aria-label="Eigenschaften">
        ${[...name.style.slice(0, 4), name.rarity, name.length].map((x) => html`<span key=${x}>${x}</span>`)}
      </div>
      <div className="external-links">
        <a href=${googleUrl(name.name)} target="_blank" rel="noreferrer" aria-label=${`${name.name} bei Google suchen`}>
          <${Search} size=${16} /> Google
        </a>
        <a href=${chatGptUrl(name.name)} target="_blank" rel="noreferrer" aria-label=${`${name.name} bei ChatGPT nachfragen`}>
          <${Sparkles} size=${16} /> ChatGPT
        </a>
      </div>
    </article>
  `;
}

function EmptyDeck() {
  return html`
    <div className="empty-state">
      <${Heart} size=${44} strokeWidth=${1.5} />
      <h2>Alle Namen bewertet 🎉</h2>
      <p>Super gemacht! Exportiere jetzt deine Datei und vergleiche sie mit deinem Partner.</p>
    </div>
  `;
}

function Stats({ state, total }) {
  const scores = Object.values(state.ratings);
  return html`
    <div className="stats-grid" role="region" aria-label="Statistiken">
      <div><strong>${scores.length}</strong><span>bewertet</span></div>
      <div><strong>${scores.filter((x) => x > 0).length}</strong><span>Likes</span></div>
      <div><strong>${scores.filter((x) => x === 3).length}</strong><span>Perfekt</span></div>
      <div><strong>${total - scores.length}</strong><span>offen</span></div>
    </div>
  `;
}

function NameList({ names, ratings }) {
  if (!names.length) return html`<p className="muted">Noch keine Favoriten. Swipe los!</p>`;
  return html`
    <div className="list" role="list">
      ${names.map((n) => html`
        <div className="list-item" key=${n.id} role="listitem">
          <div>
            <strong>${n.name}</strong>
            <span>${n.origin.join(' · ')}</span>
          </div>
          <b>${getActionByScore(ratings[n.id]).emoji} ${ratings[n.id]}/3</b>
        </div>
      `)}
    </div>
  `;
}

function Matching({ own, partner }) {
  const rows = NAMES.map((n) => {
    const a = own.ratings[n.id];
    const b = partner.ratings?.[n.id];
    return { ...n, a: a ?? null, b: b ?? null, matchScore: (a || 0) + (b || 0) };
  });
  const matches = rows
    .filter((r) => r.a > 0 && r.b > 0)
    .sort((x, y) => y.matchScore - x.matchScore || Math.min(y.a, y.b) - Math.min(x.a, x.b));
  const perfect = matches.filter((r) => r.a === 3 && r.b === 3);
  const oneSided = rows
    .filter((r) => (r.a === 3 && (!r.b || r.b === 0)) || (r.b === 3 && (!r.a || r.a === 0)))
    .sort((x, y) => y.matchScore - x.matchScore);

  return html`
    <${React.Fragment}>
      <div className="match-hero">
        <h2>${own.userName || 'Ich'} × ${partner.userName || 'Partner'}</h2>
        <p>${matches.length} gemeinsame Likes · ${perfect.length} perfekte Matches</p>
      </div>
      <div className="stats-grid">
        <div><strong>${matches.length}</strong><span>Matches</span></div>
        <div><strong>${perfect.length}</strong><span>perfekt</span></div>
        <div><strong>${matches[0]?.matchScore || 0}</strong><span>Top Score</span></div>
        <div><strong>${oneSided.length}</strong><span>einseitig</span></div>
      </div>
      ${matches.length > 0 && html`
        <${React.Fragment}>
          <h2>🏆 Top Matches</h2>
          <div className="match-list" role="list">
            ${matches.slice(0, 30).map((r) => html`<${MatchRow} key=${r.id} row=${r} />`)}
          </div>
        <//>
      `}
      ${!matches.length && html`<p className="muted">Noch keine gemeinsamen Likes gefunden.</p>`}
      ${oneSided.length > 0 && html`
        <${React.Fragment}>
          <h2>💔 Einseitige Super-Favoriten</h2>
          <div className="match-list" role="list">
            ${oneSided.slice(0, 20).map((r) => html`<${MatchRow} key=${r.id} row=${r} />`)}
          </div>
        <//>
      `}
    <//>
  `;
}

function MatchRow({ row }) {
  return html`
    <div className="match-row" role="listitem">
      <div>
        <strong>${row.name}</strong>
        <span>${row.origin.join(' · ')}</span>
      </div>
      <div className="score-pair">
        <span>${row.a ?? '-'}/3</span>
        <span>${row.b ?? '-'}/3</span>
        <b>${row.matchScore}</b>
      </div>
    </div>
  `;
}

ReactDOM.createRoot(document.getElementById('root')).render(html`<${App} />`);
