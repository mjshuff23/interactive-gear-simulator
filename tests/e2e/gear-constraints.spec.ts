import { expect, test, type Locator, type Page } from "@playwright/test";

const CANVAS_WIDTH = 820;
const CANVAS_HEIGHT = 620;

test("breaks, stops, and re-snaps an existing guided mesh", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("combobox", { name: "Guided example" })
    .selectOption("harmonic-divisions");

  await expect(
    page.getByRole("status", { name: "Connection status" }),
  ).toHaveText("All 3 connections valid");
  await expect(resolvedRpm(page)).toHaveText("4.00");

  const canvas = page.locator(".gearCanvas canvas");
  await dragCanvasPoint(
    page,
    canvas,
    { x: 300, y: 412.5 },
    { x: 400, y: 412.5 },
  );

  await expect(
    page.getByRole("status", { name: "Connection status" }),
  ).toHaveText("1 broken connection");
  await expect(page.getByText(/reference-60--quarter-15/)).toBeVisible();
  await expect(page.getByText(/expected 112\.50 px, actual/)).toBeVisible();
  await expect(resolvedRpm(page)).toHaveText("0.00");

  await dragCanvasPoint(
    page,
    canvas,
    { x: 400, y: 412.5 },
    { x: 310, y: 412.5 },
  );

  await expect(
    page.getByRole("status", { name: "Connection status" }),
  ).toHaveText("All 3 connections valid");
  await expect(resolvedRpm(page)).toHaveText("4.00");

  page.once("dialog", (dialog) => dialog.dismiss());
  await page
    .getByRole("combobox", { name: "Guided example" })
    .selectOption("compound-axle");
  await expect(
    page.getByText("Harmonic Divisions of 60 · 4 gears"),
  ).toBeVisible();
});

test("derives pitch radius from teeth without moving the gear", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("combobox", { name: "Guided example" })
    .selectOption("harmonic-divisions");

  await page.getByLabel("Teeth").fill("16");

  await expect(
    page.getByText("Pitch radius").locator("..").locator("output"),
  ).toHaveText("24.00 px");
  await expect(
    page.getByRole("status", { name: "Connection status" }),
  ).toHaveText("1 broken connection");
  await expect(resolvedRpm(page)).toHaveText("0.00");
});

function resolvedRpm(page: Page): Locator {
  return page.getByText("Resolved RPM").locator("..").locator("strong");
}

async function dragCanvasPoint(
  page: Page,
  canvas: Locator,
  start: { x: number; y: number },
  end: { x: number; y: number },
) {
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();

  if (!box) {
    throw new Error("Gear canvas is not visible.");
  }

  const toPagePoint = (point: { x: number; y: number }) => ({
    x: box.x + (point.x / CANVAS_WIDTH) * box.width,
    y: box.y + (point.y / CANVAS_HEIGHT) * box.height,
  });
  const startPoint = toPagePoint(start);
  const endPoint = toPagePoint(end);

  await page.mouse.move(startPoint.x, startPoint.y);
  await page.mouse.down();
  await page.mouse.move(endPoint.x, endPoint.y, { steps: 8 });
  await page.mouse.up();
}
