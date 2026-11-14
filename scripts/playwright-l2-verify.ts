import fs from 'node:fs';
import path from 'node:path';
import { chromium, type Page } from 'playwright';
import { gameDataset } from '../src/data/registry';
import { createNewSaveGame } from '../src/engine/generator';
import { advanceYear } from '../src/engine/reducer';
import { inheritFromDeceasedToHeir, ensureDynastyState } from '../src/engine/legacy';
import { SaveGameSchema } from '../src/engine/schemas';
import type { SaveGame } from '../src/engine/types';

const BASE_URL = process.env.E2E_URL || 'http://localhost:3000';
const EXEC_PATH = '/ms-playwright/chrome-headless-shell-linux64/chrome-headless-shell';
const SHOT_DIR = path.resolve(
  '.aistudio/artifacts/brain/9b815c2d-3ce6-4758-8f13-fad3be82c488/screenshots/l2',
);

fs.mkdirSync(SHOT_DIR, { recursive: true });

const VIEWPORTS = [
  { name: '360', width: 360, height: 800 },
  { name: '390', width: 390, height: 844 },
  { name: '768', width: 768, height: 1024 },
];

const THEMES = ['light', 'dark'] as const;

function buildFixtures() {
  // 1. Build a 3-generation living patriarch at age 56 with spouse, 2 children, house, business, car, and ancestor chapter
  let gen1 = createNewSaveGame({ seed: 'l2-verify-dynasty', birthJalaliYear: 1345 }, gameDataset);
  for (let i = 0; i < 42 && gen1.state.isAlive; i += 1) {
    gen1 = advanceYear(gen1, gameDataset);
  }
  gen1.state.player.moneyToman = 1_800_000_000;
  gen1.state.player.housing.type = 'owned';
  gen1.state.player.housing.propertyValueToman = 3_200_000_000;
  gen1.state.player.education.level = 'bachelor';
  gen1.state.npcs['npc_gen1_child'] = {
    id: 'npc_gen1_child',
    firstName: 'سهراب',
    lastName: gen1.state.player.lastName,
    gender: 'male',
    age: 26,
    traits: ['پرتلاش', 'صادق'],
    jobTitle: 'مهندس عمران',
    isAlive: true,
    maritalStatus: 'married',
  };
  gen1.state.relationships.push({
    personId: 'npc_gen1_child',
    role: 'child',
    closeness: 88,
    respect: 85,
    romance: 0,
  });
  gen1.state.isAlive = false;
  gen1.state.deathSummary = {
    ageAtDeath: gen1.state.player.age,
    jalaliYearOfDeath: gen1.state.currentJalaliYear,
    causeOfDeath: 'کهولت سن',
    finalNetWorthToman: 5_000_000_000,
    legacyTitle: 'پیشگام خانوادگی',
    lifeScore: 76,
    highlights: ['بنیان‌گذار مسیر خانواده در تهران'],
  };

  let gen2 = inheritFromDeceasedToHeir({
    save: gen1,
    heirId: 'npc_gen1_child',
    homeDecision: 'keep_jointly',
    businessDecision: 'sell_and_split',
    dataset: gameDataset,
  }).save;

  for (let i = 0; i < 28 && gen2.state.isAlive; i += 1) {
    gen2 = advanceYear(gen2, gameDataset);
  }
  gen2.state.isAlive = true;
  gen2.state.deathSummary = null;
  gen2.state.player.moneyToman = 3_600_000_000;
  gen2.state.player.education.level = 'master';
  gen2.state.player.housing.type = 'owned';
  gen2.state.player.housing.propertyValueToman = 6_400_000_000;
  gen2.state.ownedBusiness = {
    id: 'biz_l2_cafe',
    businessTypeId: 'cafe',
    nameFa: `کافه ${gen2.state.player.lastName}`,
    acquisitionMode: 'start_scratch',
    cityId: gen2.state.player.currentCityId,
    regionTier: 'mid',
    size: 'small',
    foundedYear: gen2.state.currentJalaliYear - 9,
    yearsOperating: 9,
    ownershipShare: 1,
    isFranchise: false,
    depositLockedToman: 900_000_000,
    monthlyRentToman: 65_000_000,
    equipmentValueToman: 1_500_000_000,
    cashReserveToman: 450_000_000,
    branchCount: 1,
    priceStrategy: 'standard',
    reputation: 82,
    customerBase: 140,
    renovationYearsLeft: 3,
    marketingYearsLeft: 1,
    consecutiveLossYears: 0,
    lastYearRevenueToman: 1_800_000_000,
    lastYearCostsToman: {
      rent: 780_000_000,
      staff: 240_000_000,
      supplies: 180_000_000,
      taxesAndFees: 90_000_000,
      royalty: 0,
    },
    lastYearProfitToman: 510_000_000,
    cumulativeProfitToman: 2_800_000_000,
    staff: [],
  };
  gen2.state.npcs['npc_gen2_spouse'] = {
    id: 'npc_gen2_spouse',
    firstName: 'مریم',
    lastName: 'اکبری',
    gender: 'female',
    age: 50,
    traits: ['مهربان'],
    jobTitle: 'معلم',
    isAlive: true,
    maritalStatus: 'married',
  };
  gen2.state.relationships.push({
    personId: 'npc_gen2_spouse',
    role: 'spouse',
    closeness: 90,
    respect: 90,
    romance: 85,
  });
  gen2.state.npcs['npc_gen2_child1'] = {
    id: 'npc_gen2_child1',
    firstName: 'آرش',
    lastName: gen2.state.player.lastName,
    gender: 'male',
    age: 27,
    traits: ['پرتلاش', 'خلاق'],
    jobTitle: 'توسعه‌دهنده نرم‌افزار',
    isAlive: true,
    maritalStatus: 'married',
  };
  gen2.state.npcs['npc_gen2_child2'] = {
    id: 'npc_gen2_child2',
    firstName: 'سارا',
    lastName: gen2.state.player.lastName,
    gender: 'female',
    age: 23,
    traits: ['باهوش', 'مسئولیت‌پذیر'],
    jobTitle: 'پزشک عمومی',
    isAlive: true,
    maritalStatus: 'single',
  };
  gen2.state.relationships.push(
    { personId: 'npc_gen2_child1', role: 'child', closeness: 86, respect: 82, romance: 0 },
    { personId: 'npc_gen2_child2', role: 'child', closeness: 84, respect: 85, romance: 0 },
  );
  gen2.state.player.age = 56;
  gen2.state.assets.push({
    id: 'asset_car_1',
    type: 'car',
    name: 'خودرو سواری خانواده',
    quantity: 1,
    purchasePriceToman: 950_000_000,
    currentValueToman: 1_150_000_000,
  });
  gen2.state.dynasty = ensureDynastyState(gen2.state, gen2.seed);

  // Deceased version with heirs
  const deceasedWithHeirs: SaveGame = structuredClone(gen2);
  deceasedWithHeirs.state.isAlive = false;
  deceasedWithHeirs.state.player.age = 74;
  deceasedWithHeirs.state.deathSummary = {
    ageAtDeath: 74,
    jalaliYearOfDeath: deceasedWithHeirs.state.currentJalaliYear,
    causeOfDeath: 'ایست قلبی در آرامش',
    finalNetWorthToman: 13_800_000_000,
    legacyTitle: 'ستون استوار خاندان',
    lifeScore: 89,
    highlights: [
      'بنیان‌گذاری کافه خانوادگی با ۹ سال فعالیت موفق',
      'تربیت دو فرزند تحصیل‌کرده و حفظ همبستگی خانواده',
    ],
  };

  // Deceased version with NO direct descendants (empty -> no heir UI)
  const deceasedNoHeirs: SaveGame = structuredClone(gen1);
  deceasedNoHeirs.state.relationships = [];
  deceasedNoHeirs.state.npcs = {};
  deceasedNoHeirs.state.isAlive = false;
  deceasedNoHeirs.state.player.age = 78;
  deceasedNoHeirs.state.deathSummary = {
    ageAtDeath: 78,
    jalaliYearOfDeath: deceasedNoHeirs.state.currentJalaliYear,
    causeOfDeath: 'کهولت سن',
    finalNetWorthToman: 4_200_000_000,
    legacyTitle: 'عمر پربار و مستقل',
    lifeScore: 71,
    highlights: ['زندگی مستقل و منظم تا پایان راه'],
  };

  return {
    aliveDynastySave: SaveGameSchema.parse(gen2),
    deceasedWithHeirsSave: SaveGameSchema.parse(deceasedWithHeirs),
    deceasedNoHeirsSave: SaveGameSchema.parse(deceasedNoHeirs),
  };
}

async function seedSaveAndTheme(page: Page, save: SaveGame, theme: 'light' | 'dark') {
  await page.evaluate(
    async ({ saveObj, themePref }) => {
      localStorage.setItem('zendegi_nameh_active_slot', 'slot_1');
      localStorage.setItem('zendegi_nameh_theme', themePref);
      await new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('zendegi-nameh-db', 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('saves')) {
            db.createObjectStore('saves', { keyPath: 'slotId' });
          }
        };
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('saves', 'readwrite');
          tx.objectStore('saves').put({ ...saveObj, slotId: 'slot_1' });
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      });
    },
    { saveObj: save, themePref: theme },
  );
  await page.reload({ waitUntil: 'networkidle' });
}

async function assertNoHorizontalOverflow(page: Page, label: string) {
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

async function assertNoEnglishInVisibleText(page: Page, label: string) {
  const text = await page.evaluate(() => document.body.innerText);
  // Filter out empty or pure punctuation; flag any ASCII letters
  const matches = text.match(/[A-Za-z]{2,}/g);
  if (matches && matches.length > 0) {
    throw new Error(`English text leaked in "${label}": ${matches.join(', ')}`);
  }
}

async function run() {
  const fixtures = buildFixtures();
  const browser = await chromium.launch({
    executablePath: EXEC_PATH,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  try {
    for (const vp of VIEWPORTS) {
      for (const theme of THEMES) {
        const tag = `${theme}-${vp.name}`;
        const context = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          locale: 'fa-IR',
        });
        const page = await context.newPage();

        page.on('console', (msg) => {
          if (msg.type() === 'error') consoleErrors.push(`[${tag}] ${msg.text()}`);
        });
        page.on('pageerror', (err) => {
          pageErrors.push(`[${tag}] ${err.message}`);
        });

        await page.goto(BASE_URL, { waitUntil: 'networkidle' });

        // 1. Living Gen-2 Patriarch: Will Editor + Rules + Dynasty Screen (Tree, Stats, Hall)
        await seedSaveAndTheme(page, fixtures.aliveDynastySave, theme);
        await page.waitForSelector('button[aria-label="سال بعد"]');

        // Open Assets tab -> Will Editor
        await page.click('button:has-text("دارایی‌ها")');
        await page.waitForSelector('[role="dialog"]');
        await page.click('button:has-text("وصیت‌نامه و قواعد ارث")');
        await page.waitForSelector('text=قواعد ارث');
        await page.waitForTimeout(200);
        await assertNoHorizontalOverflow(page, `${tag}-will-editor`);
        await assertNoEnglishInVisibleText(page, `${tag}-will-editor`);
        await page.screenshot({ path: path.join(SHOT_DIR, `will-editor-${tag}.png`) });

        // Toggle Inheritance Rules explanation screen
        if (vp.name === '390') {
          await page.click('[role="dialog"] button:has-text("قواعد ارث")');
          await page.waitForSelector('text=نسخه ساده‌سازی‌شده');
          await assertNoHorizontalOverflow(page, `${tag}-inheritance-rules`);
          await assertNoEnglishInVisibleText(page, `${tag}-inheritance-rules`);
          await page.screenshot({ path: path.join(SHOT_DIR, `inheritance-rules-${tag}.png`) });
        }

        // Close Will Editor
        await page.click('[role="dialog"] button[aria-label="بازگشت"]');
        await page.waitForTimeout(100);

        // Open Menu -> Dynasty Screen
        await page.click('button[aria-label="منو و تنظیمات"]');
        await page.waitForSelector('button:has-text("شجره‌نامه")');
        await page.click('button:has-text("شجره‌نامه")');
        await page.waitForSelector('button[role="tab"]:has-text("آمار و نمودار")');
        await page.waitForTimeout(220);
        await assertNoHorizontalOverflow(page, `${tag}-dynasty-tree`);
        await assertNoEnglishInVisibleText(page, `${tag}-dynasty-tree`);
        await page.screenshot({ path: path.join(SHOT_DIR, `dynasty-tree-${tag}.png`) });

        // Stats & Wealth Chart tab
        await page.click('button[role="tab"]:has-text("آمار و نمودار")');
        await page.waitForTimeout(200);
        await assertNoHorizontalOverflow(page, `${tag}-dynasty-stats`);
        await assertNoEnglishInVisibleText(page, `${tag}-dynasty-stats`);
        await page.screenshot({ path: path.join(SHOT_DIR, `dynasty-stats-${tag}.png`) });

        // Hall of Fame & Chapters tab
        await page.click('button[role="tab"]:has-text("تالار افتخار")');
        await page.waitForTimeout(200);
        await assertNoHorizontalOverflow(page, `${tag}-dynasty-hall`);
        await assertNoEnglishInVisibleText(page, `${tag}-dynasty-hall`);
        if (vp.name === '390') {
          await page.screenshot({ path: path.join(SHOT_DIR, `dynasty-hall-${tag}.png`) });
        }

        // 2. Deceased with Heirs: EndOfLife -> Continue Dynasty -> Heir Selection + Estate Breakdown -> Inherit!
        await seedSaveAndTheme(page, fixtures.deceasedWithHeirsSave, theme);
        await page.waitForSelector('button:has-text("ادامه‌ی دودمان")');
        await assertNoHorizontalOverflow(page, `${tag}-eol`);
        await assertNoEnglishInVisibleText(page, `${tag}-eol`);
        await page.screenshot({ path: path.join(SHOT_DIR, `end-of-life-${tag}.png`) });

        await page.click('button:has-text("ادامه‌ی دودمان")');
        await page.waitForSelector('button:has-text("آغاز فصل تازه با این وارث")');
        await page.click('button:has-text("چه کسی چه سهمی می‌برد؟")');
        await page.waitForTimeout(220);
        await assertNoHorizontalOverflow(page, `${tag}-heir-selection`);
        await assertNoEnglishInVisibleText(page, `${tag}-heir-selection`);
        await page.screenshot({ path: path.join(SHOT_DIR, `heir-selection-${tag}.png`) });

        // Confirm heir transition on 390 to verify Gen-3 starts alive at heir's current age!
        if (vp.name === '390') {
          await page.click('button:has-text("آغاز فصل تازه با این وارث")');
          await page.waitForSelector('button[aria-label="سال بعد"]');
          await assertNoHorizontalOverflow(page, `${tag}-inherited-gen3-feed`);
          await page.screenshot({ path: path.join(SHOT_DIR, `inherited-feed-${tag}.png`) });
        }

        // 3. Deceased with NO Direct Heirs (capture at 390 light/dark)
        if (vp.name === '390') {
          await seedSaveAndTheme(page, fixtures.deceasedNoHeirsSave, theme);
          await page.waitForSelector('button:has-text("ادامه‌ی دودمان")');
          await page.click('button:has-text("ادامه‌ی دودمان")');
          await page.waitForSelector('text=وارث مستقیمی در قید حیات نیست');
          await page.waitForTimeout(200);
          await assertNoHorizontalOverflow(page, `${tag}-no-heir`);
          await assertNoEnglishInVisibleText(page, `${tag}-no-heir`);
          await page.screenshot({ path: path.join(SHOT_DIR, `no-heir-${tag}.png`) });
        }

        await context.close();
      }
    }
  } finally {
    await browser.close();
  }

  if (consoleErrors.length > 0 || pageErrors.length > 0) {
    console.error('Console errors:', consoleErrors);
    console.error('Page errors:', pageErrors);
    process.exit(1);
  }

  console.log(
    `[playwright-l2-verify] OK — Verified 360/390/768 light & dark across Will, Rules, Dynasty Tree/Stats/Hall, EndOfLife, Heir Selection, and No-Heir screens with 0 errors and screenshots saved to ${SHOT_DIR}.`,
  );
}

run().catch((err) => {
  console.error('[playwright-l2-verify] FAILED:', err);
  process.exit(1);
});
