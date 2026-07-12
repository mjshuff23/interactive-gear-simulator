/* eslint-disable @typescript-eslint/no-explicit-any */
export async function getOtpFromInbucket(email: string): Promise<string> {
  // List (rather than search) and filter client-side, avoiding any
  // ambiguity in Mailpit's search-query parsing of the address. Newest
  // messages come first and the stack is reset per CI run, so a generous
  // single page is enough to always contain the just-sent OTP.
  const listUrl = `http://127.0.0.1:54324/api/v1/messages?limit=200`;
  // Keep polling until message appears
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch(listUrl);
      if (res.ok) {
        const { messages }: any = await res.json();
        const match = messages?.find((m: any) =>
          m.To?.some(
            (to: any) => to.Address?.toLowerCase() === email.toLowerCase(),
          ),
        );
        if (match) {
          const msgRes = await fetch(
            `http://127.0.0.1:54324/api/v1/message/${match.ID}`,
          );
          const msg: any = await msgRes.json();

          // Extract OTP (typically a 6 digit code in Supabase emails)
          const otpMatch = msg.Text?.match(/\b(\d{6})\b/);
          if (otpMatch) {
            return otpMatch[1];
          }
        }
      }
    } catch {
      // Ignore fetch errors during polling
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`OTP not found for ${email}`);
}
