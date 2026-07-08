import { expect, test } from "@playwright/test";

test("renders the simulator and toggles playback", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Base-60 Gear Visualizer" }),
  ).toBeVisible();
  await expect(page.getByLabel("Simulator tools")).toBeVisible();
  await expect(page.getByLabel("Gear settings and telemetry")).toBeVisible();

  await page.getByRole("button", { name: "Play" }).click();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
});
