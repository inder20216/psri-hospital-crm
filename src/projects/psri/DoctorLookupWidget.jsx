import { useState, useEffect, useRef } from 'react';
import { psri } from '../../api/psri';
import { usePicklists } from '../../context/PicklistsContext';
import { useDependencies } from '../../context/DependenciesContext';
import './Psri.css';

// A plain <select> — closed until clicked, same as any other dropdown — so an
// agent can pick an exact name instead of free-typing one and risking a typo
// that silently falls through to a fuzzy/no match. Picking a value just feeds
// the same `query` state manual typing does, so results render identically
// either way. Always shown with the placeholder selected (not bound to
// `query`) so it works as a repeatable "jump to…" control rather than a
// second, harder-to-keep-in-sync copy of the text input's value.
function PickFromListSelect({ label, options, onPick }) {
  if (!options.length) return null;
  return (
    <select
      className="psri-search-input"
      style={{ maxWidth: 'none', width: '100%', marginTop: 6 }}
      value=""
      onChange={e => { if (e.target.value) onPick(e.target.value); }}
    >
      <option value="">{label}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function DoctorSearchTab() {
  // Doctor names mostly live as Specialty→Doctor dependency pairs (Admin >
  // Dependencies), not a flat "Doctor" picklist — combine both sources so
  // the dropdown works however the admin happened to enter the data.
  const { getList } = usePicklists();
  const { getAllSubValues } = useDependencies();
  const doctorOptions = [...new Set([...getAllSubValues('Doctor'), ...getList('Doctor')])].sort((a, b) => a.localeCompare(b));
  const [query, setQuery]         = useState('');
  const [results, setResults]     = useState([]);
  const [fuzzyMatch, setFuzzyMatch] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState('');
  const [activeDoctor, setActiveDoctor] = useState(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); setFuzzyMatch(false); setSearchErr(''); return; }
    debounceRef.current = setTimeout(() => {
      setSearching(true);
      setSearchErr('');
      psri.searchDoctors(query.trim(), 'doctor')
        .then(res => { setResults(res.results || []); setFuzzyMatch(!!res.fuzzyMatch); })
        .catch(() => setSearchErr('Could not search doctors. Please try again.'))
        .finally(() => setSearching(false));
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  return (
    <div>
      <input
        className="psri-search-input"
        style={{ maxWidth: 'none', width: '100%' }}
        type="text"
        placeholder="Search doctor name…"
        value={query}
        onChange={e => { setQuery(e.target.value); setActiveDoctor(null); }}
      />
      <PickFromListSelect
        label="— Or pick a doctor from the list —"
        options={doctorOptions}
        onPick={name => { setQuery(name); setActiveDoctor(null); }}
      />
      {searching && <p className="cp-hint">Searching…</p>}
      {searchErr && <p className="psri-err-msg">{searchErr}</p>}
      {!searching && !activeDoctor && query.trim() && results.length === 0 && !searchErr && (
        <p className="cp-hint">No matches found.</p>
      )}
      {!activeDoctor && fuzzyMatch && results.length > 0 && (
        <p className="cp-hint">No exact match for "{query.trim()}" — showing closest matches:</p>
      )}
      {!activeDoctor && results.length > 0 && (
        <div className="psri-side-results">
          {results.map((r, i) => (
            <div key={i} className="psri-side-result-item" onClick={() => setActiveDoctor(r)}>
              <strong>{r.doctorName || '(unnamed)'}</strong>
              <span>{r.specialty}</span>
            </div>
          ))}
        </div>
      )}
      {activeDoctor && (
        <div className="psri-side-detail">
          <button type="button" className="psri-btn-ghost" onClick={() => setActiveDoctor(null)} style={{ marginBottom: 8 }}>← Back to results</button>
          <div className="psri-side-detail-name">{activeDoctor.doctorName}</div>
          <div className="psri-badge">{activeDoctor.specialty}</div>
          {Object.entries(activeDoctor)
            .filter(([k, v]) => !['doctorName', 'specialty'].includes(k) && v)
            .map(([k, v]) => (
              <div key={k} className="psri-side-detail-row"><span>{k}</span><strong>{String(v)}</strong></div>
            ))}
        </div>
      )}
    </div>
  );
}

function SpecialtySearchTab() {
  const { getList } = usePicklists();
  const specialtyOptions = getList('Specialty');
  const [query, setQuery]     = useState('');
  const [result, setResult]   = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState('');
  const [lang, setLang]       = useState('en');
  const [activeDoctor, setActiveDoctor] = useState(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!query.trim()) { setResult(null); setSearchErr(''); return; }
    debounceRef.current = setTimeout(() => {
      setSearching(true);
      setSearchErr('');
      psri.searchSpecialty(query.trim())
        .then(res => setResult(res))
        .catch(() => setSearchErr('Could not search specialty. Please try again.'))
        .finally(() => setSearching(false));
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  return (
    <div>
      <input
        className="psri-search-input"
        style={{ maxWidth: 'none', width: '100%' }}
        type="text"
        placeholder="Search specialty…"
        value={query}
        onChange={e => { setQuery(e.target.value); setActiveDoctor(null); }}
      />
      <PickFromListSelect
        label="— Or pick a specialty from the list —"
        options={specialtyOptions}
        onPick={name => { setQuery(name); setActiveDoctor(null); }}
      />
      {searching && <p className="cp-hint">Searching…</p>}
      {searchErr && <p className="psri-err-msg">{searchErr}</p>}
      {!searching && !result && query.trim() && !searchErr && (
        <p className="cp-hint">No matches found.</p>
      )}

      {result && !activeDoctor && (
        <>
          {result.fuzzyMatch && (
            <p className="cp-hint">No exact match for "{query.trim()}" — showing closest specialty:</p>
          )}
          {(result.groups || []).length > 1 && (
            <p className="cp-hint">"{query.trim()}" matches {result.groups.length} specialties:</p>
          )}
          {(result.groups || []).map((g, gi) => (
            <div className="psri-specialty-group" key={gi}>
              <div className="psri-specialty-group-title">{g.specialty}</div>
              {(g.summaryEn || g.summaryHi) && (
                <>
                  <div className="psri-lang-toggle">
                    <button type="button" className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>English</button>
                    <button type="button" className={lang === 'hi' ? 'active' : ''} onClick={() => setLang('hi')}>हिन्दी</button>
                  </div>
                  <p className="psri-specialty-info-text">{String(lang === 'en' ? (g.summaryEn || '') : (g.summaryHi || '')) || 'No AI summary available yet.'}</p>
                </>
              )}
              <div className="psri-side-results">
                {(g.doctors || []).length === 0 && <p className="cp-hint">No doctors currently listed for this specialty.</p>}
                {(g.doctors || []).map((r, i) => (
                  <div key={i} className="psri-side-result-item" onClick={() => setActiveDoctor(r)}>
                    <strong>{r.doctorName || '(unnamed)'}</strong>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {activeDoctor && (
        <div className="psri-side-detail">
          <button type="button" className="psri-btn-ghost" onClick={() => setActiveDoctor(null)} style={{ marginBottom: 8 }}>← Back to results</button>
          <div className="psri-side-detail-name">{activeDoctor.doctorName}</div>
          <div className="psri-badge">{activeDoctor.specialty}</div>
          {Object.entries(activeDoctor)
            .filter(([k, v]) => !['doctorName', 'specialty'].includes(k) && v)
            .map(([k, v]) => (
              <div key={k} className="psri-side-detail-row"><span>{k}</span><strong>{String(v)}</strong></div>
            ))}
        </div>
      )}
    </div>
  );
}

export function DoctorSpecialtyPanel() {
  const [tab, setTab] = useState('doctor');
  return (
    <div className="psri-side-card">
      <div className="psri-side-card-title">Doctor &amp; Specialty Lookup</div>
      <div className="psri-lang-toggle" style={{ marginBottom: 10 }}>
        <button type="button" className={tab === 'doctor' ? 'active' : ''} onClick={() => setTab('doctor')}>By Doctor</button>
        <button type="button" className={tab === 'specialty' ? 'active' : ''} onClick={() => setTab('specialty')}>By Specialty</button>
      </div>
      {tab === 'doctor' ? <DoctorSearchTab /> : <SpecialtySearchTab />}
    </div>
  );
}

export default function DoctorLookupWidget() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className={`dr-lookup-toggle-btn${open ? ' active' : ''}`}
        onClick={() => setOpen(o => !o)}
        title="Doctor & Specialty Lookup"
      >
        👨‍⚕️
      </button>

      {open && (
        <div className="dr-lookup-panel">
          <div className="dr-lookup-header">
            <span className="dr-lookup-header-title">👨‍⚕️ Doctor &amp; Specialty Lookup</span>
            <button className="dr-lookup-close-btn" onClick={() => setOpen(false)}>✕</button>
          </div>
          <div className="dr-lookup-body">
            <DoctorLookupBody />
          </div>
        </div>
      )}
    </>
  );
}

function DoctorLookupBody() {
  const [tab, setTab] = useState('doctor');
  return (
    <>
      <div className="psri-lang-toggle" style={{ marginBottom: 12 }}>
        <button type="button" className={tab === 'doctor' ? 'active' : ''} onClick={() => setTab('doctor')}>By Doctor</button>
        <button type="button" className={tab === 'specialty' ? 'active' : ''} onClick={() => setTab('specialty')}>By Specialty</button>
      </div>
      {tab === 'doctor' ? <DoctorSearchTab /> : <SpecialtySearchTab />}
    </>
  );
}
