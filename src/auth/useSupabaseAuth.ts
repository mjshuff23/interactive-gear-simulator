import { useState, useEffect, useCallback, useRef } from "react";
import {
  getSupabaseConfiguration,
  type GearSupabaseClient,
} from "../lib/supabase";

export type AuthStatus =
  | "unconfigured"
  | "restoring"
  | "signed-out"
  | "sending-otp"
  | "otp-sent"
  | "verifying-otp"
  | "signed-in"
  | "error";

export interface SupabaseAuthState {
  status: AuthStatus;
  email: string | null;
  errorMessage: string | null;
  resendCooldown: number;
}

export interface SupabaseAuthActions {
  sendOtp: (email: string) => Promise<void>;
  verifyOtp: (email: string, token: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

export function useSupabaseAuth(): [SupabaseAuthState, SupabaseAuthActions] {
  const [status, setStatus] = useState<AuthStatus>("unconfigured");
  const [email, setEmail] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  const config = getSupabaseConfiguration();
  const client: GearSupabaseClient | null =
    config.status === "ready" ? config.client : null;

  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!client) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus(config.status === "unconfigured" ? "unconfigured" : "error");
      if (config.status === "invalid") {
        setErrorMessage(config.message);
      }
      return;
    }

    setStatus("restoring");

    // Initialize state
    client.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        setStatus("error");
        setErrorMessage(error.message);
      } else if (session) {
        setStatus("signed-in");
        setEmail(session.user.email ?? null);
      } else {
        setStatus("signed-out");
      }
    });

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN") {
        setStatus("signed-in");
        setEmail(session?.user.email ?? null);
      } else if (event === "SIGNED_OUT") {
        setStatus("signed-out");
        setEmail(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [client, config]);

  useEffect(() => {
    if (resendCooldown > 0) {
      intervalRef.current = window.setInterval(() => {
        setResendCooldown((c) => Math.max(0, c - 1));
      }, 1000);
    }

    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
      }
    };
  }, [resendCooldown]);

  const sendOtp = useCallback(
    async (targetEmail: string) => {
      if (!client) return;
      setStatus("sending-otp");
      setErrorMessage(null);

      const { error } = await client.auth.signInWithOtp({
        email: targetEmail,
        options: { shouldCreateUser: true },
      });

      if (error) {
        setStatus("error");
        setErrorMessage(error.message);
      } else {
        setEmail(targetEmail);
        setStatus("otp-sent");
        setResendCooldown(60);
      }
    },
    [client],
  );

  const verifyOtp = useCallback(
    async (targetEmail: string, token: string) => {
      if (!client) return;
      setStatus("verifying-otp");
      setErrorMessage(null);

      const { error } = await client.auth.verifyOtp({
        email: targetEmail,
        token,
        type: "email",
      });

      if (error) {
        setStatus("error");
        setErrorMessage(error.message);
      }
      // If success, onAuthStateChange will transition to "signed-in"
    },
    [client],
  );

  const signOut = useCallback(async () => {
    if (!client) return;
    setErrorMessage(null);
    const { error } = await client.auth.signOut();
    if (error) {
      setErrorMessage(error.message);
    }
  }, [client]);

  const clearError = useCallback(() => {
    setErrorMessage(null);
    if (status === "error") {
      setStatus(email ? "otp-sent" : "signed-out"); // Fallback
    }
  }, [status, email]);

  return [
    { status, email, errorMessage, resendCooldown },
    { sendOtp, verifyOtp, signOut, clearError },
  ];
}
