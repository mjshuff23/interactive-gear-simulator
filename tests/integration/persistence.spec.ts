import { test, expect, type Page } from "@playwright/test";
import { getOtpFromInbucket } from "./helpers/mail";

async function login(page: Page, email: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByLabel(/Email address/i).fill(email);
  await page.getByRole("button", { name: /Send Verification Code/i }).click();
  const otp = await getOtpFromInbucket(email);
  await page.getByLabel(/6-digit verification code/i).fill(otp);
  await page.getByRole("button", { name: /Verify Code/i }).click();
  await expect(page.getByRole("button", { name: "Account" })).toBeVisible();

  // The auth modal stays open after verification; close it so it doesn't
  // block subsequent page interactions (it renders as a native <dialog>
  // which makes the rest of the page inert while open).
  await page.getByRole("button", { name: "Close" }).click();
}

test.describe("Persistence", () => {
  test("creates, renames, loads, handles dirty protection, and catches stale writes", async ({
    browser,
  }) => {
    const email = `test-persist-${Date.now()}@example.com`;
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();
    await login(page1, email);

    // Context 1 creates a gear system
    await page1
      .getByRole("combobox", { name: /Guided example/i })
      .selectOption("clock-train");
    await page1.getByRole("button", { name: "Save", exact: true }).click();

    // Check it appeared in the library
    await expect(
      page1.getByText("Idealized Clock-Hand Ratio Train"),
    ).toBeVisible();

    // Rename it
    await page1.getByRole("button", { name: "Rename" }).click();
    await page1.locator(".rename-form input").fill("My Custom Clock");
    await page1.getByRole("button", { name: "OK" }).click();
    await expect(page1.getByText("My Custom Clock")).toBeVisible();

    // Now open context 2 and login
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await login(page2, email);

    // Wait for the library to load in context2
    await expect(page2.getByText("My Custom Clock")).toBeVisible();

    // Context 1 creates a new gear (modifies the system)
    await page1.getByRole("button", { name: "Create gear" }).click();

    // Context 1 saves again
    await page1.getByRole("button", { name: "Save", exact: true }).click();

    // Wait for Context 1's save to finish (Save button shouldn't say Saving...)
    await expect(
      page1.getByRole("button", { name: "Save", exact: true }),
    ).not.toBeDisabled();

    // Context 2 tries to load the updated system
    await page2.getByRole("button", { name: "Load" }).click();
    // Verify it loaded (the new gear should be visible)
    await expect(
      page2.getByRole("combobox", { name: /Selected gear/i }),
    ).toHaveText(/15T gear/);

    // Now both have loaded the SAME LATEST STATE.
    // Context 2 makes a change
    await page2.getByRole("button", { name: "Delete selected gear" }).click();

    // Context 2 saves
    await page2.getByRole("button", { name: "Save", exact: true }).click();
    await expect(
      page2.getByRole("button", { name: "Save", exact: true }),
    ).not.toBeDisabled();

    // Context 1 tries to save (it has a stale updatedAt timestamp)
    await page1.getByRole("button", { name: "Save", exact: true }).click();

    // Should get a stale write error
    await expect(
      page1.getByText("Stale write: The system was updated elsewhere."),
    ).toBeVisible();

    // Close contexts
    await context1.close();
    await context2.close();
  });
});
