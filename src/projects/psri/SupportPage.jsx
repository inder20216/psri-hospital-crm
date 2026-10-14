import { useState } from 'react';
import { TUTORIAL } from './supportContent';
import SupportBot from './SupportBot';

/**
 * One job open at a time: each row is a dropdown that expands to show the steps.
 * Opening another collapses the first, so the page never shows every guide at
 * once. The first job starts open so the page never looks empty.
 *
 * The guide text lives in supportContent.js, which the assistant above also
 * answers from — so the bot and the page can never disagree.
 */
export default function SupportPage() {
  const [openKey, setOpenKey] = useState(TUTORIAL[0].key);
  const toggle = (key) => setOpenKey(cur => (cur === key ? '' : key));

  return (
    <div className="psri-page">
      <div className="psri-page-head">
        <div>
          <h1 className="psri-title">Support</h1>
          <p className="psri-subtitle">
            Ask the assistant, or open the guide you need.
          </p>
        </div>
      </div>

      <SupportBot openKey={openKey} onOpenTopic={setOpenKey} />

      <div className="psri-tut-list">
        {TUTORIAL.map((t, i) => {
          const isOpen = openKey === t.key;
          return (
            <section key={t.key} className={`psri-tut${isOpen ? ' open' : ''}`}>
              <button
                type="button"
                className="psri-tut-row"
                onClick={() => toggle(t.key)}
                aria-expanded={isOpen}
                aria-controls={`tut-body-${t.key}`}
              >
                <span className="psri-tut-chip-n">{i + 1}</span>
                <span className="psri-tut-icon">{t.icon}</span>
                <span className="psri-tut-label">{t.label}</span>
                <span className="psri-tut-who">{t.who}</span>
                <span className="psri-tut-caret" aria-hidden="true">▾</span>
              </button>

              {isOpen && (
                <div className="psri-tut-body" id={`tut-body-${t.key}`}>
                  {t.summary && <p className="psri-tut-what">{t.summary}</p>}
                  <ol className="psri-tut-steps">
                    {t.steps.map((s, n) => (
                      // Index is the identity here — the steps are static content.
                      <li key={n}>
                        <span className="psri-tut-n">{n + 1}</span>
                        <span className="psri-tut-step">{bold(s)}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

// Steps are written with **bold** for button and field names. Only that marker
// is turned into markup and the text is rendered as text, so a step can never
// inject HTML.
function bold(text) {
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => (
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : <span key={i}>{part}</span>
  ));
}