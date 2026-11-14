import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE_URL = process.env.E2E_URL || 'http://localhost:3000';
const EXEC_PATH = '/ms-playwright/chrome-headless-shell-linux64/chrome-headless-shell';
const SHOT_DIR = path.resolve(
  '.aistudio/artifacts/brain/b45dabeb-e0eb-47eb-a65d-10c17ddda0b1/screenshots/after',
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

    // Check for nested scrollable containers inside dialog body
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

    // Check computed font size >= 12px and no clipped headings
    const tinyTexts = [];
    const clippedHeadings = [];
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
      const fs = parseFloat(cs.fontSize);
      if (!Number.isNaN(fs) && fs < 11.9) {
        tinyTexts.push(`${el.tagName} (${fs.toFixed(1)}px): "${node.nodeValue.trim().slice(0, 24)}"`);
      }
    }

    for (const h of root.querySelectorAll('h1, h2, h3, h4, [role="heading"]')) {
      const cs = getComputedStyle(h);
      if (cs.textOverflow === 'ellipsis' && cs.overflow === 'hidden' && h.scrollWidth > h.clientWidth + 1) {
        clippedHeadings.push(h.textContent?.trim().slice(0, 32) || h.tagName);
      }
    }

    return {
      overflow: sw > cw ? `${sw}>${cw}` : null,
      english: englishMatch,
      nestedScrolls,
      tinyTexts: tinyTexts.slice(0, 5),
      clippedHeadings,
    };
  });

  if (result.overflow) {
    throw new Error(`Horizontal overflow at ${label}: ${result.overflow}`);
  }
  if (result.english && result.english.length > 0) {
    throw new Error(`English text found at ${label}: ${result.english.join(', ')}`);
  }
  if (result.nestedScrolls.length > 0) {
    throw new Error(`Nested scrollbars found at ${label}: ${result.nestedScrolls.join('; ')}`);
  }
  if (result.tinyTexts.length > 0) {
    throw new Error(`Sub-12px text found at ${label}: ${result.tinyTexts.join('; ')}`);
  }
  if (result.clippedHeadings.length > 0) {
    throw new Error(`Clipped heading found at ${label}: ${result.clippedHeadings.join('; ')}`);
  }
}

async function assertHubSectionBudgets(page, label) {
  const violation = await page.evaluate(() => {
    const topDialog = Array.from(document.querySelectorAll('[role="dialog"]')).pop();
    if (!topDialog) return 'no dialog';
    const body = topDialog.querySelector('.overflow-y-auto');
    if (!body) return 'no body';
    const topContent = body.firstElementChild;
    if (!topContent) return null;
    const sections = topContent.querySelectorAll(':scope > section, :scope > div > section');
    if (sections.length > 5) {
      return `section count ${sections.length} > 5`;
    }
    for (const sec of sections) {
      const dividerBox = sec.querySelector(':scope > div.divide-y');
      if (dividerBox) {
        const rowCount = dividerBox.children.length;
        if (rowCount > 7) {
          const title = sec.querySelector('h3')?.textContent?.trim() || 'unknown';
          return `section "${title}" has ${rowCount} rows > 7`;
        }
      }
    }
    return null;
  });

  if (violation) {
    throw new Error(`Hub budget violation at ${label}: ${violation}`);
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
    await page.waitForTimeout(120);
  }
}

async function closeTopDialog(page) {
  await page.locator('[role="dialog"] button[aria-label="بازگشت"]').last().click();
  await page.waitForTimeout(150);
}

async function closeAllDialogs(page) {
  while ((await page.locator('[role="dialog"] button[aria-label="بازگشت"]').count()) > 0) {
    await closeTopDialog(page);
  }
}

async function setTheme(page, mode) {
  await page.click('button[aria-label="منو و تنظیمات"]');
  await page.waitForSelector('text=ظاهر برنامه');
  await page.click('text=ظاهر برنامه');
  if (mode === 'dark') {
    await page.click('text=تیره (زغالی گرم)');
  } else {
    await page.click('text=روشن (نارنجی و سفید)');
  }
  await closeAllDialogs(page);
}

async function runForMode(browser, vp, theme) {
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

  // 1. Styleguide verification
  await page.goto(`${BASE_URL}/styleguide`, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=کارت خلاصه هاب و سه‌گانه آمار');
  await page.waitForSelector('[data-testid="styleguide-emigration-activities"]');
  if (theme === 'dark') {
    const darkBtn = page.locator('header button:has-text("تیره")');
    if ((await darkBtn.count()) > 0) {
      await darkBtn.click();
    } else {
      await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    }
    await page.waitForTimeout(100);
  }
  await assertCleanScreen(page, `${vp.name}-${theme}-styleguide`);
  if (vp.name === '390') {
    await page.screenshot({ path: path.join(SHOT_DIR, `styleguide-${theme}-${vp.name}.png`), fullPage: false });
  }

  // 2. Start life & advance to age 19
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.click('button:has-text("شروع زندگی")');
  await page.waitForSelector('button[aria-label="سال بعد"]');

  if (theme === 'dark') {
    await setTheme(page, 'dark');
  }

  // Fast speed so advancing 19 years is quick
  await page.click('button[aria-label="منو و تنظیمات"]');
  await page.click('text=تجربه و انیمیشن');
  await page.click('button[role="tab"]:has-text("سریع")');
  await closeAllDialogs(page);

  for (let yr = 0; yr < 19; yr++) {
    await resolveEventIfOpen(page);
    const nextBtn = page.locator('button[aria-label="سال بعد"]');
    await nextBtn.click();
    await page.waitForTimeout(180);
    await resolveEventIfOpen(page);
  }

  // ---- HUB 1: WORK & EDUCATION (Career, Education, Skills, Military) ----
  await page.click('button:has-text("شغل و تحصیل")');
  await page.waitForSelector('[role="dialog"]');
  // Career sub-tab
  await page.click('[role="dialog"] button[role="tab"]:has-text("شغل")');
  await page.waitForTimeout(120);
  await assertCleanScreen(page, `${vp.name}-${theme}-career-hub`);
  await assertHubSectionBudgets(page, `${vp.name}-${theme}-career-hub`);
  await page.screenshot({ path: path.join(SHOT_DIR, `hub-career-${theme}-${vp.name}.png`) });

  if (vp.name === '390') {
    // Drill down to Job Market -> Job Detail -> Back
    await page.click('[data-testid="job-board-entry"]');
    await page.waitForSelector('[data-testid="priority-strip"]');
    await assertCleanScreen(page, `${vp.name}-${theme}-job-board`);
    await page.click('[data-testid="job-row-barber"]');
    await page.waitForSelector('[data-testid="job-detail-requirements"]');
    await assertCleanScreen(page, `${vp.name}-${theme}-job-detail`);
    await page.screenshot({ path: path.join(SHOT_DIR, `drill-job-detail-${theme}-${vp.name}.png`) });
    await closeTopDialog(page);
    await closeTopDialog(page);
  }

  // Skills sub-tab
  await page.click('[role="dialog"] button[role="tab"]:has-text("مهارت‌ها")');
  await page.waitForSelector('text=پرورش استعدادها و مهارت‌ها');
  await assertCleanScreen(page, `${vp.name}-${theme}-skills-hub`);
  await assertHubSectionBudgets(page, `${vp.name}-${theme}-skills-hub`);
  if (vp.name === '390') {
    await page.screenshot({ path: path.join(SHOT_DIR, `hub-skills-${theme}-${vp.name}.png`) });
    await page.click('[role="dialog"] button:has-text("آواز و خوانندگی")');
    await page.waitForSelector('text=روش‌های پرورش و شکوفایی');
    await assertCleanScreen(page, `${vp.name}-${theme}-talent-detail`);
    await closeTopDialog(page);
  }

  // Education sub-tab
  await page.click('[role="dialog"] button[role="tab"]:has-text("تحصیل")');
  await page.waitForTimeout(120);
  await assertCleanScreen(page, `${vp.name}-${theme}-edu-hub`);
  await assertHubSectionBudgets(page, `${vp.name}-${theme}-edu-hub`);
  await closeAllDialogs(page);

  // ---- HUB 2: ACTIVITIES & REDESIGNED EMIGRATION HUB ----
  await page.click('button:has-text("فعالیت‌ها")');
  await page.waitForSelector('text=برنامه امسال');
  await page.waitForSelector('text=دسته‌بندی فعالیت‌ها');
  await assertCleanScreen(page, `${vp.name}-${theme}-activities-hub`);
  await assertHubSectionBudgets(page, `${vp.name}-${theme}-activities-hub`);
  await page.screenshot({ path: path.join(SHOT_DIR, `hub-activities-${theme}-${vp.name}.png`) });

  if (vp.name === '390') {
    // Drill into an Activity Category
    await page.locator('[role="dialog"] button:has-text("ورزش و تندرستی")').first().click();
    await page.waitForTimeout(120);
    await assertCleanScreen(page, `${vp.name}-${theme}-activity-category-detail`);
    await assertHubSectionBudgets(page, `${vp.name}-${theme}-activity-category-detail`);
    await closeTopDialog(page);

    // Open Redesigned Emigration & Travel Hub
    await page.locator('[role="dialog"] button:has-text("سفر خارجی و مهاجرت")').first().click();
    await page.waitForSelector('text=کشورهای مقصد مهاجرت');
    await assertCleanScreen(page, `${vp.name}-${theme}-emigration-hub`);
    await assertHubSectionBudgets(page, `${vp.name}-${theme}-emigration-hub`);
    await page.screenshot({ path: path.join(SHOT_DIR, `hub-emigration-${theme}-${vp.name}.png`) });

    // Switch to Travel sub-tab
    await page.locator('[role="dialog"] button[role="tab"]:has-text("سفر خارجی")').last().click();
    await page.waitForSelector('text=انتخاب مقصد سفر کوتاه');
    await assertCleanScreen(page, `${vp.name}-${theme}-travel-tab`);

    // Switch back to Migration sub-tab & open Turkey detail
    await page.locator('[role="dialog"] button[role="tab"]:has-text("مهاجرت")').last().click();
    await page.waitForSelector('text=کشورهای مقصد مهاجرت');
    await page.locator('[data-testid="country-card-turkey"] button:has-text("بررسی پرونده")').click();
    await page.waitForSelector('[data-testid="abroad-income-calculator"]');
    await page.locator('[data-testid="abroad-income-calculator"] button:has-text("۲ نفر")').click();
    await page.waitForSelector('text=تجزیه سختی پرونده');
    await assertCleanScreen(page, `${vp.name}-${theme}-country-detail-income`);
    await page.screenshot({ path: path.join(SHOT_DIR, `drill-country-detail-${theme}-${vp.name}.png`) });

    // Check Paths + Economy ("شبیه‌سازی است") tabs
    await page.locator('[role="dialog"] button[role="tab"]:has-text("مسیرها")').last().click();
    await page.waitForSelector('text=مسیر شش‌گام پرونده');
    await assertCleanScreen(page, `${vp.name}-${theme}-country-detail-paths`);
    await page.locator('[role="dialog"] button[role="tab"]:has-text("اقتصاد")').last().click();
    await page.waitForSelector('text=شبیه‌سازی است');
    await assertCleanScreen(page, `${vp.name}-${theme}-country-detail-economy`);
    await closeTopDialog(page);

    // Check Country Compare Modal
    await page.locator('[role="dialog"] button:has-text("مقایسه")').first().click();
    await page.waitForSelector('text=مقایسه کشورهای مقصد');
    await assertCleanScreen(page, `${vp.name}-${theme}-country-compare`);
    await closeTopDialog(page);
  }
  await closeAllDialogs(page);

  // ---- HUB 3: ASSETS & FINANCE ----
  await page.click('button:has-text("دارایی‌ها")');
  await page.waitForSelector('text=روند دارایی و شاخص بازار');
  await assertCleanScreen(page, `${vp.name}-${theme}-assets-overview`);
  await assertHubSectionBudgets(page, `${vp.name}-${theme}-assets-overview`);
  await page.screenshot({ path: path.join(SHOT_DIR, `hub-assets-${theme}-${vp.name}.png`) });

  // Drill into Market Analysis & FX Drawer
  if (vp.name === '390') {
    await page.click('[role="dialog"] button:has-text("تحلیل بازار")');
    await page.waitForSelector('text=نرخ‌های روز بازار');
    await assertCleanScreen(page, `${vp.name}-${theme}-market-detail`);
    await closeTopDialog(page);

    const fxBtn = page.locator('[role="dialog"] button:has-text("تبدیل و حواله")').first();
    if ((await fxBtn.count()) > 0) {
      await fxBtn.click();
      await page.waitForTimeout(150);
      await assertCleanScreen(page, `${vp.name}-${theme}-fx-drawer`);
      await closeTopDialog(page);
    }
  }

  // Switch through Investments / Housing / Loans / Shop
  for (const [tabText, tabId] of [
    ['سرمایه‌گذاری', 'investments'],
    ['مسکن', 'housing'],
    ['وام', 'loans'],
    ['بازار', 'shop'],
  ]) {
    await page.click(`[role="dialog"] button[role="tab"]:has-text("${tabText}")`);
    await page.waitForTimeout(100);
    await assertCleanScreen(page, `${vp.name}-${theme}-assets-${tabId}`);
    await assertHubSectionBudgets(page, `${vp.name}-${theme}-assets-${tabId}`);
  }
  await closeAllDialogs(page);

  // ---- HUB 4: RELATIONSHIPS ----
  await page.click('button:has-text("روابط")');
  await page.waitForSelector('text=آشنایی تازه');
  await assertCleanScreen(page, `${vp.name}-${theme}-relations-hub`);
  await assertHubSectionBudgets(page, `${vp.name}-${theme}-relations-hub`);
  await page.screenshot({ path: path.join(SHOT_DIR, `hub-relations-${theme}-${vp.name}.png`) });

  // Drill into first person
  const personBtn = page
    .locator('[role="dialog"] section:has(h3:text-is("همه")) button')
    .first();
  if ((await personBtn.count()) > 0) {
    await personBtn.click();
    await page.waitForSelector('text=گفت‌وگو و تعامل');
    await assertCleanScreen(page, `${vp.name}-${theme}-person-detail`);
    if (vp.name === '390') {
      await page.screenshot({ path: path.join(SHOT_DIR, `drill-person-${theme}-${vp.name}.png`) });
      // Verify collapsed DangerZone opens ConfirmDialog or action cleanly
      await page.click('[role="dialog"] button:has-text("گزینه‌های حساس")');
      await page.waitForSelector('text=بحث و دلخوری');
      await assertCleanScreen(page, `${vp.name}-${theme}-person-danger-open`);
    }
  }
  await closeAllDialogs(page);

  await context.close();
  if (errors.length > 0) {
    throw new Error(`Errors in ${vp.name}-${theme}: ${errors.join(' | ')}`);
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
        console.log(`[hubs-verify] Checking ${vp.name}px (${theme})...`);
        await runForMode(browser, vp, theme);
      }
    }
    console.log('[hubs-verify] OK — All 360/390/768 light+dark hubs, drill-downs, budgets, zero English, zero nested scroll verified.');
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error('[hubs-verify] FAILED:', err);
  process.exit(1);
});
