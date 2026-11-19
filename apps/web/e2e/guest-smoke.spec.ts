import { expect, test } from "@playwright/test";

test.describe("Pulse Call guest smoke", () => {
  test("boots brand and call controls", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Pulse Call" })).toBeVisible();
    await expect(page.getByRole("button", { name: "UP" })).toBeVisible();
    await expect(page.getByRole("button", { name: "DOWN" })).toBeVisible();
  });
});
