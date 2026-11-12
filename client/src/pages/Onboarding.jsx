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
    <form className="onboard-card" onSubmit={handleSubmit} noValidate>
      <div>
        <h2 className="onboard-card-title">Start a household</h2>
        <p className="onboard-card-desc">You'll get an invite code to share with your flatmates.</p>
        {error && !fields.name && <div className="alert" role="alert">{error.message}</div>}
        <Field label="Household name" name="household-name" placeholder="Flat 4B"
               value={name} onChange={(e) => setName(e.target.value)}
               error={fields.name} maxLength={50} required />
      </div>
      <button className="btn onboard-submit-btn" type="submit" disabled={submitting}>
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
    <form className="onboard-card" onSubmit={handleSubmit} noValidate>
      <div>
        <h2 className="onboard-card-title">Join with a code</h2>
        <p className="onboard-card-desc">Ask a flatmate for the 8-character invite code.</p>
        {error && !fields.inviteCode && <div className="alert" role="alert">{error.message}</div>}
        <Field label="Invite code" name="invite-code" placeholder="AB3K9XYZ"
               value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
               error={fields.inviteCode} maxLength={8} autoComplete="off"
               autoCapitalize="characters" spellCheck={false} required />
      </div>
      <button className="btn btn-secondary onboard-submit-btn" type="submit" disabled={submitting}>
        {submitting ? 'Joining…' : 'Join household'}
      </button>
    </form>
  );
}

export default function Onboarding() {
  return (
    <div className="onboarding-page-layout">
      <TopBar />
      <main className="onboarding-main">
        <div className="onboarding-header">
          <h1 className="onboarding-title">Set up your shelf</h1>
          <p className="onboarding-subtitle">Split Shelf works per household. Start one, or join one.</p>
        </div>
        <div className="onboard-grid">
          <CreateForm />
          <JoinForm />
        </div>
      </main>
    </div>
  );
}
