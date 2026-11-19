import { expect, test } from "@playwright/test";

test.describe("Pulse Call visual smoke", () => {
  test("captures first viewport", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Pulse Call" })).toBeVisible();
    await page.screenshot({ path: "test-results/pulse-call-home.png", fullPage: true });
  });
});
