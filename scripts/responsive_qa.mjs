import { chromium } from 'playwright';

const BASE = process.env.QA_BASE_URL || 'http://127.0.0.1:4173/';
const results = [];

function ok(condition, message) {
  if (!condition) throw new Error(message);
}

async function visible(locator) {
  return await locator.isVisible().catch(() => false);
}

async function goto(page, path) {
  const errors = [];
  const onError = error => errors.push(error.message || String(error));
  page.on('pageerror', onError);
  await page.goto(new URL(path, BASE).href, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(250);
  page.off('pageerror', onError);
  ok(errors.length === 0, `${path}: uncaught browser error: ${errors.join(' | ')}`);
}

async function assertNoHorizontalOverflow(page, label) {
  const m = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body?.scrollWidth || 0,
  }));
  const widest = Math.max(m.scrollWidth, m.bodyScrollWidth);
  ok(widest <= m.innerWidth + 2, `${label}: horizontal overflow (${widest}px > ${m.innerWidth}px)`);
}

async function assertDesktopNavCentered(page, label) {
  const nav = page.locator('.nav-links');
  ok(await visible(nav), `${label}: desktop nav is not visible`);
  const box = await nav.boundingBox();
  ok(box, `${label}: desktop nav has no layout box`);
  const width = await page.evaluate(() => innerWidth);
  const center = box.x + box.width / 2;
  ok(Math.abs(center - width / 2) <= 4, `${label}: nav is not viewport-centered (${center.toFixed(1)} vs ${(width / 2).toFixed(1)})`);
}

async function testDesktop(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();

  for (const path of ['index.html', 'menu.html', 'our-story.html', 'order.html', 'bulk-order.html']) {
    await goto(page, path);
    await assertNoHorizontalOverflow(page, `desktop ${path}`);
    if (await page.locator('.nav-links').count()) await assertDesktopNavCentered(page, `desktop ${path}`);
  }

  await goto(page, 'menu.html');

  // Category nav and search/filter behavior.
  const search = page.locator('#menuSearch');
  ok(await visible(search), 'menu desktop: search field not visible');
  await search.fill('Paneer Chilli');
  await page.waitForTimeout(120);
  const visibleRowsAfterSearch = await page.locator('.menu-row:visible').count();
  ok(visibleRowsAfterSearch > 0, 'menu desktop: search hides every row');
  const visibleNames = await page.locator('.menu-row:visible .menu-row-name').allTextContents();
  ok(visibleNames.some(t => t.toLowerCase().includes('paneer chilli')), 'menu desktop: expected Paneer Chilli result not visible');
  await search.fill('');

  const combosPill = page.locator('.cat-pill[href="#cat-combos"]');
  ok(await visible(combosPill), 'menu desktop: Combos category pill missing');
  await combosPill.click();
  await page.waitForTimeout(120);
  ok((await page.evaluate(() => location.hash)) === '#cat-combos', 'menu desktop: Combos category navigation did not update hash');

  // Custom combo picker must be present, open, and stay synchronized with native select.
  const nativeSelects = page.locator('#cat-combos select.combo-select');
  const pickerTriggers = page.locator('#cat-combos .combo-picker-trigger');
  const selectCount = await nativeSelects.count();
  ok(selectCount > 0, 'menu desktop: no combo native selects found');
  ok(await pickerTriggers.count() === selectCount, `menu desktop: combo picker count mismatch (${await pickerTriggers.count()} vs ${selectCount})`);

  const firstSelect = nativeSelects.first();
  const firstTrigger = pickerTriggers.first();
  const before = await firstSelect.inputValue();
  await firstTrigger.click();
  ok(await page.locator('#cat-combos .combo-picker.open').count() === 1, 'menu desktop: custom combo dropdown did not open');
  const options = page.locator('#cat-combos .combo-picker.open .combo-picker-option');
  ok(await options.count() >= 2, 'menu desktop: combo dropdown does not expose multiple options');
  await options.nth(1).click();
  const after = await firstSelect.inputValue();
  ok(after !== before, 'menu desktop: custom combo selection did not update native select');
  ok((await firstTrigger.getAttribute('aria-expanded')) === 'false', 'menu desktop: combo dropdown did not close after selection');

  // Quantity -> cart -> checkout drawer.
  const firstNormalRow = page.locator('.menu-row:not(.combo-row)').first();
  const qty = firstNormalRow.locator('.qty-display');
  await firstNormalRow.locator('.qty-plus').click();
  ok(await qty.inputValue() === '1', 'menu desktop: quantity plus did not increment to 1');
  ok(await page.locator('#cartBar').evaluate(el => el.classList.contains('visible')), 'menu desktop: cart bar did not appear');
  ok((await page.locator('#cartBarCount').textContent()).includes('1 item'), 'menu desktop: cart count did not update');

  await page.locator('#cartBarInner').click();
  ok(await page.locator('#drawer').evaluate(el => el.classList.contains('open')), 'menu desktop: cart drawer did not open');
  ok(await page.locator('#stepCart').evaluate(el => el.classList.contains('active')), 'menu desktop: cart step not active');
  await page.locator('#btnToAddress').click();
  ok(await page.locator('#stepAddress').evaluate(el => el.classList.contains('active')), 'menu desktop: address step not active');

  // Validation: invalid phone and too-short address must be rejected.
  await page.locator('#custName').fill('QA Test');
  await page.locator('#custPhone').fill('1234567890');
  await page.locator('#custAddress').fill('Short address');
  await page.locator('#btnPlaceOrder').click();
  await page.waitForTimeout(100);
  ok(await page.locator('#custPhoneError').evaluate(el => el.classList.contains('visible')), 'menu desktop: invalid phone not rejected');
  ok(await page.locator('#custAddressError').evaluate(el => el.classList.contains('visible')), 'menu desktop: short address not rejected');

  // Payment state UI, without submitting any order.
  await page.evaluate(() => { if (typeof showStep === 'function') showStep('stepPayment'); });
  ok(await page.locator('#stepPayment').evaluate(el => el.classList.contains('active')), 'menu desktop: payment step could not be shown for QA');
  await page.locator('.pay-method-btn[data-method="cod"]').click();
  ok(await page.locator('.pay-method-btn[data-method="cod"]').evaluate(el => el.classList.contains('active')), 'menu desktop: COD toggle did not activate');
  ok(await page.locator('#payCodWrap').evaluate(el => getComputedStyle(el).display !== 'none'), 'menu desktop: COD panel did not become visible');
  ok(await page.locator('#payUpiWrap').evaluate(el => getComputedStyle(el).display === 'none'), 'menu desktop: UPI panel stayed visible in COD mode');
  await page.locator('.pay-method-btn[data-method="upi"]').click();
  ok(await page.locator('#payUpiWrap').evaluate(el => getComputedStyle(el).display !== 'none'), 'menu desktop: UPI panel did not return');

  // Bulk order core interaction.
  await goto(page, 'bulk-order.html');
  const bulkFirst = page.locator('.menu-row').first();
  const bulkQty = bulkFirst.locator('.qty-display');
  await bulkFirst.locator('.qty-plus').click();
  ok(await bulkQty.inputValue() === '1', 'bulk desktop: quantity plus did not increment');
  ok(await page.locator('#cartBar').evaluate(el => el.classList.contains('visible')), 'bulk desktop: cart bar did not appear');
  await page.locator('#cartBarInner').click();
  ok(await page.locator('#drawer').evaluate(el => el.classList.contains('open')), 'bulk desktop: drawer did not open');

  await ctx.close();
}

async function testTablet(browser) {
  const ctx = await browser.newContext({ viewport: { width: 820, height: 1180 } });
  const page = await ctx.newPage();
  for (const path of ['index.html', 'menu.html', 'our-story.html', 'order.html', 'bulk-order.html']) {
    await goto(page, path);
    await assertNoHorizontalOverflow(page, `tablet ${path}`);
  }
  await ctx.close();
}

async function testMobile(browser) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();

  for (const path of ['index.html', 'menu.html', 'our-story.html', 'order.html', 'bulk-order.html']) {
    await goto(page, path);
    await assertNoHorizontalOverflow(page, `mobile ${path}`);
  }

  // Mobile navbar completeness and open/close behavior.
  await goto(page, 'index.html');
  ok(await visible(page.locator('#ham')), 'mobile home: hamburger not visible');
  ok(!(await visible(page.locator('.nav-links'))), 'mobile home: desktop nav should be hidden');
  await page.locator('#ham').click();
  ok(await page.locator('#mobileNav').evaluate(el => el.classList.contains('open')), 'mobile home: mobile nav did not open');
  const navTexts = (await page.locator('#mobileNav > a').allTextContents()).map(t => t.trim());
  for (const label of ['Home', 'Menu', 'Contact', 'Our Story']) {
    ok(navTexts.includes(label), `mobile home: missing ${label} navigation link`);
  }
  const actionTexts = (await page.locator('#mobileNav .mnav-btns a').allTextContents()).map(t => t.trim());
  ok(actionTexts.includes('Bulk Order'), 'mobile home: missing Bulk Order CTA');
  ok(actionTexts.includes('Order Online'), 'mobile home: missing Order Online CTA');

  // Menu controls and combo dropdown must fit the viewport on mobile.
  await goto(page, 'menu.html');
  ok(await visible(page.locator('#menuSearch')), 'mobile menu: search field not visible');
  await page.locator('.cat-pill[href="#cat-combos"]').click();
  await page.waitForTimeout(120);
  const trigger = page.locator('#cat-combos .combo-picker-trigger').first();
  ok(await visible(trigger), 'mobile menu: combo picker trigger not visible');
  await trigger.click();
  const openMenu = page.locator('#cat-combos .combo-picker.open .combo-picker-menu');
  ok(await visible(openMenu), 'mobile menu: combo dropdown did not open');
  const box = await openMenu.boundingBox();
  ok(box, 'mobile menu: combo dropdown has no layout box');
  ok(box.x >= -1 && box.x + box.width <= 391, `mobile menu: combo dropdown exceeds viewport (${box.x}, ${box.width})`);
  await page.keyboard.press('Escape');

  // Mobile quantity/cart interaction.
  const firstNormalRow = page.locator('.menu-row:not(.combo-row)').first();
  await firstNormalRow.locator('.qty-plus').click();
  ok(await firstNormalRow.locator('.qty-display').inputValue() === '1', 'mobile menu: quantity plus failed');
  ok(await page.locator('#cartBar').evaluate(el => el.classList.contains('visible')), 'mobile menu: cart bar did not appear');
  await page.locator('#cartBarInner').click();
  ok(await page.locator('#drawer').evaluate(el => el.classList.contains('open')), 'mobile menu: drawer did not open');
  await assertNoHorizontalOverflow(page, 'mobile menu with drawer open');

  await ctx.close();
}

const browser = await chromium.launch({ headless: true });
let failed = false;
for (const [name, fn] of [['desktop', testDesktop], ['tablet', testTablet], ['mobile', testMobile]]) {
  try {
    await fn(browser);
    results.push(`PASS ${name}`);
  } catch (error) {
    failed = true;
    results.push(`FAIL ${name}: ${error.message}`);
  }
}
await browser.close();

console.log('TCB RESPONSIVE + INTERACTION QA');
console.log('='.repeat(72));
for (const line of results) console.log(line);
console.log('\nRESULT:', failed ? 'FAIL' : 'PASS');
if (failed) process.exit(1);
