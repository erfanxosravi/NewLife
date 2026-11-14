import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE_URL = process.env.E2E_URL || 'http://localhost:3000';
const EXEC_PATH = '/ms-playwright/chrome-headless-shell-linux64/chrome-headless-shell';
const SHOT_DIR = path.resolve(
  '.aistudio/artifacts/brain/b45dabeb-e0eb-47eb-a65d-10c17ddda0b1/screenshots/money',
);

fs.mkdirSync(SHOT_DIR, { recursive: true });

const VIEWPORTS = [
  { name: '360', width: 360, height: 800 },
  { name: '390', width: 390, height: 844 },
  { name: '768', width: 768, height: 1024 },
];

async function assertCleanScreen(page, label) {
  const result = await page.evaluate(() => {
    const sw = document.documentElement.scrollWidth;
    const cw = document.documentElement.clientWidth;
    const topDialog = Array.from(document.querySelectorAll('[role="dialog"]')).pop();
    const root = topDialog ?? document.body;
    const text = root.innerText || '';
    const englishMatch = text.match(/[A-Za-z]{2,}/g);

    const nestedScrolls = [];
    if (topDialog) {
      const candidates = topDialog.querySelectorAll('div, section');
      for (const el of candidates) {
        const cs = getComputedStyle(el);
        const isMainDialogBody = el.classList.contains('flex-1') && cs.overflowY === 'auto';
        if (isMainDialogBody) continue;
        if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 4) {
          nestedScrolls.push(`${el.tagName}.${el.className.slice(0, 40)} (${el.scrollHeight}/${el.clientHeight})`);
        }
      }
    }

    const tinyTexts = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (!node.nodeValue || !node.nodeValue.trim()) continue;
      const el = node.parentElement;
      if (!el) continue;
      if (el.closest('[aria-hidden="true"]') || el.closest('svg')) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const fontSize = parseFloat(cs.fontSize);
      if (!Number.isNaN(fontSize) && fontSize < 11.9) {
        tinyTexts.push(`${el.tagName} (${fontSize.toFixed(1)}px): "${node.nodeValue.trim().slice(0, 24)}"`);
      }
    }

    return {
      overflow: sw > cw ? `${sw}>${cw}` : null,
      english: englishMatch,
      nestedScrolls,
      tinyTexts: tinyTexts.slice(0, 5),
      hasNaN: /\bNaN\b|\bInfinity\b/.test(text),
    };
  });

  if (result.overflow) throw new Error(`Horizontal overflow at ${label}: ${result.overflow}`);
  if (result.english && result.english.length > 0) {
    throw new Error(`English text found at ${label}: ${result.english.join(', ')}`);
  }
  if (result.nestedScrolls.length > 0) {
    throw new Error(`Nested scrollbars at ${label}: ${result.nestedScrolls.join('; ')}`);
  }
  if (result.tinyTexts.length > 0) {
    throw new Error(`Sub-12px text at ${label}: ${result.tinyTexts.join('; ')}`);
  }
  if (result.hasNaN) {
    throw new Error(`NaN/Infinity text found at ${label}`);
  }
}

async function resolveEventIfOpen(page) {
  for (let i = 0; i < 4; i++) {
    const overlay = page.locator('[data-testid="year-transition-overlay"]');
    if ((await overlay.count()) > 0) {
      await overlay.click().catch(() => {});
      await overlay.waitFor({ state: 'detached', timeout: 1500 }).catch(() => {});
    }
    const eventChoice = page.locator('[role="dialog"] .space-y-2 button').first();
    if ((await eventChoice.count()) > 0) {
      await eventChoice.click().catch(() => {});
      await page.waitForTimeout(80);
    }
    const contBtn = page.locator('[role="dialog"] button:has-text("ادامه")').first();
    if ((await contBtn.count()) > 0) {
      await contBtn.click().catch(() => {});
      await page.waitForTimeout(80);
    }
    if ((await page.locator('[role="dialog"]').count()) === 0) break;
    await page.waitForTimeout(100);
  }
}

async function closeTopDialog(page) {
  const closeBtn = page.locator('[role="dialog"] button[aria-label="بازگشت"], [role="dialog"] button[aria-label="بستن"]').last();
  if ((await closeBtn.count()) > 0) {
    await closeBtn.click();
    await page.waitForTimeout(150);
  }
}

async function closeAllDialogs(page) {
  for (let i = 0; i < 10; i++) {
    const closeBtn = page
      .locator('[role="dialog"] button[aria-label="بازگشت"], [role="dialog"] button[aria-label="بستن"]')
      .last();
    if ((await closeBtn.count()) === 0) break;
    await closeBtn.click().catch(() => {});
    await page.waitForTimeout(160);
  }
}

async function setTheme(page, mode) {
  await page.click('button[aria-label="منو و تنظیمات"]');
  await page.waitForSelector('text=ظاهر برنامه');
  await page.click('text=ظاهر برنامه');
  await page.click(mode === 'dark' ? 'text=تیره (زغالی گرم)' : 'text=روشن (نارنجی و سفید)');
  await closeAllDialogs(page);
}

async function verifyMoneyFlows(browser, vp, theme) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    locale: 'fa-IR',
  });
  const page = await context.newPage();
  const errors = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
  });
  page.on('pageerror', (err) => {
    errors.push(`pageerror: ${err.message}`);
  });

  // 1. Styleguide money showcase
  await page.goto(`${BASE_URL}/styleguide`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="exchange-rate-strip"]');
  if (theme === 'dark') {
    const darkBtn = page.locator('header button:has-text("تیره")');
    if ((await darkBtn.count()) > 0) await darkBtn.click();
  }
  await assertCleanScreen(page, `${vp.name}-${theme}-styleguide`);

  // 2. Start life & advance to age 19 with fast animation
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.click('button:has-text("شروع زندگی")');
  await page.waitForSelector('button[aria-label="سال بعد"]');

  if (theme === 'dark') {
    await setTheme(page, 'dark');
  }
  await page.click('button[aria-label="منو و تنظیمات"]');
  await page.click('text=تجربه و انیمیشن');
  await page.click('button[role="tab"]:has-text("سریع")');
  await closeAllDialogs(page);

  for (let yr = 0; yr < 19; yr++) {
    await resolveEventIfOpen(page);
    const nextBtn = page.locator('button[aria-label="سال بعد"]');
    await nextBtn.waitFor({ state: 'visible', timeout: 5000 });
    await nextBtn.click();
    await page.waitForTimeout(160);
    await resolveEventIfOpen(page);
  }

  // 3. Header Money Sheet + Currency Calculator
  await page.click('button[aria-label="مشاهده دارایی‌ها و نقدینگی"]');
  await page.waitForSelector('text=کیف‌پول و ارز نمایش');
  await assertCleanScreen(page, `${vp.name}-${theme}-header-money-sheet`);
  if (vp.name === '390') {
    await page.screenshot({ path: path.join(SHOT_DIR, `header-money-sheet-${theme}-${vp.name}.png`) });
  }

  await page.click('[data-testid="header-open-calculator-btn"]');
  await page.waitForSelector('text=ماشین‌حساب ارز و نرخ تبدیل');
  await page.fill('#calc-amount-input', '۴۵۰');
  await page.waitForTimeout(80);
  const calcText = await page.locator('[role="dialog"]').last().innerText();
  if (!calcText.includes('یورو') || !calcText.includes('تومان')) {
    throw new Error(`Currency calculator missing dual currency labels (${vp.name}-${theme})`);
  }
  await assertCleanScreen(page, `${vp.name}-${theme}-currency-calculator`);
  if (vp.name === '390' || vp.name === '360') {
    await page.screenshot({ path: path.join(SHOT_DIR, `currency-calculator-${theme}-${vp.name}.png`) });
  }
  await closeTopDialog(page);

  // 4. Activities -> Travel & Emigration Hub -> Travel tab (ExchangeRateStrip + Dual Money + Popover + Pay-From)
  await page.click('button:has-text("فعالیت‌ها")');
  await page.waitForSelector('text=سفر خارجی و مهاجرت');
  await page.locator('[role="dialog"] button:has-text("سفر خارجی و مهاجرت")').first().click();
  await page.waitForSelector('text=کشورهای مقصد مهاجرت');

  // Emigration tab screenshot & dual currency check
  await page.waitForSelector('[data-testid="exchange-rate-strip"]');
  await assertCleanScreen(page, `${vp.name}-${theme}-emigration-rates`);
  if (vp.name === '390') {
    await page.screenshot({ path: path.join(SHOT_DIR, `emigration-dual-${theme}-${vp.name}.png`) });
  }

  // Switch to Travel sub-tab
  await page.locator('[role="dialog"] button[role="tab"]:has-text("سفر خارجی")').last().click();
  await page.waitForSelector('text=انتخاب مقصد سفر کوتاه');
  await page.waitForSelector('[data-testid="exchange-rate-strip"]');
  await page.waitForSelector('[data-testid="affordability-badge"]');

  const travelText = await page.locator('[role="dialog"]').last().innerText();
  if (!travelText.includes('≈') || !travelText.includes('تومان')) {
    throw new Error(`Travel card missing Toman equivalent (${vp.name}-${theme})`);
  }
  await assertCleanScreen(page, `${vp.name}-${theme}-travel-dual`);
  await page.screenshot({ path: path.join(SHOT_DIR, `travel-dual-${theme}-${vp.name}.png`) });

  // Tap foreign MoneyText to open ForeignAmountPopoverSheet
  const foreignTapBtn = page.locator('[role="dialog"] button[title*="نرخ تبدیل"]').first();
  if ((await foreignTapBtn.count()) > 0) {
    await foreignTapBtn.click();
    await page.waitForSelector('[data-testid="foreign-amount-popover"]');
    const popoverText = await page.locator('[data-testid="foreign-amount-popover"]').innerText();
    if (!popoverText.includes('از دارایی‌ات') || !popoverText.includes('نرخ')) {
      throw new Error(`ForeignAmountPopover missing rate/share breakdown (${vp.name}-${theme})`);
    }
    await assertCleanScreen(page, `${vp.name}-${theme}-foreign-popover`);
    if (vp.name === '390') {
      await page.screenshot({ path: path.join(SHOT_DIR, `foreign-popover-${theme}-${vp.name}.png`) });
    }
    await closeTopDialog(page);
  }

  // Open ForeignPaymentSheet ("پرداخت از:") on 390px light
  if (vp.name === '390' && theme === 'light') {
    const travelActionBtn = page.locator('[role="dialog"] button:has-text("انجام سفر به")').first();
    if ((await travelActionBtn.count()) > 0) {
      await travelActionBtn.click();
      await page.waitForSelector('[data-testid="foreign-payment-sheet"]');
      const payText = await page.locator('[data-testid="foreign-payment-sheet"]').innerText();
      if (!payText.includes('پرداخت از:') || !payText.includes('نرخ')) {
        throw new Error('ForeignPaymentSheet missing pay-from wallet selector or conversion line');
      }
      await assertCleanScreen(page, `${vp.name}-${theme}-foreign-payment-sheet`);
      await page.screenshot({ path: path.join(SHOT_DIR, `foreign-payment-sheet-${theme}-${vp.name}.png`) });
      await closeTopDialog(page);
    }
  }

  await closeAllDialogs(page);

  // 5. Assets & Finance Hub -> ExchangeRateStrip check
  await page.click('button:has-text("دارایی‌ها")');
  await page.waitForSelector('[data-testid="exchange-rate-strip"]');
  await assertCleanScreen(page, `${vp.name}-${theme}-assets-rates`);
  if (vp.name === '390') {
    await page.screenshot({ path: path.join(SHOT_DIR, `assets-rates-${theme}-${vp.name}.png`) });
  }
  await closeAllDialogs(page);

  await context.close();
  if (errors.length > 0) {
    throw new Error(`Console/page errors at ${vp.name}-${theme}: ${errors.join(' | ')}`);
  }
}

async function run() {
  const browser = await chromium.launch({
    executablePath: EXEC_PATH,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    for (const vp of VIEWPORTS) {
      for (const theme of ['light', 'dark']) {
        console.log(`[money-verify] Checking ${vp.name}px (${theme})...`);
        await verifyMoneyFlows(browser, vp, theme);
      }
    }
    console.log('[money-verify] OK — All 360/390/768 light+dark multi-currency flows verified.');
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error('[money-verify] FAILED:', err);
  process.exit(1);
});
