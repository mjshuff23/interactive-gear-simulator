/* eslint-disable @typescript-eslint/no-explicit-any */
export async function getOtpFromInbucket(email: string): Promise<string> {
  const mailboxUrl = `http://127.0.0.1:54324/api/v1/mailbox/${email}`;
  // Keep polling until message appears
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch(mailboxUrl);
      if (res.ok) {
        const messages: any = await res.json();
        if (messages.length > 0) {
          // Get the latest message
          const messageId = messages[0].id;
          const msgRes = await fetch(`${mailboxUrl}/${messageId}`);
          const msg: any = await msgRes.json();

          // Extract OTP (typically a 6 digit code in Supabase emails)
          const match = msg.body?.text?.match(/\b(\d{6})\b/);
          if (match) {
            return match[1];
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
