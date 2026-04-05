import { test, expect } from "@playwright/test";

test.describe("Simulateur de rentabilite", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/simulateur");
    await page.waitForSelector("h1");
  });

  test("affiche les resultats par defaut", async ({ page }) => {
    // Default: prixAchat=200000, loyerMensuel=800
    // Rendement brut = (800*12) / 200000 * 100 = 4.80%
    const body = await page.locator("body").textContent();
    expect(body).toContain("4.80");
  });

  test("les resultats changent quand on modifie le prix d achat", async ({ page }) => {
    // Verify initial state
    let body = await page.locator("body").textContent();
    expect(body).toContain("4.80");

    // Find prix d'achat input (first number input on the page)
    const prixInput = page.locator('input[type="number"]').first();
    await expect(prixInput).toHaveValue("200000");

    // Change prix d'achat to 100000
    await prixInput.fill("100000");
    await page.waitForTimeout(300);

    // Rendement brut should now be (800*12) / 100000 * 100 = 9.60%
    body = await page.locator("body").textContent();
    expect(body).toContain("9.60");
    expect(body).not.toContain("4.80");
  });

  test("les resultats changent quand on modifie le loyer", async ({ page }) => {
    const loyerInput = page.locator('label:has-text("Loyer mensuel") + input');
    // Fallback: find by looking at all number inputs
    const allInputs = page.locator('input[type="number"]');

    // Loyer is the 4th input (prix, frais notaire, travaux, loyer)
    const loyer = allInputs.nth(3);
    await expect(loyer).toHaveValue("800");

    await loyer.fill("1200");
    await page.waitForTimeout(300);

    // Rendement brut = (1200*12) / 200000 * 100 = 7.20%
    const body = await page.locator("body").textContent();
    expect(body).toContain("7.20");
  });

  test("changer le regime fiscal IR/IS modifie les resultats", async ({ page }) => {
    // First, set a high loyer so that taxable income is positive
    // (default values generate negative taxable income → no tax in both regimes)
    const allInputs = page.locator('input[type="number"]');
    const loyerInput = allInputs.nth(3);
    await loyerInput.fill("2000");

    // Also reduce loan to 0 to ensure positive cash flow
    const empruntInput = allInputs.nth(6);
    await empruntInput.fill("0");
    await page.waitForTimeout(300);

    // Get IR rendement net-net
    let body = await page.locator("body").textContent();
    const getNetNet = (text: string | null) => {
      const match = text?.match(/net-net([\d.\-\s%]+)/);
      return match?.[1]?.trim();
    };
    const irNetNet = getNetNet(body);

    // Switch regime to IS
    const regimeSelect = page.locator("select").nth(1);
    await regimeSelect.selectOption("IS");
    await page.waitForTimeout(300);

    body = await page.locator("body").textContent();
    const isNetNet = getNetNet(body);

    console.log(`IR net-net: "${irNetNet}", IS net-net: "${isNetNet}"`);
    expect(isNetNet).not.toEqual(irNetNet);

    // Also verify IS-specific fields appear
    await expect(page.locator('label:has-text("Amortissement immobilier")')).toBeVisible();
  });

  test("le cash flow change quand on modifie les charges", async ({ page }) => {
    // Get initial cash flow text
    let body = await page.locator("body").textContent();
    const getCashFlowValue = (text: string | null) => {
      const match = text?.match(/Cash flow mensuel \(avant impot\)([\d\s€.\-]+)/);
      return match?.[1]?.trim();
    };

    const initialCF = getCashFlowValue(body);

    // Taxe fonciere input - find it by index
    // Inputs order: prix, frais%, travaux, loyer, autres_revenus, vacance%,
    //               emprunt, taux%, duree, assurance_pret,
    //               copro, taxe_fonciere (index 11)
    const allInputs = page.locator('input[type="number"]');
    const taxeInput = allInputs.nth(11);

    const currentValue = await taxeInput.inputValue();
    console.log("Current taxe fonciere value:", currentValue);

    await taxeInput.fill("5000");
    await page.waitForTimeout(300);

    body = await page.locator("body").textContent();
    const newCF = getCashFlowValue(body);

    console.log(`Initial CF: "${initialCF}", New CF: "${newCF}"`);
    expect(newCF).not.toEqual(initialCF);
  });
});
