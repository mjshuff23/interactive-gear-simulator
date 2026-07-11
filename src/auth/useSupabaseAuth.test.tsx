/* eslint-disable @typescript-eslint/no-explicit-any */
import { renderHook, act } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { useSupabaseAuth } from "./useSupabaseAuth";
import * as supabaseLib from "../lib/supabase";

vi.mock("../lib/supabase", () => ({
  getSupabaseConfiguration: vi.fn(),
}));

describe("useSupabaseAuth", () => {
  let mockClient: any;
  let onAuthStateChangeUnsubscribe: any;
  let mockSessionCb: any;

  beforeEach(() => {
    vi.useFakeTimers();

    onAuthStateChangeUnsubscribe = vi.fn();
    mockClient = {
      auth: {
        getSession: vi
          .fn()
          .mockResolvedValue({ data: { session: null }, error: null }),
        onAuthStateChange: vi.fn().mockImplementation((cb) => {
          mockSessionCb = cb;
          return {
            data: {
              subscription: { unsubscribe: onAuthStateChangeUnsubscribe },
            },
          };
        }),
        signInWithOtp: vi.fn(),
        verifyOtp: vi.fn(),
        signOut: vi.fn().mockResolvedValue({ error: null }),
      },
    };

    vi.mocked(supabaseLib.getSupabaseConfiguration).mockReturnValue({
      status: "ready",
      client: mockClient as any,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("handles unconfigured state", () => {
    vi.mocked(supabaseLib.getSupabaseConfiguration).mockReturnValue({
      status: "unconfigured",
    });

    const { result } = renderHook(() => useSupabaseAuth());
    expect(result.current[0].status).toBe("unconfigured");
    expect(mockClient.auth.getSession).not.toHaveBeenCalled();
  });

  it("handles invalid configuration state", () => {
    vi.mocked(supabaseLib.getSupabaseConfiguration).mockReturnValue({
      status: "invalid",
      message: "Bad config",
    });

    const { result } = renderHook(() => useSupabaseAuth());
    expect(result.current[0].status).toBe("error");
    expect(result.current[0].errorMessage).toBe("Bad config");
  });

  it("handles successful session restoration", async () => {
    mockClient.auth.getSession.mockResolvedValueOnce({
      data: { session: { user: { email: "test@example.com" } } },
      error: null,
    });

    const { result } = renderHook(() => useSupabaseAuth());

    // Initially restoring
    expect(result.current[0].status).toBe("restoring");

    // Wait for promise resolution
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current[0].status).toBe("signed-in");
    expect(result.current[0].email).toBe("test@example.com");
  });

  it("creates exactly one auth subscription and cleans it up", async () => {
    const { unmount } = renderHook(() => useSupabaseAuth());

    expect(mockClient.auth.onAuthStateChange).toHaveBeenCalledTimes(1);

    unmount();

    expect(onAuthStateChangeUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it("handles OTP send success and resend cooldown", async () => {
    let resolveSend: any;
    mockClient.auth.signInWithOtp.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSend = resolve;
        }),
    );

    const { result } = renderHook(() => useSupabaseAuth());

    let promise: any;
    act(() => {
      promise = result.current[1].sendOtp("test@example.com");
    });

    expect(result.current[0].status).toBe("sending-otp");

    await act(async () => {
      resolveSend({ error: null });
      await promise;
    });

    expect(result.current[0].status).toBe("otp-sent");
    expect(result.current[0].email).toBe("test@example.com");
    expect(result.current[0].resendCooldown).toBe(60);

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(result.current[0].resendCooldown).toBe(50);

    act(() => {
      vi.advanceTimersByTime(50000);
    });

    expect(result.current[0].resendCooldown).toBe(0);
  });

  it("handles OTP send failure", async () => {
    mockClient.auth.signInWithOtp.mockResolvedValueOnce({
      error: { message: "Send failed" },
    });

    const { result } = renderHook(() => useSupabaseAuth());

    await act(async () => {
      await result.current[1].sendOtp("test@example.com");
    });

    expect(result.current[0].status).toBe("error");
    expect(result.current[0].errorMessage).toBe("Send failed");
  });

  it("handles OTP verify success", async () => {
    let resolveVerify: any;
    mockClient.auth.verifyOtp.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveVerify = resolve;
        }),
    );

    const { result } = renderHook(() => useSupabaseAuth());

    let promise: any;
    act(() => {
      promise = result.current[1].verifyOtp("test@example.com", "123456");
    });

    expect(result.current[0].status).toBe("verifying-otp");

    await act(async () => {
      resolveVerify({ error: null });
      await promise;
    });

    // Verification itself doesn't set "signed-in", the subscription event does.
    expect(result.current[0].errorMessage).toBeNull();
    expect(mockClient.auth.verifyOtp).toHaveBeenCalledWith({
      email: "test@example.com",
      token: "123456",
      type: "email",
    });

    act(() => {
      mockSessionCb("SIGNED_IN", { user: { email: "test@example.com" } });
    });

    expect(result.current[0].status).toBe("signed-in");
  });

  it("handles sign-out success", async () => {
    const { result } = renderHook(() => useSupabaseAuth());

    await act(async () => {
      await result.current[1].signOut();
    });

    expect(mockClient.auth.signOut).toHaveBeenCalledTimes(1);

    act(() => {
      mockSessionCb("SIGNED_OUT", null);
    });

    expect(result.current[0].status).toBe("signed-out");
    expect(result.current[0].email).toBeNull();
  });

  it("handles clearError action (with email fallback)", async () => {
    mockClient.auth.signInWithOtp.mockResolvedValueOnce({ error: null });
    mockClient.auth.verifyOtp.mockResolvedValueOnce({
      error: { message: "Verify failed" },
    });

    const { result } = renderHook(() => useSupabaseAuth());

    await act(async () => {
      await result.current[1].sendOtp("test@example.com");
    });

    await act(async () => {
      await result.current[1].verifyOtp("test@example.com", "123456");
    });

    expect(result.current[0].status).toBe("error");

    act(() => {
      result.current[1].clearError();
    });

    // With an email, clearError restores "otp-sent"
    expect(result.current[0].status).toBe("otp-sent");
    expect(result.current[0].errorMessage).toBeNull();
  });

  it("handles clearError action (without email fallback)", async () => {
    mockClient.auth.signInWithOtp.mockResolvedValueOnce({
      error: { message: "Send failed" },
    });

    const { result } = renderHook(() => useSupabaseAuth());

    await act(async () => {
      await result.current[1].sendOtp("test@example.com");
    });

    expect(result.current[0].status).toBe("error");

    act(() => {
      result.current[1].clearError();
    });

    // Without an email, clearError restores "signed-out"
    expect(result.current[0].status).toBe("signed-out");
    expect(result.current[0].errorMessage).toBeNull();
  });
});
