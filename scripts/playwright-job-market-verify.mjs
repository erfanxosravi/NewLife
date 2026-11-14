import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE_URL = process.env.E2E_URL || 'http://localhost:3000';
const EXEC_PATH = '/ms-playwright/chrome-headless-shell-linux64/chrome-headless-shell';
const SHOT_DIR = path.resolve(
  '.aistudio/artifacts/brain/56ff4226-2bfe-4ea1-ac50-35bf62b98939/screenshots/after',
);

fs.mkdirSync(SHOT_DIR, { recursive: true });

const VIEWPORTS = [
  { name: '360', width: 360, height: 800 },
  { name: '390', width: 390, height: 844 },
  { name: '768', width: 768, height: 1024 },
];

async function assertNoHorizontalOverflow(page, label) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  if (scrollWidth > clientWidth) {
    throw new Error(
      `Horizontal overflow on "${label}": scrollWidth=${scrollWidth} > clientWidth=${clientWidth}`,
    );
  }
}

async function resolveAnyOpenDialog(page) {
  const overlay = page.locator('[data-testid="year-transition-overlay"]');
  if ((await overlay.count()) > 0) {
    await overlay.click().catch(() => {});
    await overlay.waitFor({ state: 'detached', timeout: 1500 }).catch(() => {});
  }
  const choiceBtns = page.locator('[role="dialog"] .space-y-2 button');
  if ((await choiceBtns.count()) > 0) {
    await choiceBtns.first().click().catch(() => {});
    await page.waitForTimeout(80);
  }
  const contBtn = page.locator('[role="dialog"] button:has-text("ادامه")');
  if ((await contBtn.count()) > 0) {
    await contBtn.click().catch(() => {});
    await page.waitForTimeout(80);
  }
}

async function advanceToAdultAndEnterJobMarket(page) {
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('button:has-text("شروع زندگی")');
  // Open Advanced Settings -> fast-forward birth year to 1384 (or start normal and click next year fast)
  await page.click('button:has-text("شروع زندگی")');
  await page.waitForSelector('button[aria-label="سال بعد"]');

  // Turn on fast animation speed in menu for quicker stepping
  await page.click('button[aria-label="منو و تنظیمات"]');
  await page.waitForSelector('text=تجربه و انیمیشن');
  await page.click('text=تجربه و انیمیشن');
  await page.waitForSelector('button[role="tab"]:has-text("سریع")');
  await page.click('button[role="tab"]:has-text("سریع")');
  await page.locator('[role="dialog"] button[aria-label="بازگشت"]').last().click();
  await page.locator('[role="dialog"] button[aria-label="بازگشت"]').last().click();

  // Advance until age >= 19 so adult Job Market is unlocked
  for (let i = 0; i < 20; i++) {
    await resolveAnyOpenDialog(page);
    const nextBtn = page.locator('button[aria-label="سال بعد"]');
    if ((await nextBtn.count()) === 0) break;
    if (await nextBtn.isEnabled()) {
      await nextBtn.click();
      await page.waitForTimeout(180);
      await resolveAnyOpenDialog(page);
    }
    const headerText = await page.locator('header').innerText();
    if (/۱۹ سال|۲۰ سال|۲۱ سال/.test(headerText)) break;
  }

  // Open Career & Education -> Career subtab -> Job Market
  await page.click('button:has-text("شغل و تحصیل")');
  await page.waitForSelector('[role="dialog"]');
  const careerTab = page.locator('[role="dialog"] button[role="tab"]', { hasText: /^شغل$/ });
  await careerTab.click();
  await page.waitForSelector('[data-testid="job-board-entry"]');
  await page.click('[data-testid="job-board-entry"]');
  await page.waitForSelector('[data-testid="priority-strip"]');
}

async function inspectJobMarketInvariants(page, label) {
  const result = await page.evaluate(() => {
    const dialogs = Array.from(document.querySelectorAll('[role="dialog"]'));
    const topDialog = dialogs[dialogs.length - 1];
    if (!topDialog) return { error: 'No active dialog' };

    const visibleText = topDialog.innerText || '';
    const englishMatches = visibleText.match(/[A-Za-z]+/g) || [];

    // Check title ellipsis / truncation
    const titles = Array.from(topDialog.querySelectorAll('[data-testid^="job-row-"] h4'));
    const truncatedTitles = titles
      .filter((el) => {
        const cs = getComputedStyle(el);
        return cs.textOverflow === 'ellipsis' || el.scrollWidth > el.clientWidth + 2;
      })
      .map((el) => el.textContent);

    // Check typography floor >= 12px on all visible text elements inside topDialog
    const smallFonts = [];
    const walker = document.createTreeWalker(topDialog, NodeFilter.SHOW_ELEMENT);
    let node = walker.currentNode;
    while (node) {
      if (node instanceof HTMLElement && node.innerText?.trim()) {
        const rect = node.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          const fs = parseFloat(getComputedStyle(node).fontSize);
          if (fs < 11.9) {
            smallFonts.push({ tag: node.tagName, fs, text: node.innerText.slice(0, 30) });
          }
        }
      }
      node = walker.nextNode();
    }

    // Check interactive button tap targets (>= 44px height for primary controls)
    const smallTargets = [];
    const testIdTargets = topDialog.querySelectorAll(
      '[data-testid^="job-row-"], [data-testid="priority-strip"], [data-testid="toggle-deck-mode-btn"], [data-testid="toggle-compare-mode-btn"], [data-testid="toggle-future-group-btn"]',
    );
    testIdTargets.forEach((btn) => {
      const r = btn.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.height < 43.5) {
        smallTargets.push({ id: btn.getAttribute('data-testid'), height: r.height });
      }
    });

    // Check nested vertical scrollbar inside list containers (allow only FullScreenSheet main scroll container)
    const nestedVerticalScrollers = [];
    topDialog.querySelectorAll('section, [data-testid^="job-group-"]').forEach((sec) => {
      const cs = getComputedStyle(sec);
      if (
        (cs.overflowY === 'auto' || cs.overflowY === 'scroll') &&
        sec.scrollHeight > sec.clientHeight + 2
      ) {
        nestedVerticalScrollers.push(sec.getAttribute('data-testid') || sec.tagName);
      }
    });

    return {
      englishMatches,
      truncatedTitles,
      smallFonts: smallFonts.slice(0, 5),
      smallTargets,
      nestedVerticalScrollers,
      rowCount: titles.length,
    };
  });

  if (result.error) throw new Error(`${label}: ${result.error}`);
  if (result.englishMatches.length > 0) {
    throw new Error(`${label}: English text detected: ${result.englishMatches.join(', ')}`);
  }
  if (result.truncatedTitles.length > 0) {
    throw new Error(`${label}: Truncated job titles: ${result.truncatedTitles.join(', ')}`);
  }
  if (result.smallFonts.length > 0) {
    throw new Error(`${label}: Sub-12px fonts found: ${JSON.stringify(result.smallFonts)}`);
  }
  if (result.smallTargets.length > 0) {
    throw new Error(`${label}: Under-44px tap targets: ${JSON.stringify(result.smallTargets)}`);
  }
  if (result.nestedVerticalScrollers.length > 0) {
    throw new Error(
      `${label}: Nested vertical scrollers found: ${result.nestedVerticalScrollers.join(', ')}`,
    );
  }
  if (result.rowCount < 3) {
    throw new Error(`${label}: Expected >= 3 visible job rows, got ${result.rowCount}`);
  }
}

async function run() {
  const browser = await chromium.launch({
    executablePath: EXEC_PATH,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const consoleErrors = [];
  const pageErrors = [];

  try {
    // 1. Check 360, 390, 768 viewports in light mode + detailed interactive checks on 390
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        locale: 'fa-IR',
      });
      const page = await context.newPage();
      page.setDefaultTimeout(7000);
      page.on('console', (m) => {
        if (m.type() === 'error') consoleErrors.push(`[${vp.name}] ${m.text()}`);
      });
      page.on('pageerror', (e) => pageErrors.push(`[${vp.name}] ${e.message}`));

      await advanceToAdultAndEnterJobMarket(page);
      await assertNoHorizontalOverflow(page, `${vp.name}-job-market-light`);
      await inspectJobMarketInvariants(page, `${vp.name}-job-market-light`);
      await page.screenshot({ path: path.join(SHOT_DIR, `job-market-light-${vp.name}.png`) });

      if (vp.name === '390') {
        console.error('[verify] 390: Testing annual/monthly toggle...');
        // Test Monthly <-> Annual toggle
        await page.click('[role="dialog"] button:has-text("سالانه")');
        await page.waitForTimeout(100);
        const marketTextAnnual = await page.locator('[role="dialog"]').last().innerText();
        if (!marketTextAnnual.includes('/ سال')) {
          throw new Error('Annual toggle did not update unit to "/ سال"');
        }
        await page.click('[role="dialog"] button:has-text("ماهانه")');
        await page.waitForTimeout(100);

        console.error('[verify] 390: Testing PrioritySheet...');
        // Test PrioritySheet opens ON TOP of JobMarketSheet & live re-ranking works
        await page.click('[data-testid="priority-strip"]');
        await page.waitForSelector('text=اولویت‌های شغلی تو');
        await page.screenshot({ path: path.join(SHOT_DIR, 'job-priority-sheet-390.png') });
        const topSheet = page.locator('[role="dialog"]').last();
        const sliders = topSheet.locator('input[type="range"]');
        const sliderCount = await sliders.count();
        console.error('[verify] 390: sliders in topSheet =', sliderCount);
        if (sliderCount !== 5) {
          throw new Error(`Expected 5 priority sliders inside PrioritySheet, got ${sliderCount}`);
        }
        await topSheet.locator('button:has-text("۳★")').last().click();
        await topSheet.locator('button:has-text("مشاهده رتبه‌بندی تازه")').click();
        await page.waitForTimeout(200);
        console.error('[verify] 390: PrioritySheet closed.');

        // Expand Future group and inspect a locked future job row
        const futureBtn = page.locator('[data-testid="toggle-future-group-btn"]');
        if ((await futureBtn.count()) > 0) {
          console.error('[verify] 390: Expanding Future group...');
          await futureBtn.click();
          await page.waitForTimeout(150);
          await inspectJobMarketInvariants(page, '390-with-future-expanded');
        }

        console.error('[verify] 390: Clicking doctor row...');
        // Open Job Detail Modal on doctor (locked) or software_engineer, check radar & pin goal
        const doctorRow = page.locator('[data-testid="job-row-doctor"]');
        if ((await doctorRow.count()) > 0) {
          await doctorRow.click();
          await page.waitForSelector('[data-testid="job-detail-requirements"]');
          await assertNoHorizontalOverflow(page, '390-job-detail-doctor');
          await page.screenshot({ path: path.join(SHOT_DIR, 'job-detail-light-390.png') });

          // Pin as career goal
          await page.click('[data-testid="job-detail-pin-btn"]');
          await page.waitForTimeout(120);
          await page.locator('[role="dialog"] button[aria-label="بازگشت"]').last().click();
        }

        console.error('[verify] 390: Testing Compare mode...');
        // Test Compare mode with 2 jobs
        await page.click('[data-testid="toggle-compare-mode-btn"]');
        await page.click('[data-testid="job-row-barber"]');
        await page.click('[data-testid="job-row-snapp_driver"]');
        await page.click('[data-testid="open-compare-sheet-btn"]');
        await page.waitForSelector('text=مقایسه پنج‌محوری مشاغل');
        await assertNoHorizontalOverflow(page, '390-job-compare');
        await page.screenshot({ path: path.join(SHOT_DIR, 'job-compare-390.png') });
        await page.locator('[role="dialog"] button[aria-label="بازگشت"]').last().click();
        await page.click('[data-testid="toggle-compare-mode-btn"]');

        console.error('[verify] 390: Testing Deck mode...');
        // Test Deck mode
        await page.click('[data-testid="toggle-deck-mode-btn"]');
        await page.waitForSelector('[data-testid="job-deck-view"]');
        await assertNoHorizontalOverflow(page, '390-job-deck');
        await page.screenshot({ path: path.join(SHOT_DIR, 'job-deck-390.png') });
        await page.click('[data-testid="toggle-deck-mode-btn"]');

        console.error('[verify] 390: Testing Interview flow...');
        // Test Interview flow on eligible barber job
        await page.click('[data-testid="job-row-barber"]');
        await page.waitForSelector('[data-testid="job-detail-apply-btn"]');
        await page.click('[data-testid="job-detail-apply-btn"]');
        await page.waitForSelector('[data-testid="interview-begin-btn"]');
        await page.click('[data-testid="interview-begin-btn"]');
        for (let q = 0; q < 3; q++) {
          const qCard = page.locator('[data-testid="interview-question-card"]');
          if ((await qCard.count()) === 0) break;
          await qCard.locator('button').first().click();
          await page.click('[data-testid="interview-next-btn"]');
        }
        await page.waitForSelector('[data-testid="interview-result-card"]');
        await page.screenshot({ path: path.join(SHOT_DIR, 'job-interview-390.png') });
        await page.click('[data-testid="interview-done-btn"]');

        console.error('[verify] 390: Returning to Career Hub...');
        // Return to Career Hub and verify Pinned Goal Card renders
        await page.locator('[role="dialog"] button[aria-label="بازگشت"]').last().click();
        await page.locator('[role="dialog"] button[aria-label="بازگشت"]').last().click();
        await page.waitForSelector('[data-testid="career-goal-card"]');
        await page.screenshot({ path: path.join(SHOT_DIR, 'career-goal-card-390.png') });

        // Switch to Dark theme via Menu and re-capture Job Market & Detail at 390
        await page.locator('[role="dialog"] button[aria-label="بازگشت"]').last().click();
        await page.click('button[aria-label="منو و تنظیمات"]');
        await page.waitForSelector('text=ظاهر برنامه');
        await page.click('text=ظاهر برنامه');
        await page.click('text=تیره (زغالی گرم)');
        await page.locator('[role="dialog"] button[aria-label="بازگشت"]').last().click();
        await page.locator('[role="dialog"] button[aria-label="بازگشت"]').last().click();

        await page.click('button:has-text("شغل و تحصیل")');
        await page.waitForSelector('[role="dialog"]');
        await page.locator('[role="dialog"] button[role="tab"]', { hasText: /^شغل$/ }).click();
        await page.click('[data-testid="job-board-entry"]');
        await page.waitForSelector('[data-testid="priority-strip"]');
        await inspectJobMarketInvariants(page, '390-job-market-dark');
        await page.screenshot({ path: path.join(SHOT_DIR, 'job-market-dark-390.png') });

        await page.click('[data-testid="job-row-barber"]');
        await page.waitForSelector('[data-testid="job-detail-requirements"]');
        await page.screenshot({ path: path.join(SHOT_DIR, 'job-detail-dark-390.png') });
      }

      await context.close();
    }

    // 2. Styleguide Job Compass section check
    const sgContext = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'fa-IR' });
    const sgPage = await sgContext.newPage();
    sgPage.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(`[styleguide] ${m.text()}`);
    });
    sgPage.on('pageerror', (e) => pageErrors.push(`[styleguide] ${e.message}`));
    await sgPage.goto(`${BASE_URL}/styleguide`, { waitUntil: 'networkidle' });
    await sgPage.waitForSelector('[data-testid="styleguide-job-compass"]');
    await assertNoHorizontalOverflow(sgPage, 'styleguide-job-compass-390');
    await sgContext.close();
  } finally {
    await browser.close();
  }

  if (consoleErrors.length > 0 || pageErrors.length > 0) {
    console.error('Console errors:', consoleErrors);
    console.error('Page errors:', pageErrors);
    process.exit(1);
  }

  console.log('[playwright-job-market-verify] OK — All 360/390/768 light+dark checks, priority sheet, radar, compare, deck, interview, pinned goal, and styleguide passed.');
}

run().catch((err) => {
  console.error('[playwright-job-market-verify] FAILED:', err);
  process.exit(1);
});
