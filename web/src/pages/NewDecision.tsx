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
import {
  buttonGhost,
  buttonPrimary,
  buttonSecondarySmall,
  card,
  chipOff,
  chipOn,
  dateInput,
  field,
  hint,
  input,
  mutedText,
  textarea,
} from '../components/ui';
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
      console.error(nextError);
      setError('Could not save this decision. Try again.');
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">New decision</h1>
        <p className={mutedText}>Write it down while it is fresh. Two minutes is enough.</p>
      </header>

      <form className={`${card} grid gap-5 p-6`} onSubmit={submit}>
        <label className={field}>
          Title
          <input
            type="text"
            className={input}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="One line naming the decision"
            autoFocus
            required
          />
        </label>

        <div className="grid gap-2">
          <span className="text-sm font-medium">Options considered</span>
          {options.map((option, index) => (
            <div className="flex items-center gap-2" key={index}>
              <input
                type="text"
                className={`${input} flex-1`}
                value={option}
                onChange={(event) => setOption(index, event.target.value)}
                placeholder={`Option ${index + 1}`}
              />
              <button
                type="button"
                className={buttonSecondarySmall}
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
            className={`${buttonGhost} justify-start px-2`}
            onClick={() => setOptions((current) => [...current, ''])}
          >
            + Add option
          </button>
        </div>

        <label className={field}>
          Reasoning
          <span className={hint}>Two or three sentences on why this option was chosen.</span>
          <textarea
            className={textarea}
            value={reasoning}
            onChange={(event) => setReasoning(event.target.value)}
          />
        </label>

        <label className={field}>
          Prediction
          <span className={hint}>One line on what you expect to happen.</span>
          <input
            type="text"
            className={input}
            value={prediction}
            onChange={(event) => setPrediction(event.target.value)}
            required
          />
        </label>

        <label className={field}>
          Confidence: {confidence}%
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={confidence}
            onChange={(event) => setConfidence(Number(event.target.value))}
            className="w-full accent-accent"
          />
        </label>

        <div className="grid gap-2">
          <span className="text-sm font-medium">State</span>
          <div className="flex flex-wrap gap-2">
            {STATES.map((value) => (
              <button
                key={value}
                type="button"
                className={state === value ? chipOn : chipOff}
                onClick={() => setState(value)}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-2">
          <span className="text-sm font-medium">Tags</span>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_TAGS.map((value) => (
              <button
                key={value}
                type="button"
                className={tags.includes(value) ? chipOn : chipOff}
                onClick={() => toggleTag(value)}
              >
                {value}
              </button>
            ))}
          </div>
          <input
            type="text"
            className={input}
            value={extraTags}
            onChange={(event) => setExtraTags(event.target.value)}
            placeholder="Other tags, comma separated"
          />
        </div>

        <div className="grid gap-2">
          <span className="text-sm font-medium">Review date</span>
          <div className="flex flex-wrap items-center gap-2">
            {QUICK_DAYS.map(([days, label]) => (
              <button
                key={days}
                type="button"
                className={chipOff}
                onClick={() => setReviewDate(dateInputValue(inDays(days)))}
              >
                {label}
              </button>
            ))}
            <input
              type="date"
              className={dateInput}
              value={reviewDate}
              onChange={(event) => setReviewDate(event.target.value)}
              required
            />
          </div>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-2 border-t border-line pt-5">
          <button type="button" className={buttonGhost} onClick={() => navigate(-1)} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className={buttonPrimary} disabled={busy}>
            {busy ? 'Saving…' : 'Save decision'}
          </button>
        </div>
      </form>
    </div>
  );
}
