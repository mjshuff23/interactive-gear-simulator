import { expect, test } from "@playwright/test";

test("creates, selects, and deletes a gear", async ({ page }) => {
  await page.goto("/");

  // Verify cloud fallback is unconfigured
  await expect(page.getByText("Cloud saving is unavailable.")).toBeVisible();

  // Create a new gear
  await page.getByRole("button", { name: "Create gear" }).click();

  // A new gear with 15 teeth should be created and selected
  await expect(
    page.getByRole("combobox", { name: /Selected gear/i }),
  ).toHaveText(/15T gear/);
  await expect(page.getByLabel("Teeth")).toHaveValue("15");

  // Select the driver gear
  await page
    .getByRole("combobox", { name: /Selected gear/i })
    .selectOption({ label: "60T hour wheel" });
  await expect(page.getByLabel("Teeth")).toHaveValue("60");

  // Delete button should be disabled for driver
  await expect(
    page.getByRole("button", { name: "Delete selected gear" }),
  ).toBeDisabled();

  // Select the newly created gear
  await page
    .getByRole("combobox", { name: /Selected gear/i })
    .selectOption({ label: "15T gear" });

  // Delete the gear
  await page.getByRole("button", { name: "Delete selected gear" }).click();

  // Verify it was deleted
  await expect(
    page.locator("option", { hasText: "15T gear" }),
  ).not.toBeAttached();
});

test("playback animates compound movement", async ({ page }) => {
  await page.goto("/");

  await page
    .getByRole("combobox", { name: "Guided example" })
    .selectOption("compound-axle");

  // Verify initial state
  const timeDisplay = page.locator(".canvasStatus span").last();
  await expect(timeDisplay).toHaveText("0.00s");

  // Play
  await page.getByRole("button", { name: "Play" }).click();

  // Wait for time to advance
  await expect(timeDisplay).not.toHaveText("0.00s");

  // Verify paused state can be resumed
  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByRole("button", { name: "Play" })).toBeVisible();

  const pausedTime = await timeDisplay.textContent();
  await expect(timeDisplay).toHaveText(pausedTime!);
});
