import React, { useState } from "react";
import { useSupabaseAuth } from "../auth/useSupabaseAuth";
import "./AuthPanel.css"; // Ensure you create or merge basic styling

export function AuthPanel() {
  const [authState, authActions] = useSupabaseAuth();
  const [emailInput, setEmailInput] = useState("");
  const [otpInput, setOtpInput] = useState("");

  if (authState.status === "unconfigured") {
    return (
      <div className="auth-panel" role="status">
        <p>Cloud saving is not configured.</p>
      </div>
    );
  }

  if (authState.status === "restoring") {
    return (
      <div className="auth-panel" role="status">
        <p>Loading session...</p>
      </div>
    );
  }

  if (authState.status === "signed-in") {
    return (
      <div className="auth-panel auth-signed-in">
        <p>Signed in as {authState.email}</p>
        <button onClick={() => authActions.signOut()}>Sign Out</button>
      </div>
    );
  }

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
    <div className="auth-panel">
      {authState.errorMessage && (
        <div className="auth-error" role="alert">
          {authState.errorMessage}
          <button onClick={authActions.clearError} aria-label="Clear error">
            x
          </button>
        </div>
      )}

      {authState.status === "signed-out" ||
      authState.status === "sending-otp" ||
      authState.status === "error" ? (
        <form onSubmit={handleSendOtp}>
          <label htmlFor="email-input">Email</label>
          <input
            id="email-input"
            type="email"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            disabled={authState.status === "sending-otp"}
            required
          />
          <button
            type="submit"
            disabled={authState.status === "sending-otp" || !emailInput}
          >
            {authState.status === "sending-otp"
              ? "Sending..."
              : "Sign In / Sign Up"}
          </button>
        </form>
      ) : null}

      {(authState.status === "otp-sent" ||
        authState.status === "verifying-otp") && (
        <div className="auth-verify-step">
          <p role="status">
            A 6-digit code has been sent to {authState.email}.
          </p>
          <form onSubmit={handleVerifyOtp}>
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
              aria-label="6-digit verification code"
            />
            <button
              type="submit"
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
            className="auth-resend-btn"
          >
            {authState.resendCooldown > 0
              ? `Resend in ${authState.resendCooldown}s`
              : "Resend Code"}
          </button>
        </div>
      )}
    </div>
  );
}
