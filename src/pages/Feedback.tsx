import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, MessageSquare, Moon, Send, Star, Sun } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const KEY = 'academicvault_feedback_v1';

export default function Feedback() {
  const [rating, setRating] = useState(5);
  const [category, setCategory] = useState('UI/UX');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = 'Feedback · AcademicVault';
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) return;

    setSaving(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const payload: Record<string, any> = {
        rating,
        category,
        message: trimmed,
        created_at: new Date().toISOString(),
      };

      if (user?.id) payload.user_id = user.id;

      const { error: insertError } = await supabase.from('feedback').insert(payload);

      if (insertError) {
        if (!user?.id && insertError.message.toLowerCase().includes('not authenticated')) {
          const current = JSON.parse(localStorage.getItem(KEY) || '[]');
          current.unshift({
            id: crypto.randomUUID(),
            rating,
            category,
            message: trimmed,
            created_at: new Date().toISOString(),
          });
          localStorage.setItem(KEY, JSON.stringify(current.slice(0, 100)));
          setMessage('');
          setSent(true);
          window.setTimeout(() => setSent(false), 3500);
          return;
        }
        throw insertError;
      }

      setMessage('');
      setSent(true);
      window.setTimeout(() => setSent(false), 3500);
    } catch (err: any) {
      setError(err?.message || 'Could not save your feedback.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="feedback-page">
      <div className="feedback-orb orb-one" />
      <div className="feedback-orb orb-two" />

      <header className="feedback-header">
        <Link to="/dashboard" className="back-link">
          <ArrowLeft size={18} /> Dashboard
        </Link>
        <div className="feedback-brand">Academic<span>Vault</span></div>
        <div className="feedback-header-icon"><MessageSquare size={18} /></div>
      </header>

      <main className="feedback-content">
        <section className="feedback-hero-card">
          <div className="feedback-illustration">
            <div className="feedback-bubble"><MessageSquare size={30} /></div>
            <Star className="feedback-star star-a" size={24} fill="currentColor" />
            <Star className="feedback-star star-b" size={18} fill="currentColor" />
          </div>

          <p className="eyebrow">Help us improve</p>
          <h1>We value your feedback!</h1>
          <p className="muted">Tell us what you love, what feels difficult, and what you would like to see next in AcademicVault.</p>

          <form onSubmit={submit} className="feedback-form">
            <div className="feedback-label-row">
              <strong>Rate your experience</strong>
              <span>{rating}/5</span>
            </div>

            <div className="rating-row" aria-label="Rating">
              {[1,2,3,4,5].map(n => (
                <button
                  type="button"
                  key={n}
                  className={`rating-star ${n <= rating ? 'selected' : ''}`}
                  onClick={() => setRating(n)}
                  aria-label={`${n} stars`}
                >
                  <Star size={30} fill="currentColor" />
                </button>
              ))}
            </div>

            <div className="rating-caption">
              {rating === 5 ? 'Excellent!' : rating === 4 ? 'Very good' : rating === 3 ? 'Good' : rating === 2 ? 'Needs improvement' : 'Poor'}
            </div>

            <label className="field">
              <span>What should we improve?</span>
              <div className="feedback-category-row">
                {['UI/UX', 'Performance', 'Features', 'Content', 'Support', 'Other'].map(x => (
                  <button
                    type="button"
                    key={x}
                    className={`feedback-chip ${category === x ? 'active' : ''}`}
                    onClick={() => setCategory(x)}
                  >
                    {x}
                  </button>
                ))}
              </div>
            </label>

            <label className="field">
              <span>Share your feedback</span>
              <textarea
                className="input textarea feedback-textarea"
                value={message}
                maxLength={500}
                onChange={e => setMessage(e.target.value)}
                placeholder="Tell us what you love or what we can improve..."
                required
              />
              <small className="feedback-count">{message.length}/500</small>
            </label>

            {error && <div className="error feedback-success">{error}</div>}

            {sent && (
              <div className="success feedback-success">
                <CheckCircle2 size={17} /> Thank you! Your feedback was saved successfully.
              </div>
            )}

            <button className="btn primary feedback-submit" type="submit" disabled={saving}>
              <Send size={16} /> {saving ? 'Submitting...' : 'Submit Feedback'}
            </button>
            <p className="feedback-privacy">Your feedback is stored securely in Supabase when a session is active.</p>
          </form>
        </section>
      </main>
    </div>
  );
}
