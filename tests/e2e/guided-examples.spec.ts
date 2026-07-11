import { expect, test } from "@playwright/test";

test("switches guided examples with dirty-state protection", async ({
  page,
}) => {
  await page.goto("/");

  // Default example is the idealized clock-hand ratio train.
  await expect(
    page.getByRole("heading", { name: "Base-60 Gear Visualizer" }),
  ).toBeVisible();
  const explanation = page.getByRole("region", {
    name: "Guided example explanation",
  });
  await expect(
    explanation.getByRole("heading", {
      name: "Idealized Clock-Hand Ratio Train",
    }),
  ).toBeVisible();
  await expect(page.getByText("8 gears · 7 links")).toBeVisible();

  // Start playback so switching can prove it stops.
  await page.getByRole("button", { name: "Play" }).click();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();

  // Switch to harmonic divisions through the accessible selector.
  const selector = page.getByRole("combobox", { name: "Guided example" });
  await selector.selectOption("harmonic-divisions");

  await expect(
    page.getByRole("heading", { name: "Base-60 Gear Visualizer" }),
  ).toBeVisible();
  await expect(page.getByLabel("Simulator tools")).toBeVisible();
  await expect(page.getByLabel("Gear settings and telemetry")).toBeVisible();
  await expect(
    page.getByText("Harmonic Divisions of 60 · 4 gears"),
  ).toBeVisible();
  await expect(
    explanation.getByText(
      "All three divisions are exact because 30, 20, and 15 divide 60 evenly",
    ),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Play" })).toBeVisible();

  // Make the system dirty by adding a gear.
  await page.getByRole("button", { name: "Create gear" }).click();
  await expect(
    page.getByText("Harmonic Divisions of 60 · 5 gears"),
  ).toBeVisible();

  // Cancel the confirmation: the current system must remain.
  page.once("dialog", (dialog) => dialog.dismiss());
  await selector.selectOption("compound-axle");
  await expect(
    page.getByText("Harmonic Divisions of 60 · 5 gears"),
  ).toBeVisible();
  await expect(selector).toHaveValue("harmonic-divisions");

  // Accept the confirmation: the new system loads fresh.
  page.once("dialog", (dialog) => dialog.accept());
  await selector.selectOption("compound-axle");
  await expect(
    page.getByText("Compound Axle Multiplication · 4 gears"),
  ).toBeVisible();
  await expect(
    explanation.getByText("Compound gears share one axle, RPM, and direction"),
  ).toBeVisible();
  await expect(selector).toHaveValue("compound-axle");
});
