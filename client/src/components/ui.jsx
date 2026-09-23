/**
 * Small accessible UI kit.
 *
 * Everything here is keyboard operable, labelled for screen readers and built
 * on the CSS variable palette, so a theme change re-skins the whole app. No
 * component signals meaning with colour alone.
 */

import { forwardRef, useEffect, useId, useRef } from 'react';
import { cx } from '../lib/format.js';

const surface = 'bg-[var(--lr-surface)] text-[var(--lr-ink)] border border-[var(--lr-rule)]';

export const Button = forwardRef(function Button(
  { children, variant = 'primary', size = 'md', className, as: Tag = 'button', ...rest },
  ref
) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed select-none';
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2.5 text-[0.95rem]',
    lg: 'px-5 py-3 text-base',
    icon: 'p-2.5 text-lg',
  };
  const variants = {
    primary: 'bg-[var(--lr-accent)] text-[var(--lr-accent-ink)] hover:brightness-110 border border-transparent',
    secondary: `${surface} hover:bg-[var(--lr-surface-2)]`,
    ghost: 'bg-transparent text-[var(--lr-ink)] hover:bg-[var(--lr-surface-2)] border border-transparent',
    soft: 'bg-[var(--lr-accent-soft)] text-[var(--lr-ink)] hover:brightness-105 border border-transparent',
    danger: 'bg-[#b45309] text-white border border-transparent hover:brightness-110',
  };
  return (
    <Tag ref={ref} className={cx(base, sizes[size], variants[variant], className)} {...rest}>
      {children}
    </Tag>
  );
});

export function Card({ children, className, as: Tag = 'section', ...rest }) {
  return (
    <Tag className={cx('rounded-2xl shadow-sm', surface, 'p-4 sm:p-5', className)} {...rest}>
      {children}
    </Tag>
  );
}

export function SectionTitle({ children, hint, level = 2, id }) {
  const Tag = `h${level}`;
  return (
    <div className="mb-2">
      <Tag id={id} className="text-lg font-bold tracking-tight">
        {children}
      </Tag>
      {hint ? <p className="mt-0.5 text-sm text-[var(--lr-ink-soft)]">{hint}</p> : null}
    </div>
  );
}

export function Pill({ children, tone = 'neutral', className, ...rest }) {
  const tones = {
    neutral: 'bg-[var(--lr-surface-2)] text-[var(--lr-ink)]',
    accent: 'bg-[var(--lr-accent-soft)] text-[var(--lr-ink)]',
    read: 'bg-[var(--lr-read)] text-[var(--lr-read-ink)]',
    current: 'bg-[var(--lr-current)] text-[var(--lr-current-ink)]',
  };
  return (
    <span
      className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold', tones[tone], className)}
      {...rest}
    >
      {children}
    </span>
  );
}

export function Field({ label, hint, error, children, id: idProp }) {
  const generated = useId();
  const id = idProp || generated;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-[var(--lr-ink-soft)]">
          {hint}
        </p>
      ) : null}
      {typeof children === 'function' ? children({ id, 'aria-describedby': hint ? `${id}-hint` : undefined }) : children}
      {error ? (
        <p role="alert" className="text-xs font-semibold text-[#92400e]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function TextInput({ className, ...rest }) {
  return (
    <input
      className={cx(
        'w-full rounded-xl border border-[var(--lr-rule)] bg-[var(--lr-surface)] px-3 py-2.5 text-base',
        'placeholder:text-[var(--lr-ink-soft)]',
        className
      )}
      {...rest}
    />
  );
}

export function TextArea({ className, ...rest }) {
  return (
    <textarea
      className={cx(
        'w-full rounded-xl border border-[var(--lr-rule)] bg-[var(--lr-surface)] px-3 py-3 text-base leading-relaxed',
        className
      )}
      {...rest}
    />
  );
}

export function Select({ className, children, ...rest }) {
  return (
    <select
      className={cx(
        'w-full rounded-xl border border-[var(--lr-rule)] bg-[var(--lr-surface)] px-3 py-2.5 text-base',
        className
      )}
      {...rest}
    >
      {children}
    </select>
  );
}

export function RangeSlider({ label, value, min, max, step, onChange, format, id: idProp, hint }) {
  const generated = useId();
  const id = idProp || generated;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-semibold">
          {label}
        </label>
        <output htmlFor={id} className="text-sm font-bold tabular-nums text-[var(--lr-ink-soft)]">
          {format ? format(value) : value}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[var(--lr-surface-2)] accent-[var(--lr-accent)]"
      />
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-[var(--lr-ink-soft)]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Toggle({ label, checked, onChange, hint, id: idProp }) {
  const generated = useId();
  const id = idProp || generated;
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <div>
        <label htmlFor={id} className="text-sm font-semibold">
          {label}
        </label>
        {hint ? <p className="text-xs text-[var(--lr-ink-soft)]">{hint}</p> : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative mt-0.5 h-7 w-12 shrink-0 rounded-full border transition-colors',
          checked ? 'bg-[var(--lr-accent)] border-[var(--lr-accent)]' : 'bg-[var(--lr-surface-2)] border-[var(--lr-rule)]'
        )}
      >
        <span className="sr-only">{checked ? 'On' : 'Off'}</span>
        <span
          aria-hidden="true"
          className={cx(
            'absolute top-0.5 h-5 w-5 rounded-full bg-[var(--lr-surface)] shadow transition-all',
            checked ? 'left-6' : 'left-0.5'
          )}
        />
      </button>
    </div>
  );
}

export function SegmentedControl({ options, value, onChange, label, size = 'md' }) {
  return (
    <div role="group" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-xl bg-[var(--lr-surface-2)] p-1">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            title={opt.hint}
            className={cx(
              'rounded-lg font-semibold transition-colors',
              size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm',
              active
                ? 'bg-[var(--lr-surface)] text-[var(--lr-ink)] shadow-sm ring-1 ring-[var(--lr-rule)]'
                : 'text-[var(--lr-ink-soft)] hover:text-[var(--lr-ink)]'
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function ProgressBar({ value, label, tone = 'accent' }) {
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value)}
      aria-label={label}
      className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--lr-surface-2)]"
    >
      <div
        className={cx('h-full rounded-full transition-[width] duration-300', tone === 'accent' ? 'bg-[var(--lr-accent)]' : 'bg-[var(--lr-flag-hard)]')}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export function Alert({ tone = 'info', title, children, actions, role = 'status' }) {
  const tones = {
    info: 'bg-[var(--lr-accent-soft)] border-[var(--lr-rule)]',
    gentle: 'bg-[var(--lr-surface-2)] border-[var(--lr-rule)]',
    warning: 'bg-[#fde9c8] border-[#e5c07b] text-[#4a3410]',
  };
  return (
    <div role={role} className={cx('rounded-2xl border p-3.5 text-sm', tones[tone])}>
      {title ? <p className="mb-1 font-bold">{title}</p> : null}
      <div className="space-y-1.5 leading-relaxed">{children}</div>
      {actions ? <div className="mt-3 flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Spinner({ label = 'Loading' }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-[var(--lr-ink-soft)]">
      <span
        aria-hidden="true"
        className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--lr-rule)] border-t-[var(--lr-accent)]"
      />
      {label}
    </span>
  );
}

export function Drawer({ open, onClose, title, children, side = 'right', labelledBy }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex" role="dialog" aria-modal="true" aria-labelledby={labelledBy || 'drawer-title'}>
      <button
        type="button"
        aria-label="Close panel"
        onClick={onClose}
        className="flex-1 bg-black/35 backdrop-blur-[1px]"
      />
      <div
        ref={ref}
        className={cx(
          'h-full w-full max-w-md overflow-y-auto border-l border-[var(--lr-rule)] bg-[var(--lr-surface)] p-4 shadow-xl sm:max-w-lg',
          side === 'left' && 'order-first border-l-0 border-r'
        )}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id={labelledBy || 'drawer-title'} className="text-lg font-bold">
            {title}
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close panel">
            Close
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Toast({ children, tone = 'accent', onDismiss, live = 'polite' }) {
  return (
    <div
      role="status"
      aria-live={live}
      className={cx(
        'lr-rise pointer-events-auto flex items-start gap-3 rounded-2xl border p-3.5 shadow-lg',
        tone === 'accent' ? 'border-[var(--lr-rule)] bg-[var(--lr-surface)]' : 'border-[var(--lr-rule)] bg-[var(--lr-surface-2)]'
      )}
    >
      <div className="flex-1 text-sm leading-relaxed">{children}</div>
      {onDismiss ? (
        <button type="button" onClick={onDismiss} aria-label="Dismiss message" className="text-sm font-bold">
          ✕
        </button>
      ) : null}
    </div>
  );
}
