import { chromium } from 'playwright';

const BASE = process.env.QA_BASE_URL || 'http://127.0.0.1:4173/';
const results = [];

function ok(condition, message) {
  if (!condition) throw new Error(message);
}

async function visible(locator) {
  return await locator.isVisible().catch(() => false);
}

async function assertNoHorizontalOverflow(page, label) {
  const data = await page.evaluate(() => ({
    viewport: innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body?.scrollWidth || 0,
  }));
  const width = Math.max(data.documentWidth, data.bodyWidth);
  ok(width <= data.viewport + 2, `${label}: horizontal overflow (${width}px > ${data.viewport}px)`);
}

const supabaseStub = `
export function createClient() {
  const auth = {
    async getSession() { return { data: { session: null }, error: null }; },
    onAuthStateChange() { return { data: { subscription: { unsubscribe() {} } } }; },
    async signInWithPassword() { return { data: { session: null }, error: { message: 'QA stub: no live sign-in' } }; },
    async signOut() { return { error: null }; }
  };
  return { auth };
}
`;

async function openConsole(page) {
  await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm', async route => {
    await route.fulfill({ status: 200, contentType: 'text/javascript', body: supabaseStub });
  });

  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message || String(error)));
  await page.goto(new URL('orders.html', BASE).href, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(350);
  ok(pageErrors.length === 0, `orders console: uncaught browser error: ${pageErrors.join(' | ')}`);
}

async function testViewport(browser, name, viewport, mobile = false) {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  await openConsole(page);

  const robots = await page.locator('meta[name="robots"]').getAttribute('content');
  ok((robots || '').includes('noindex'), `${name}: order console must remain noindex`);
  ok(await visible(page.locator('#loginShell')), `${name}: admin login shell is not visible`);
  ok(await visible(page.locator('#loginEmail')), `${name}: admin email field missing`);
  ok(await visible(page.locator('#loginPassword')), `${name}: admin password field missing`);
  ok(await visible(page.locator('#loginButton')), `${name}: sign-in button missing`);
  ok(!(await visible(page.locator('#appShell'))), `${name}: order dashboard must not be visible before authentication`);
  await assertNoHorizontalOverflow(page, `${name} login`);

  // Show the authenticated shell only for layout smoke testing. This does
  // not bypass production authentication because it changes DOM locally in
  // the test browser and never calls the restaurant API.
  await page.evaluate(() => {
    document.getElementById('loginShell').style.display = 'none';
    document.getElementById('appShell').classList.add('visible');
  });

  ok(await visible(page.locator('#appShell')), `${name}: dashboard shell could not be rendered for layout QA`);
  ok(await visible(page.locator('#soundButton')), `${name}: sound control missing`);
  ok(await visible(page.locator('#signOutButton')), `${name}: sign-out control missing`);
  ok(await visible(page.locator('#statNew')), `${name}: New-orders stat missing`);
  ok(await visible(page.locator('.oc-tab[data-filter="new"]')), `${name}: New filter missing`);
  ok(await visible(page.locator('.oc-tab[data-filter="preparing"]')), `${name}: Preparing filter missing`);
  ok(await visible(page.locator('.oc-tab[data-filter="ready_for_pickup"]')), `${name}: Ready filter missing`);
  ok(await visible(page.locator('.oc-tab[data-filter="dispatched"]')), `${name}: Dispatched filter missing`);
  ok(await visible(page.locator('.oc-tab[data-filter="delivered"]')), `${name}: Delivered filter missing`);
  ok(await page.locator('#paymentDialog').count() === 1, `${name}: payment confirmation dialog missing`);
  ok(await page.locator('#reasonDialog').count() === 1, `${name}: reject/cancel reason dialog missing`);
  ok(await page.locator('#deliveryDialog').count() === 1, `${name}: delivery assignment dialog missing`);
  await assertNoHorizontalOverflow(page, `${name} dashboard shell`);

  await ctx.close();
}

const browser = await chromium.launch({ headless: true });
let failed = false;
for (const [name, viewport, mobile] of [
  ['desktop', { width: 1440, height: 960 }, false],
  ['tablet', { width: 820, height: 1180 }, false],
  ['mobile', { width: 390, height: 844 }, true],
]) {
  try {
    await testViewport(browser, name, viewport, mobile);
    results.push(`PASS ${name}`);
  } catch (error) {
    failed = true;
    results.push(`FAIL ${name}: ${error.message}`);
  }
}
await browser.close();

console.log('TCB ORDER CONSOLE QA');
console.log('='.repeat(72));
for (const line of results) console.log(line);
console.log('\nRESULT:', failed ? 'FAIL' : 'PASS');
if (failed) process.exit(1);
