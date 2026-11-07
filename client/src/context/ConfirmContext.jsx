import { createContext, useCallback, useEffect, useRef, useState } from 'react';

export const ConfirmContext = createContext(null);

// Usage anywhere:  const ok = await confirm({ title, message, confirmLabel, danger })
// It uses the browser's built-in <dialog>, which already traps keyboard focus,
// closes on Escape, and dims the page behind it.
export function ConfirmProvider({ children }) {
  const [options, setOptions] = useState(null);
  const dialogRef = useRef(null);
  const pending = useRef(null); // the function that answers the waiting confirm() call

  const confirm = useCallback(
    (opts) =>
      new Promise((resolve) => {
        pending.current?.(false); // a second dialog replaces the first: answer the old one "no"
        pending.current = resolve;
        setOptions(opts);
      }),
    []
  );

  const settle = useCallback((answer) => {
    pending.current?.(answer);
    pending.current = null;
    setOptions(null);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (options && dialog && !dialog.open) dialog.showModal();
  }, [options]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {options && (
        <dialog
          ref={dialogRef}
          className="dialog"
          onClose={() => settle(false)} // Escape, Cancel, or backdrop click all end up here
          onClick={(e) => { if (e.target === dialogRef.current) dialogRef.current.close(); }}
        >
          <h2>{options.title}</h2>
          <p className="muted">{options.message}</p>
          <div className="dialog-actions">
            <button className="btn btn-secondary btn-small" onClick={() => dialogRef.current?.close()}>
              Cancel
            </button>
            <button
              className={`btn btn-small ${options.danger ? 'btn-solid-danger' : ''}`}
              onClick={() => { settle(true); dialogRef.current?.close(); }}
            >
              {options.confirmLabel || 'Confirm'}
            </button>
          </div>
        </dialog>
      )}
    </ConfirmContext.Provider>
  );
}
