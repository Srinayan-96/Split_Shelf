import { useState } from 'react';
import { Link } from 'react-router-dom';
import Field from '../components/Field';
import ThemeToggle from '../components/ThemeToggle';
import { useAuth } from '../hooks/useAuth';
import { parseApiError } from '../api/client';

export default function Register() {
  const { register } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const update = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await register(form);
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
        <div className="auth-tools"><ThemeToggle /></div>
        <div className="brand">Split Shelf</div>
        <h1>Create your account</h1>
        <p className="muted">Track what your household shares, not just what it spends.</p>

        {showAlert && <div className="alert" role="alert">{error.message}</div>}

        <Field label="Name" name="name" autoComplete="name"
               value={form.name} onChange={update} error={fieldErrors.name} required />
        <Field label="Email" name="email" type="email" autoComplete="email"
               value={form.email} onChange={update} error={fieldErrors.email} required />
        <Field label="Password (8+ characters)" name="password" type="password"
               autoComplete="new-password"
               value={form.password} onChange={update} error={fieldErrors.password} required />

        <button className="btn" type="submit" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Sign up'}
        </button>

        <p className="switch">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </div>
  );
}
