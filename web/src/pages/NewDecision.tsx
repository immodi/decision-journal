import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDecisions } from '../hooks/useDecisions';
import { useSettings } from '../hooks/useSettings';
import {
  dateFromInput,
  dateInputValue,
  inDays,
  QUICK_DAYS,
  SUGGESTED_TAGS,
  STATES,
} from '../lib/decisions';
import type { DecisionState } from '../types';

export default function NewDecision() {
  const navigate = useNavigate();
  const { create } = useDecisions();
  const { settings } = useSettings();

  const [title, setTitle] = useState('');
  const [options, setOptions] = useState<string[]>(['']);
  const [reasoning, setReasoning] = useState('');
  const [prediction, setPrediction] = useState('');
  const [confidence, setConfidence] = useState(70);
  const [state, setState] = useState<DecisionState>('calm');
  const [tags, setTags] = useState<string[]>([]);
  const [extraTags, setExtraTags] = useState('');
  const [reviewDate, setReviewDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The default review date follows the saved setting, unless already chosen.
  useEffect(() => {
    if (!reviewDate) {
      setReviewDate(dateInputValue(inDays(settings.defaultReviewDays)));
    }
  }, [settings.defaultReviewDays, reviewDate]);

  const toggleTag = (tag: string): void => {
    setTags((current) => (
      current.includes(tag) ? current.filter((value) => value !== tag) : [...current, tag]
    ));
  };

  const setOption = (index: number, value: string): void => {
    setOptions((current) => current.map((entry, position) => (
      position === index ? value : entry
    )));
  };

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const cleanTitle = title.trim();
    const cleanPrediction = prediction.trim();
    const parsedReviewDate = dateFromInput(reviewDate);

    if (!cleanTitle || !cleanPrediction || !parsedReviewDate) {
      setError('Title, prediction and review date are required.');
      return;
    }

    const extra = extraTags
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);

    setBusy(true);
    setError(null);
    try {
      const created = await create({
        title: cleanTitle,
        options: options.map((value) => value.trim()).filter(Boolean),
        reasoning: reasoning.trim(),
        prediction: cleanPrediction,
        confidence,
        state,
        tags: [...new Set([...tags, ...extra])],
        reviewDate: parsedReviewDate,
      });
      navigate(`/decisions/${created.id}`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
      setBusy(false);
    }
  }

  return (
    <>
      <h1>New decision</h1>
      <form className="stack" onSubmit={submit}>
        <label className="field">
          Title
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="One line naming the decision"
            autoFocus
            required
          />
        </label>

        <div className="field">
          <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Options considered</span>
          {options.map((option, index) => (
            <div className="row" key={index} style={{ marginTop: '0.35rem' }}>
              <input
                type="text"
                className="grow"
                value={option}
                onChange={(event) => setOption(index, event.target.value)}
                placeholder={`Option ${index + 1}`}
              />
              <button
                type="button"
                className="button"
                onClick={() => setOptions((current) => current.filter((_, position) => position !== index))}
                disabled={options.length === 1}
                aria-label="Remove option"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            className="button plain"
            onClick={() => setOptions((current) => [...current, ''])}
          >
            + Add option
          </button>
        </div>

        <label className="field">
          Reasoning
          <span className="hint">Two or three sentences on why this option was chosen.</span>
          <textarea
            value={reasoning}
            onChange={(event) => setReasoning(event.target.value)}
          />
        </label>

        <label className="field">
          Prediction
          <span className="hint">One line on what you expect to happen.</span>
          <input
            type="text"
            value={prediction}
            onChange={(event) => setPrediction(event.target.value)}
            required
          />
        </label>

        <label className="field">
          Confidence: {confidence}%
          <span className="range-row">
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={confidence}
              onChange={(event) => setConfidence(Number(event.target.value))}
            />
          </span>
        </label>

        <div className="field">
          <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>State</span>
          <div className="chips" style={{ marginTop: '0.35rem' }}>
            {STATES.map((value) => (
              <button
                key={value}
                type="button"
                className={`chip ${state === value ? 'selected' : ''}`}
                onClick={() => setState(value)}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Tags</span>
          <div className="chips" style={{ marginTop: '0.35rem' }}>
            {SUGGESTED_TAGS.map((value) => (
              <button
                key={value}
                type="button"
                className={`chip ${tags.includes(value) ? 'selected' : ''}`}
                onClick={() => toggleTag(value)}
              >
                {value}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={extraTags}
            onChange={(event) => setExtraTags(event.target.value)}
            placeholder="Other tags, comma separated"
            style={{ marginTop: '0.4rem' }}
          />
        </div>

        <div className="field">
          <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Review date</span>
          <div className="row wrap" style={{ marginTop: '0.35rem' }}>
            {QUICK_DAYS.map(([days, label]) => (
              <button
                key={days}
                type="button"
                className="chip"
                onClick={() => setReviewDate(dateInputValue(inDays(days)))}
              >
                {label}
              </button>
            ))}
            <input
              type="date"
              value={reviewDate}
              onChange={(event) => setReviewDate(event.target.value)}
              style={{ width: 'auto' }}
              required
            />
          </div>
        </div>

        {error && <p className="error">{error}</p>}

        <div className="actions end">
          <button type="button" className="button" onClick={() => navigate(-1)} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="button primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save decision'}
          </button>
        </div>
      </form>
    </>
  );
}
