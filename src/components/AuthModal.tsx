import React, { useState, useEffect, useRef } from "react";
import type {
  SupabaseAuthState,
  SupabaseAuthActions,
} from "../auth/useSupabaseAuth";
import "./AuthModal.css";

interface AuthModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly authState: SupabaseAuthState;
  readonly authActions: SupabaseAuthActions;
}

export function AuthModal({
  isOpen,
  onClose,
  authState,
  authActions,
}: AuthModalProps) {
  const [emailInput, setEmailInput] = useState("");
  const [otpInput, setOtpInput] = useState("");

  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    authActions.sendOtp(emailInput);
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (authState.email) {
      authActions.verifyOtp(authState.email, otpInput);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="auth-modal"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) {
          onClose();
        }
      }}
    >
      <div className="auth-modal-content">
        <button
          className="auth-modal-close"
          onClick={onClose}
          aria-label="Close"
        >
          &times;
        </button>
        <h2>Account & Cloud Saving</h2>

        {authState.status === "unconfigured" && (
          <p>Cloud saving is not configured in this environment.</p>
        )}

        {authState.status === "restoring" && <p>Loading session...</p>}

        {authState.status === "signed-in" && (
          <div className="auth-signed-in">
            <p>
              Signed in as <strong>{authState.email}</strong>
            </p>
            <button
              className="primaryButton"
              onClick={() => authActions.signOut()}
            >
              Sign Out
            </button>
          </div>
        )}

        {authState.errorMessage && (
          <div className="auth-error" role="alert">
            {authState.errorMessage}
            <button onClick={authActions.clearError} aria-label="Clear error">
              &times;
            </button>
          </div>
        )}

        {(authState.status === "signed-out" ||
          authState.status === "sending-otp" ||
          authState.status === "error") && (
          <form onSubmit={handleSendOtp} className="auth-form">
            <label htmlFor="email-input">Email address</label>
            <input
              id="email-input"
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              disabled={authState.status === "sending-otp"}
              required
              placeholder="you@example.com"
            />
            <button
              type="submit"
              className="primaryButton"
              disabled={authState.status === "sending-otp" || !emailInput}
            >
              {authState.status === "sending-otp"
                ? "Sending..."
                : "Send Verification Code"}
            </button>
          </form>
        )}

        {(authState.status === "otp-sent" ||
          authState.status === "verifying-otp") && (
          <div className="auth-verify-step">
            <output>
              A 6-digit code has been sent to <strong>{authState.email}</strong>
              {"."}
            </output>
            <form onSubmit={handleVerifyOtp} className="auth-form">
              <label htmlFor="otp-input">Verification Code</label>
              <input
                id="otp-input"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value)}
                disabled={authState.status === "verifying-otp"}
                required
                placeholder="123456"
                aria-label="6-digit verification code"
              />
              <button
                type="submit"
                className="primaryButton"
                disabled={
                  authState.status === "verifying-otp" || otpInput.length !== 6
                }
              >
                {authState.status === "verifying-otp"
                  ? "Verifying..."
                  : "Verify Code"}
              </button>
            </form>

            <button
              onClick={() =>
                authState.email && authActions.sendOtp(authState.email)
              }
              disabled={authState.resendCooldown > 0}
              className="ghostButton"
            >
              {authState.resendCooldown > 0
                ? `Resend in ${authState.resendCooldown}s`
                : "Resend Code"}
            </button>
          </div>
        )}
      </div>
    </dialog>
  );
}
