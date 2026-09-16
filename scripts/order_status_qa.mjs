import { chromium } from 'playwright';

const baseURL = process.env.QA_BASE_URL || 'http://127.0.0.1:4173/';
const viewports = [
  ['desktop', { width: 1440, height: 900 }],
  ['tablet', { width: 820, height: 900 }],
  ['mobile', { width: 390, height: 844 }],
];

const mockOrder = {
  success: true,
  order: {
    order_number: 'TCB-TEST-1042',
    created_at: new Date().toISOString(),
    order_status: 'preparing',
    payment_status: 'paid',
    payment_method: 'upi',
    subtotal: 410,
    discount: 0,
    delivery_fee: 50,
    total: 460,
    delivery_slot: 'ASAP (35–50 min)',
    estimated_delivery_from: null,
    estimated_delivery_to: null,
    delivery_provider: null,
    tracking_url: null,
    accepted_at: new Date().toISOString(),
    preparing_at: new Date().toISOString(),
    ready_at: null,
    rider_assigned_at: null,
    dispatched_at: null,
    delivered_at: null,
    rejected_at: null,
    rejection_reason: null,
    cancelled_at: null,
    cancellation_reason: null,
    items: [
      { product_name: 'Veg Hakka Noodles', quantity: 1, unit_price: 190, line_total: 190 },
      { product_name: 'Chicken Chilli', quantity: 1, unit_price: 220, line_total: 220 },
    ],
  },
  server_time: new Date().toISOString(),
};

const browser = await chromium.launch({ headless: true });
const failures = [];

for (const [name, viewport] of viewports) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();

  await page.route('**/functions/v1/order-status', async (route) => {
    const request = route.request();
    let payload = {};
    try { payload = request.postDataJSON(); } catch {}

    if (payload.order_number === 'TCB-TEST-1042' && payload.phone === '9876543219') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockOrder),
      });
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, message: 'Order not found. Check the order number and mobile number and try again.' }),
    });
  });

  try {
    await page.goto(`${baseURL}order-status.html?order=TCB-TEST-1042`, { waitUntil: 'domcontentloaded' });
    await page.fill('#trackPhone', '9876543219');
    await page.click('#trackSubmit');
    await page.waitForSelector('#trackResult.visible');

    const orderNumber = await page.textContent('#resultOrderNumber');
    if (!orderNumber?.includes('TCB-TEST-1042')) throw new Error('Order number did not render.');

    const status = await page.textContent('#resultStatus');
    if (status?.trim() !== 'Preparing') throw new Error(`Expected Preparing status, got ${status}.`);

    const payment = await page.textContent('#resultPayment');
    if (payment?.trim() !== 'Payment Confirmed') throw new Error(`Expected confirmed payment, got ${payment}.`);

    const preparing = page.locator('.track-step[data-status="preparing"]');
    if (!(await preparing.evaluate((el) => el.classList.contains('current')))) {
      throw new Error('Preparing step is not the current timeline state.');
    }

    const itemCount = await page.locator('#resultItems .track-item').count();
    if (itemCount !== 2) throw new Error(`Expected 2 item rows, got ${itemCount}.`);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 1) throw new Error(`Horizontal overflow detected: ${overflow}px.`);

    console.log(`PASS ${name}`);
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
    console.error(`FAIL ${name}: ${error.message}`);
  } finally {
    await context.close();
  }
}

await browser.close();

console.log('\nTCB CUSTOMER ORDER STATUS QA');
console.log('========================================================================');
if (failures.length) {
  failures.forEach((failure) => console.error(failure));
  console.error('\nRESULT: FAIL');
  process.exit(1);
}
console.log('\nRESULT: PASS');
