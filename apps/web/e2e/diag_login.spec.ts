import { test } from "@playwright/test";

test("diagnose login", async ({ page }) => {
  // CSRF
  const csrfResp = await page.request.get("/api/auth/csrf");
  const { token: csrf } = await csrfResp.json();
  console.log("CSRF OK");

  // Login API
  const loginResp = await page.request.post("/api/auth/login", {
    headers: { "x-csrf-token": csrf, "content-type": "application/json" },
    data: { email: "acemang@gmail.com", password: "Teste1234!@" },
  });
  console.log("API login status:", loginResp.status());
  console.log("API login body:", (await loginResp.text()).substring(0, 400));

  if (loginResp.ok()) {
    // Me
    const me = await page.request.get("/api/auth/me");
    console.log("Me status:", me.status(), await me.json());

    // Navegar via browser (cookies do browser context)
    await page.goto("/super/dashboard");
    await page.waitForLoadState("networkidle", { timeout: 15000 });
    console.log("URL:", page.url());
    console.log("Title:", await page.title());
    const html = await page.content();
    console.log("HTML snippet:", html.substring(0, 600));
  }
});
