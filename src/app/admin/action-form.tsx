"use client";

import { createContext, use, useActionState, type ReactNode } from "react";
import styles from "./admin.module.css";
import { emptyForm, type FormState } from "./form-state";

const FormStateContext = createContext<FormState>(emptyForm);

export function ActionForm({
  action,
  submitLabel,
  children,
  extraButtons,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  children: ReactNode;
  extraButtons?: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, emptyForm);
  return (
    <FormStateContext value={state}>
      <form action={formAction} className={styles.form} noValidate>
        {children}
        {state.errors?.form && <p className={styles.error}>{state.errors.form}</p>}
        {state.message && (
          <p className={state.ok ? styles.noticeOk : styles.notice} role="status">
            {state.message}
          </p>
        )}
        <div className={styles.buttons}>
          <button type="submit" className={styles.button} disabled={pending}>
            {pending ? "Saving…" : submitLabel}
          </button>
          {extraButtons}
        </div>
      </form>
    </FormStateContext>
  );
}

export function FieldError({ name }: { name: string }) {
  const state = use(FormStateContext);
  const message = state.errors?.[name];
  return message ? (
    <span className={styles.error} role="alert">
      {message}
    </span>
  ) : null;
}
