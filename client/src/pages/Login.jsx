import { useState } from 'react';
import { Link } from 'react-router-dom';
import Field from '../components/Field';
import { useAuth } from '../hooks/useAuth';
import { parseApiError } from '../api/client';

export default function Login() {
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null); // { message, fields }
  const [submitting, setSubmitting] = useState(false);

  const update = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return; // a double-click must not send two requests
    setSubmitting(true);
    setError(null);
    try {
      await login(form);
      // No redirect here: once the user is set, PublicOnlyRoute sends them on.
    } catch (err) {
      setError(parseApiError(err));
      setSubmitting(false);
    }
  }

  const fieldErrors = error?.fields || {};
  const showAlert = error && Object.keys(fieldErrors).length === 0;

  return (
    <div className="auth-page">
      <form className="card" onSubmit={handleSubmit} noValidate>
        <div className="brand">Split Shelf</div>
        <h1>Welcome back</h1>
        <p className="muted">Log in to see your shared shelf.</p>

        {showAlert && <div className="alert" role="alert">{error.message}</div>}

        <Field label="Email" name="email" type="email" autoComplete="email"
               value={form.email} onChange={update} error={fieldErrors.email} required />
        <Field label="Password" name="password" type="password" autoComplete="current-password"
               value={form.password} onChange={update} error={fieldErrors.password} required />

        <button className="btn" type="submit" disabled={submitting}>
          {submitting ? 'Logging in…' : 'Log in'}
        </button>

        <p className="switch">
          New here? <Link to="/register">Create an account</Link>
        </p>
      </form>
    </div>
  );
}
