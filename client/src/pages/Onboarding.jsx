import { useState } from 'react';
import Field from '../components/Field';
import TopBar from '../components/TopBar';
import { useHousehold } from '../hooks/useHousehold';
import { parseApiError } from '../api/client';

function CreateForm() {
  const { create } = useHousehold();
  const [name, setName] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await create({ name });
      // Success changes the household, and HouseholdGate swaps this screen for the app.
    } catch (err) {
      setError(parseApiError(err));
      setSubmitting(false);
    }
  }

  const fields = error?.fields || {};
  return (
    <form className="panel" onSubmit={handleSubmit} noValidate>
      <h2>Start a household</h2>
      <p className="muted">You'll get an invite code to share with your flatmates.</p>
      {error && !fields.name && <div className="alert" role="alert">{error.message}</div>}
      <Field label="Household name" name="household-name" placeholder="Flat 4B"
             value={name} onChange={(e) => setName(e.target.value)}
             error={fields.name} maxLength={50} required />
      <button className="btn" type="submit" disabled={submitting}>
        {submitting ? 'Creating…' : 'Create household'}
      </button>
    </form>
  );
}

function JoinForm() {
  const { join } = useHousehold();
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await join({ inviteCode: code.trim() });
    } catch (err) {
      setError(parseApiError(err));
      setSubmitting(false);
    }
  }

  const fields = error?.fields || {};
  return (
    <form className="panel" onSubmit={handleSubmit} noValidate>
      <h2>Join with a code</h2>
      <p className="muted">Ask a flatmate for the 8-character invite code.</p>
      {error && !fields.inviteCode && <div className="alert" role="alert">{error.message}</div>}
      <Field label="Invite code" name="invite-code" placeholder="AB3K9XYZ"
             value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
             error={fields.inviteCode} maxLength={8} autoComplete="off"
             autoCapitalize="characters" spellCheck={false} required />
      <button className="btn" type="submit" disabled={submitting}>
        {submitting ? 'Joining…' : 'Join household'}
      </button>
    </form>
  );
}

export default function Onboarding() {
  return (
    <div className="page">
      <TopBar />
      <h1>Set up your shelf</h1>
      <p className="muted">Split Shelf works per household. Start one, or join one.</p>
      <div className="onboard-grid">
        <CreateForm />
        <JoinForm />
      </div>
    </div>
  );
}
