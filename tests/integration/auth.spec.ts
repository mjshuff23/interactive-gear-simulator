import { test, expect } from "@playwright/test";
import { getOtpFromInbucket } from "./helpers/mail";

test.describe("Auth Flow", () => {
  test("logs in via OTP and signs out", async ({ page }) => {
    const email = `test-${Date.now()}@example.com`;
    await page.goto("/");

    // Check we are logged out initially
    await expect(
      page.getByText("Sign in to view and save to your library."),
    ).toBeVisible();

    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.getByLabel(/Email address/i).fill(email);
    await page.getByRole("button", { name: /Send Verification Code/i }).click();

    // Wait for OTP dialog
    await expect(page.getByText(/A 6-digit code has been sent/i)).toBeVisible();

    const otp = await getOtpFromInbucket(email);

    await page.getByLabel(/6-digit verification code/i).fill(otp);
    await page.getByRole("button", { name: /Verify Code/i }).click();

    // Verify logged in
    await expect(
      page.getByRole("heading", { name: "Your Library" }),
    ).toBeVisible();
    await expect(page.getByText("No saved systems.")).toBeVisible();

    // Sign out button should appear in the header/auth modal
    await expect(
      page.getByRole("button", { name: "Sign In" }),
    ).not.toBeVisible();

    // The auth modal stays open after verification, already showing the
    // signed-in view with a Sign Out button.
    await page.getByRole("button", { name: "Sign Out" }).click();

    // Verify logged out
    await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
  });
});
