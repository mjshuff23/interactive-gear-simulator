import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthModal } from "./AuthModal";

describe("AuthModal", () => {
  const defaultAuthState = {
    status: "unconfigured" as const,
    email: null,
    errorMessage: null,
    resendCooldown: 0,
  };

  const defaultAuthActions = {
    sendOtp: vi.fn(),
    verifyOtp: vi.fn(),
    signOut: vi.fn(),
    clearError: vi.fn(),
  };

  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute("open", "");
    };
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute("open");
    };
  });

  it("does not render when isOpen is false", () => {
    render(
      <AuthModal
        isOpen={false}
        onClose={vi.fn()}
        authState={defaultAuthState}
        authActions={defaultAuthActions}
      />,
    );
    // The dialog should not have the `open` attribute natively
    const dialog = screen.queryByRole("dialog", { hidden: true });
    if (dialog) {
      expect(dialog).not.toHaveAttribute("open");
    }
  });

  it("renders when isOpen is true and shows unconfigured message", () => {
    render(
      <AuthModal
        isOpen={true}
        onClose={vi.fn()}
        authState={defaultAuthState}
        authActions={defaultAuthActions}
      />,
    );

    expect(
      screen.getByText(/Cloud saving is not configured/),
    ).toBeInTheDocument();
  });

  it("closes when the close button is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <AuthModal
        isOpen={true}
        onClose={onClose}
        authState={defaultAuthState}
        authActions={defaultAuthActions}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows email input when signed out", async () => {
    render(
      <AuthModal
        isOpen={true}
        onClose={vi.fn()}
        authState={{ ...defaultAuthState, status: "signed-out" }}
        authActions={defaultAuthActions}
      />,
    );

    expect(screen.getByLabelText(/Email address/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Send Verification Code/i }),
    ).toBeInTheDocument();
  });

  it("calls sendOtp when email form is submitted", async () => {
    const user = userEvent.setup();
    const actions = { ...defaultAuthActions, sendOtp: vi.fn() };

    render(
      <AuthModal
        isOpen={true}
        onClose={vi.fn()}
        authState={{ ...defaultAuthState, status: "signed-out" }}
        authActions={actions}
      />,
    );

    await user.type(
      screen.getByLabelText(/Email address/i),
      "test@example.com",
    );
    await user.click(
      screen.getByRole("button", { name: /Send Verification Code/i }),
    );

    expect(actions.sendOtp).toHaveBeenCalledWith("test@example.com");
  });

  it("shows verification input when otp is sent", async () => {
    render(
      <AuthModal
        isOpen={true}
        onClose={vi.fn()}
        authState={{
          ...defaultAuthState,
          status: "otp-sent",
          email: "test@example.com",
        }}
        authActions={defaultAuthActions}
      />,
    );

    expect(
      screen.getByText(/A 6-digit code has been sent/i),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/6-digit verification code/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Verify Code/i }),
    ).toBeInTheDocument();
  });

  it("calls verifyOtp when otp form is submitted", async () => {
    const user = userEvent.setup();
    const actions = { ...defaultAuthActions, verifyOtp: vi.fn() };

    render(
      <AuthModal
        isOpen={true}
        onClose={vi.fn()}
        authState={{
          ...defaultAuthState,
          status: "otp-sent",
          email: "test@example.com",
        }}
        authActions={actions}
      />,
    );

    await user.type(
      screen.getByLabelText(/6-digit verification code/i),
      "123456",
    );
    await user.click(screen.getByRole("button", { name: /Verify Code/i }));

    expect(actions.verifyOtp).toHaveBeenCalledWith(
      "test@example.com",
      "123456",
    );
  });

  it("disables resend button until cooldown expires", () => {
    render(
      <AuthModal
        isOpen={true}
        onClose={vi.fn()}
        authState={{
          ...defaultAuthState,
          status: "otp-sent",
          email: "test@example.com",
          resendCooldown: 30,
        }}
        authActions={defaultAuthActions}
      />,
    );

    const resendButton = screen.getByRole("button", { name: /Resend in 30s/i });
    expect(resendButton).toBeDisabled();
  });

  it("enables resend button when cooldown is 0", async () => {
    const user = userEvent.setup();
    const actions = { ...defaultAuthActions, sendOtp: vi.fn() };

    render(
      <AuthModal
        isOpen={true}
        onClose={vi.fn()}
        authState={{
          ...defaultAuthState,
          status: "otp-sent",
          email: "test@example.com",
          resendCooldown: 0,
        }}
        authActions={actions}
      />,
    );

    const resendButton = screen.getByRole("button", { name: /Resend Code/i });
    expect(resendButton).toBeEnabled();

    await user.click(resendButton);
    expect(actions.sendOtp).toHaveBeenCalledWith("test@example.com");
  });

  it("displays and clears errors", async () => {
    const user = userEvent.setup();
    const actions = { ...defaultAuthActions, clearError: vi.fn() };

    render(
      <AuthModal
        isOpen={true}
        onClose={vi.fn()}
        authState={{
          ...defaultAuthState,
          status: "error",
          errorMessage: "Invalid OTP",
        }}
        authActions={actions}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Invalid OTP");

    await user.click(screen.getByRole("button", { name: "Clear error" }));
    expect(actions.clearError).toHaveBeenCalledTimes(1);
  });

  it("renders restoring state", () => {
    render(
      <AuthModal
        isOpen={true}
        onClose={vi.fn()}
        authState={{ ...defaultAuthState, status: "restoring" }}
        authActions={defaultAuthActions}
      />,
    );
    expect(screen.getByText(/Loading session.../i)).toBeInTheDocument();
  });

  it("disables input and shows sending state during sending-otp", () => {
    render(
      <AuthModal
        isOpen={true}
        onClose={vi.fn()}
        authState={{ ...defaultAuthState, status: "sending-otp", email: null }}
        authActions={defaultAuthActions}
      />,
    );
    const emailInput = screen.getByLabelText(/Email address/i);
    expect(emailInput).toBeDisabled();
    expect(screen.getByRole("button", { name: /Sending.../i })).toBeDisabled();
  });

  it("disables input and shows verifying state during verifying-otp", () => {
    render(
      <AuthModal
        isOpen={true}
        onClose={vi.fn()}
        authState={{
          ...defaultAuthState,
          status: "verifying-otp",
          email: "test@example.com",
        }}
        authActions={defaultAuthActions}
      />,
    );
    const otpInput = screen.getByLabelText(/6-digit verification code/i);
    expect(otpInput).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /Verifying.../i }),
    ).toBeDisabled();
  });

  it("renders signed-in state with sign-out button", async () => {
    const user = userEvent.setup();
    const actions = { ...defaultAuthActions, signOut: vi.fn() };

    render(
      <AuthModal
        isOpen={true}
        onClose={vi.fn()}
        authState={{
          ...defaultAuthState,
          status: "signed-in",
          email: "user@example.com",
        }}
        authActions={actions}
      />,
    );

    expect(screen.getByText(/Signed in as/i)).toBeInTheDocument();
    expect(screen.getByText("user@example.com")).toBeInTheDocument();

    const signOutButton = screen.getByRole("button", { name: /Sign Out/i });
    expect(signOutButton).toBeInTheDocument();

    await user.click(signOutButton);
    expect(actions.signOut).toHaveBeenCalledTimes(1);
  });
});
