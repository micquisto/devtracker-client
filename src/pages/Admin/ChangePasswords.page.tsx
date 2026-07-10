import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Card } from "@/components/shared/Containers";
import { Title } from "@/components/shared/page";
import {
  confirmSupabaseAuthUserEmail,
  getSupabaseRows,
  updateSupabaseAuthUserPassword,
} from "@/lib/supabase";
import { Palette } from "@/lib/theme";
import "@/assets/styles/RequirementsData.page.css";

type MemberOptionRow = {
  id: string;
  auth_user_id: string | null;
  email: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
};

type ChangePasswordFormState = {
  memberId: string;
  password: string;
  confirmPassword: string;
};

const INITIAL_FORM: ChangePasswordFormState = {
  memberId: "",
  password: "",
  confirmPassword: "",
};

function getMemberName(member: MemberOptionRow): string {
  const fullName = member.full_name?.trim();
  const composedName = [member.first_name, member.last_name]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");

  return fullName || composedName || member.email || "Unnamed Member";
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  return fallback;
}

export default function ChangePasswordsPage() {
  const [members, setMembers] = useState<MemberOptionRow[]>([]);
  const [form, setForm] = useState<ChangePasswordFormState>(INITIAL_FORM);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirmingEmail, setConfirmingEmail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const selectedMember = useMemo(
    () => members.find((member) => member.id === form.memberId) ?? null,
    [form.memberId, members],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadMembers(): Promise<void> {
      setLoadingMembers(true);
      setError(null);

      try {
        const rows = await getSupabaseRows<MemberOptionRow>("members", {
          select: "id,auth_user_id,email,full_name,first_name,last_name",
        });

        if (!cancelled) {
          setMembers(rows.filter((member) => Boolean(member.id)));
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(getErrorMessage(loadError, "Unable to load members."));
        }
      } finally {
        if (!cancelled) setLoadingMembers(false);
      }
    }

    void loadMembers();

    return () => {
      cancelled = true;
    };
  }, []);

  function updateField<K extends keyof ChangePasswordFormState>(
    key: K,
    value: ChangePasswordFormState[K],
  ): void {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
    setError(null);
    setSuccess(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const memberId = form.memberId.trim();
    const password = form.password.trim();
    const confirmPassword = form.confirmPassword.trim();

    if (!memberId || !password || !confirmPassword) {
      setError("All fields are required.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Password and confirmation password must match.");
      return;
    }

    if (!selectedMember?.auth_user_id) {
      setError("Selected member does not have a linked Supabase auth user.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await updateSupabaseAuthUserPassword(memberId, password);

      setForm(INITIAL_FORM);
      setSuccess(`Password updated for ${getMemberName(selectedMember)} (${result.email}).`);
    } catch (submitError) {
      setError(getErrorMessage(submitError, "Unable to update password."));
    } finally {
      setSubmitting(false);
    }
  }

  async function bypassEmailVerification(): Promise<void> {
    const memberId = form.memberId.trim();

    if (!memberId) {
      setError("Please select a member first.");
      return;
    }

    if (!selectedMember?.auth_user_id) {
      setError("Selected member does not have a linked Supabase auth user.");
      return;
    }

    setConfirmingEmail(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await confirmSupabaseAuthUserEmail(memberId);

      setSuccess(
        `Email verification bypassed for ${getMemberName(selectedMember)} (${result.email}).`,
      );
    } catch (confirmError) {
      setError(getErrorMessage(confirmError, "Unable to bypass email verification."));
    } finally {
      setConfirmingEmail(false);
    }
  }

  return (
    <div className="requirements-data-page">
      <Title
        eyebrow="Admin"
        title="Change Passwords"
        subtitle="Update a selected member's Supabase authentication password."
        align="left"
      />

      <Card className="requirements-data-card">
        <form className="requirements-data-form" onSubmit={(event) => void handleSubmit(event)}>
          <div className="requirements-data-grid">
            <label className="requirements-data-field" style={{ gridColumn: "1 / -1" }}>
              <span>Member</span>
              <div className="requirements-data-select-wrap">
                <select
                  disabled={loadingMembers || submitting || confirmingEmail}
                  name="memberId"
                  onChange={(event) => updateField("memberId", event.target.value)}
                  required
                  value={form.memberId}
                >
                  <option value="">
                    {loadingMembers ? "Loading members..." : "Select member"}
                  </option>
                  {members.map((member) => (
                    <option
                      disabled={!member.auth_user_id}
                      key={member.id}
                      value={member.id}
                    >
                      {getMemberName(member)}
                      {member.email ? ` (${member.email})` : ""}
                      {!member.auth_user_id ? " - No auth user" : ""}
                    </option>
                  ))}
                </select>
                <svg
                  aria-hidden="true"
                  className="requirements-data-select-arrow"
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                >
                  <path
                    d="M2.5 4.5 6 8l3.5-3.5"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.7"
                  />
                </svg>
              </div>
            </label>

            <label className="requirements-data-field">
              <span>Password</span>
              <input
                disabled={submitting || confirmingEmail}
                name="password"
                onChange={(event) => updateField("password", event.target.value)}
                placeholder="Enter new password"
                required
                type="password"
                value={form.password}
              />
            </label>

            <label className="requirements-data-field">
              <span>Confirm Password</span>
              <input
                disabled={submitting || confirmingEmail}
                name="confirmPassword"
                onChange={(event) => updateField("confirmPassword", event.target.value)}
                placeholder="Confirm new password"
                required
                type="password"
                value={form.confirmPassword}
              />
            </label>
          </div>

          <div className="requirements-data-actions" style={{ gap: 12 }}>
            <button
              className="requirements-data-cancel-button"
              disabled={loadingMembers || submitting || confirmingEmail}
              onClick={() => void bypassEmailVerification()}
              style={{
                alignItems: "center",
                display: "inline-flex",
                gap: 8,
                justifyContent: "center",
              }}
              type="button"
            >
              {confirmingEmail ? (
                <>
                  <span
                    className="requirements-data-loader"
                    style={{ borderTopColor: Palette.cyan }}
                  />
                  Confirming
                </>
              ) : (
                "Bypass Email Verification"
              )}
            </button>
            <button
              className="requirements-data-submit"
              disabled={loadingMembers || submitting || confirmingEmail}
              type="submit"
            >
              {submitting ? (
                <>
                  <span
                    className="requirements-data-loader"
                    style={{ borderTopColor: Palette.cyan }}
                  />
                  Updating
                </>
              ) : (
                "Update Password"
              )}
            </button>
          </div>

          {error ? <div className="requirements-data-message is-error">{error}</div> : null}
          {success ? (
            <div className="requirements-data-message is-success">{success}</div>
          ) : null}
        </form>
      </Card>
    </div>
  );
}
