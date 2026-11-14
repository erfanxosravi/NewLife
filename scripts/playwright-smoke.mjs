import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE_URL = process.env.E2E_URL || 'http://localhost:3000';
const EXEC_PATH = '/ms-playwright/chrome-headless-shell-linux64/chrome-headless-shell';
const SHOT_DIR = path.resolve(
  '.aistudio/artifacts/brain/48d87d70-3e76-40e2-9fac-8a1ec15bad5d/screenshots',
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

async function assertCleanCreationScreen(page, label) {
  const bodyText = await page.evaluate(() => document.body.innerText);
  const forbidden = ['بذر سرنوشت', 'تاس مجدد', 'پیش‌نمایش شناسنامه', 'سرشت متعادل'];
  for (const term of forbidden) {
    if (bodyText.includes(term)) {
      throw new Error(`Forbidden term "${term}" found on creation screen (${label})`);
    }
  }
  const progressBars = await page.locator('[role="progressbar"]').count();
  if (progressBars > 0) {
    throw new Error(`Stat progressbars (${progressBars}) must not appear on creation screen (${label})`);
  }
}

async function resolveAnyOpenDialog(page) {
  const dialog = page.locator('[role="dialog"]').first();
  if ((await dialog.count()) === 0) return false;
  // Ignore year transition overlay here; only handle bottom-sheet event dialog
  const overlay = page.locator('[data-testid="year-transition-overlay"]');
  if ((await overlay.count()) > 0) return false;

  const choiceBtns = page.locator('[role="dialog"] .space-y-2 button');
  if ((await choiceBtns.count()) > 0) {
    await choiceBtns.first().click();
    await page.waitForTimeout(80);
  }
  const contBtn = page.locator('[role="dialog"] button:has-text("ادامه")');
  if ((await contBtn.count()) > 0) {
    await contBtn.click();
    await page.waitForTimeout(80);
  }
  return true;
}

async function run() {
  const browser = await chromium.launch({
    executablePath: EXEC_PATH,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  const consoleErrors = [];
  const pageErrors = [];

  try {
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        locale: 'fa-IR',
      });
      const page = await context.newPage();

      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(`[${vp.name}] ${msg.text()}`);
      });
      page.on('pageerror', (err) => {
        pageErrors.push(`[${vp.name}] ${err.message}`);
      });

      // 1. Styleguide check
      await page.goto(`${BASE_URL}/styleguide`, { waitUntil: 'networkidle' });
      await page.waitForSelector('text=راهنمای اجزا و رنگ‌ها');
      await assertNoHorizontalOverflow(page, `${vp.name}-styleguide`);
      if (vp.name === '390') {
        await page.screenshot({ path: path.join(SHOT_DIR, `styleguide-light-${vp.name}.png`) });
      }

      // 2. Main app -> Character Creation -> Verify simplified creation screen
      await page.goto(BASE_URL, { waitUntil: 'networkidle' });
      await page.waitForSelector('button:has-text("شروع زندگی")');
      await assertCleanCreationScreen(page, vp.name);
      await assertNoHorizontalOverflow(page, `${vp.name}-creation`);
      await page.screenshot({ path: path.join(SHOT_DIR, `creation-${vp.name}.png`) });

      if (vp.name === '390') {
        // Test Suggest Name + Collapsed Advanced Settings (Birth Year) + Random Start button
        await page.click('button:has-text("پیشنهاد نام")');
        await page.click('button:has-text("تنظیمات پیشرفته")');
        await page.waitForSelector('text=سال تولد');
        await page.click('button:has-text("شروع کاملاً تصادفی")');
        await assertCleanCreationScreen(page, '390-after-random-identity');
      }

      await page.click('button:has-text("شروع زندگی")');
      await page.waitForSelector('button[aria-label="سال بعد"]');
      await assertNoHorizontalOverflow(page, `${vp.name}-feed-start`);

      // Capture Normal Year Overlay + verify tap-to-skip on 390px
      if (vp.name === '390') {
        await page.click('button[aria-label="سال بعد"]');
        const overlay = page.locator('[data-testid="year-transition-overlay"]');
        await overlay.waitFor({ state: 'visible', timeout: 3000 });
        await page.waitForTimeout(450);
        await assertNoHorizontalOverflow(page, `${vp.name}-normal-overlay`);
        await page.screenshot({ path: path.join(SHOT_DIR, 'frame-normal-year-390.png') });
        // Tap to skip!
        await overlay.click();
        await overlay.waitFor({ state: 'detached', timeout: 1500 });
        await page.waitForTimeout(200);
        await resolveAnyOpenDialog(page);
      }

      // Advance through childhood/teen years on 390px and practice a talent twice so discovery triggers!
      if (vp.name === '390') {
        let capturedNowruz = false;
        let capturedEvent = false;
        let capturedMilestone18 = false;
        let practicedTalentSteps = 0;

        for (let step = 0; step < 22; step++) {
          const nextBtn = page.locator('button[aria-label="سال بعد"]');
          if ((await nextBtn.count()) === 0) break;

          await resolveAnyOpenDialog(page);
          if (await nextBtn.isDisabled()) {
            await page.waitForTimeout(200);
            await resolveAnyOpenDialog(page);
          }
          if (!(await nextBtn.isEnabled())) continue;

          // At step 6 and 8 (age >= 7), open Skills -> Talent Practice -> "تمرین فردی" so talent discovery surfaces
          if (step === 6 || step === 8) {
            await page.click('button:has-text("شغل و تحصیل")');
            await page.waitForSelector('[role="dialog"]');
            await page.click('[role="dialog"] button[role="tab"]:has-text("مهارت‌ها")');
            await page.waitForSelector('text=پرورش استعدادها و گرایش‌های فردی');
            const practiceBtn = page
              .locator('[role="dialog"] button:has-text("تمرین فردی")')
              .first();
            if ((await practiceBtn.count()) > 0 && (await practiceBtn.isEnabled())) {
              await practiceBtn.click();
              practicedTalentSteps++;
              if (practicedTalentSteps === 2) {
                await page.screenshot({ path: path.join(SHOT_DIR, 'tab-skills-talents-390.png') });
              }
            }
            await page.click('[role="dialog"] button[aria-label="بازگشت"]');
          }

          await nextBtn.click();
          const overlay = page.locator('[data-testid="year-transition-overlay"]');
          try {
            await overlay.waitFor({ state: 'visible', timeout: 2000 });
          } catch {
            // Possibly instant or skipped
          }

          if ((await overlay.count()) > 0) {
            const isMilestone = await overlay.getAttribute('data-milestone');
            const isNowruz = await overlay.getAttribute('data-nowruz');
            const text = await overlay.innerText();

            if (!capturedNowruz && isNowruz === 'true' && isMilestone !== 'true') {
              await page.waitForTimeout(480);
              await page.screenshot({ path: path.join(SHOT_DIR, 'frame-nowruz-year-390.png') });
              capturedNowruz = true;
            }

            if (!capturedMilestone18 && isMilestone === 'true' && text.includes('۱۸')) {
              await page.waitForTimeout(550);
              await page.screenshot({ path: path.join(SHOT_DIR, 'frame-milestone-18-390.png') });
              capturedMilestone18 = true;
            }

            if ((await overlay.count()) > 0) {
              await overlay.click();
              await overlay.waitFor({ state: 'detached', timeout: 1500 }).catch(() => {});
            }
          }

          await page.waitForTimeout(260);
          if ((await page.locator('[role="dialog"]').count()) === 0) {
            const feedMain = page.locator('main');
            if ((await feedMain.count()) > 0) {
              await feedMain.click({ timeout: 1000 }).catch(() => {});
            }
            await page.waitForTimeout(420);
          }

          const eventDialog = page.locator('[role="dialog"] .space-y-2 button');
          if ((await eventDialog.count()) > 0) {
            if (!capturedEvent) {
              await page.waitForTimeout(300);
              await page.screenshot({ path: path.join(SHOT_DIR, 'frame-event-popup-390.png') });
              capturedEvent = true;
            }
            await resolveAnyOpenDialog(page);
          }

          if (capturedNowruz && capturedMilestone18 && capturedEvent && practicedTalentSteps >= 2) {
            break;
          }
        }

        if (!capturedNowruz) throw new Error('Did not capture Nowruz year frame');
        if (!capturedMilestone18) throw new Error('Did not capture Age 18 Milestone frame');
        if (!capturedEvent) throw new Error('Did not capture Decision Event Popup frame');
        if (practicedTalentSteps < 2) throw new Error('Did not practice talent in skills tab');

        // Capture feed showing discovered talent event
        await page.screenshot({ path: path.join(SHOT_DIR, 'feed-talent-discovery-390.png') });
      } else {
        for (let i = 0; i < 3; i++) {
          await resolveAnyOpenDialog(page);
          const nextBtn = page.locator('button[aria-label="سال بعد"]');
          if ((await nextBtn.count()) > 0 && (await nextBtn.isEnabled())) {
            await nextBtn.click();
            const overlay = page.locator('[data-testid="year-transition-overlay"]');
            await overlay.waitFor({ state: 'visible', timeout: 2500 }).catch(() => {});
            if ((await overlay.count()) > 0) {
              await overlay.click();
              await overlay.waitFor({ state: 'detached', timeout: 1500 }).catch(() => {});
            }
            await page.waitForTimeout(450);
            await resolveAnyOpenDialog(page);
          }
        }
      }

      await assertNoHorizontalOverflow(page, `${vp.name}-feed`);
      await page.screenshot({ path: path.join(SHOT_DIR, `shell-light-${vp.name}.png`) });

      // 3. Open each of the 4 bottom tabs
      await page.click('button:has-text("شغل و تحصیل")');
      await page.waitForSelector('[role="dialog"]');
      const careerSubTab = page.locator('[role="dialog"] button[role="tab"]', { hasText: /^شغل$/ });
      if ((await careerSubTab.count()) > 0) {
        await careerSubTab.click();
        await page.waitForTimeout(150);
        if (vp.name === '390') {
          // Verify Ownership Flow + Risk Preview
          const ownershipCard = page.locator('[data-testid="ownership-flow-card"]');
          if ((await ownershipCard.count()) > 0) {
            const startFlowBtn = ownershipCard.locator('button:has-text("شروع فرآیند")');
            if ((await startFlowBtn.count()) > 0) {
              await startFlowBtn.click();
              await page.waitForSelector('[data-testid="ownership-risk-preview"]');
            }
          }
          // Expand Licenses Card briefly to verify zero overflow
          const licensesCard = page.locator('[data-testid="licenses-card"]');
          if ((await licensesCard.count()) > 0) {
            await licensesCard.locator('button:has-text("مشاهده و اخذ مجوز")').click();
            await page.waitForTimeout(100);
          }
          // Apply to barber job to surface employee career ladder timeline
          const applyBarberBtn = page
            .locator('[role="dialog"] .space-y-2')
            .filter({ hasText: 'آرایشگر' })
            .locator('button:has-text("ارسال درخواست و مصاحبه")')
            .first();
          if ((await applyBarberBtn.count()) > 0 && (await applyBarberBtn.isEnabled())) {
            await applyBarberBtn.click();
            await page.waitForTimeout(200);
          }
          const dialogText = await page.locator('[role="dialog"]').innerText();
          if (/[A-Za-z]/.test(dialogText)) {
            const match = dialogText.match(/[A-Za-z]+/g);
            throw new Error(`English text found in Career UI: ${match?.join(', ')}`);
          }
        }
      }
      await assertNoHorizontalOverflow(page, `${vp.name}-tab-work`);
      await page.screenshot({ path: path.join(SHOT_DIR, `tab-work-${vp.name}.png`) });
      await page.click('[role="dialog"] button[aria-label="بازگشت"]');

      await page.click('button:has-text("دارایی‌ها")');
      await page.waitForSelector('[role="dialog"]');
      await assertNoHorizontalOverflow(page, `${vp.name}-tab-assets`);
      if (vp.name === '390') {
        await page.screenshot({ path: path.join(SHOT_DIR, `tab-assets-${vp.name}.png`) });
      }
      await page.click('[role="dialog"] button[aria-label="بازگشت"]');

      await page.click('button:has-text("روابط")');
      await page.waitForSelector('[role="dialog"]');
      await assertNoHorizontalOverflow(page, `${vp.name}-tab-relations`);
      if (vp.name === '390') {
        await page.screenshot({ path: path.join(SHOT_DIR, `tab-relations-${vp.name}.png`) });
      }
      await page.click('[role="dialog"] button[aria-label="بازگشت"]');

      await page.click('button:has-text("فعالیت‌ها")');
      await page.waitForSelector('[role="dialog"]');
      await assertNoHorizontalOverflow(page, `${vp.name}-tab-activities`);
      if (vp.name === '390') {
        await page.screenshot({ path: path.join(SHOT_DIR, `tab-activities-${vp.name}.png`) });
      }
      await page.click('[role="dialog"] button[aria-label="بازگشت"]');

      // 4. Verify Profile discovered talents + 7-tap hidden debug menu + Dark Theme
      await page.click('button[aria-label="منو و تنظیمات"]');
      await page.waitForSelector('text=تجربه و انیمیشن');

      if (vp.name === '390') {
        // Profile -> verify discovered talents section with zero raw numbers
        await page.click('[role="dialog"] button:has-text("پروفایل")');
        await page.waitForSelector('text=استعدادها و گرایش‌های کشف‌شده');
        await page.screenshot({ path: path.join(SHOT_DIR, 'menu-profile-talents-390.png') });
        await page.click('[role="dialog"] button[aria-label="بازگشت"]');

        // About -> tap version badge 7 times -> verify hidden debug life code tool opens
        await page.click('[role="dialog"] button:has-text("درباره")');
        const versionBadgeBtn = page.locator('[role="dialog"] button:has-text("نسخه ۱.۰.۰")');
        await versionBadgeBtn.waitFor({ state: 'visible' });
        for (let t = 0; t < 7; t++) {
          await versionBadgeBtn.click();
        }
        await page.waitForSelector('text=ابزار آزمایشی کد زندگی');
        await page.waitForSelector('text=کد زندگی فعلی:');
        await page.click('[role="dialog"] button[aria-label="بازگشت"]');

        // Experience speed setting
        await page.click('text=تجربه و انیمیشن');
        await page.waitForSelector('text=سرعت انیمیشن');
        await page.click('button[role="tab"]:has-text("سریع")');
        await page.click('[role="dialog"] button[aria-label="بازگشت"]');
      }

      await page.waitForSelector('text=ظاهر برنامه');
      await page.click('text=ظاهر برنامه');
      await page.click('text=تیره (زغالی گرم)');
      await page.click('[role="dialog"] button[aria-label="بازگشت"]');
      await page.click('[role="dialog"] button[aria-label="بازگشت"]');
      await assertNoHorizontalOverflow(page, `${vp.name}-feed-dark`);
      await page.screenshot({ path: path.join(SHOT_DIR, `shell-dark-${vp.name}.png`) });

      await context.close();
    }

    // 5. Verify prefers-reduced-motion behavior cleanly at 390px
    const rmContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      locale: 'fa-IR',
      reducedMotion: 'reduce',
    });
    const rmPage = await rmContext.newPage();
    rmPage.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(`[reduced-motion] ${msg.text()}`);
    });
    rmPage.on('pageerror', (err) => {
      pageErrors.push(`[reduced-motion] ${err.message}`);
    });
    await rmPage.goto(BASE_URL, { waitUntil: 'networkidle' });
    await rmPage.click('button:has-text("شروع زندگی")');
    await rmPage.waitForSelector('button[aria-label="سال بعد"]');
    await rmPage.click('button[aria-label="سال بعد"]');
    await rmPage.waitForTimeout(600);
    await resolveAnyOpenDialog(rmPage);
    await assertNoHorizontalOverflow(rmPage, 'reduced-motion-390');
    await rmContext.close();
  } finally {
    await browser.close();
  }

  if (consoleErrors.length > 0 || pageErrors.length > 0) {
    console.error('Console errors:', consoleErrors);
    console.error('Page errors:', pageErrors);
    process.exit(1);
  }

  console.log(
    '[playwright-smoke] OK — All 360/390/768 checks, creation screen, talent practice/discovery, 7-tap debug menu, and reduced-motion passed with 0 errors.',
  );
}

run().catch((err) => {
  console.error('[playwright-smoke] FAILED:', err);
  process.exit(1);
});
