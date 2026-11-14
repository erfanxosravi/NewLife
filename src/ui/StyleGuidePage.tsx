import { useState } from 'react';
import {
  ActionButton,
  AgeBadge,
  Badge,
  Card,
  ConfirmDialog,
  CurrencyText,
  EmptyState,
  FilterChips,
  ListRow,
  LockedNotice,
  ProgressRing,
  SectionHeader,
  SegmentedControl,
  Slider,
  Sparkline,
  StatBar,
  Toast,
  Toggle,
} from './components/Primitives';
import { BottomSheet } from './components/BottomSheet';
import { FullScreenSheet } from './components/FullScreenSheet';
import {
  IconBackRtl,
  IconBrandMark,
  IconHappiness,
  IconHealth,
  IconLooks,
  IconMentalHealth,
  IconMoon,
  IconSmarts,
  IconStanding,
  IconSun,
} from './icons';
import type { ThemePreference } from '../storage/saveStore';

interface StyleGuidePageProps {
  themePreference: ThemePreference;
  resolvedTheme: 'light' | 'dark';
  onChangeTheme: (next: ThemePreference) => void;
  onExit: () => void;
}

export function StyleGuidePage({
  resolvedTheme,
  onChangeTheme,
  onExit,
}: StyleGuidePageProps) {
  const [segment, setSegment] = useState<'a' | 'b' | 'c'>('a');
  const [filter, setFilter] = useState<'all' | 'work' | 'life'>('all');
  const [toggleOn, setToggleOn] = useState(true);
  const [sliderVal, setSliderVal] = useState(65);
  const [bottomOpen, setBottomOpen] = useState(false);
  const [fullOpen, setFullOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);

  return (
    <div className="flex min-h-[100dvh] w-full justify-center bg-[var(--surface-2)]">
      <div className="flex min-h-[100dvh] w-full max-w-[480px] flex-col bg-[var(--bg)] text-[var(--text)] sm:border-x sm:border-[var(--border)]">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onExit}
              aria-label="بازگشت به بازی"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[var(--text)] hover:bg-[var(--surface-2)]"
            >
              <IconBackRtl className="h-5 w-5" />
            </button>
            <IconBrandMark className="h-7 w-7" />
            <div>
              <h1 className="text-base font-bold">راهنمای اجزا و رنگ‌ها</h1>
              <p className="text-[11px] text-[var(--text-muted)]">طراحی نارنجی و سفید · راست‌به‌چپ</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onChangeTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-xs font-bold text-[var(--text)]"
          >
            {resolvedTheme === 'dark' ? <IconSun className="h-4 w-4" /> : <IconMoon className="h-4 w-4" />}
            <span>{resolvedTheme === 'dark' ? 'روشن' : 'تیره'}</span>
          </button>
        </header>

        <main className="flex-1 space-y-5 p-4 pb-10">
          <Card>
            <SectionHeader title="نمونه رنگ‌های شاخص" subtitle="رنگ‌های متمایز عملکردی" />
            <div className="space-y-2.5">
              <StatBar label="شادی" value={82} delta={4} colorVar="--stat-happiness" icon={<IconHappiness className="h-3.5 w-3.5 text-[var(--stat-happiness)]" />} />
              <StatBar label="سلامت" value={74} delta={-2} colorVar="--stat-health" icon={<IconHealth className="h-3.5 w-3.5 text-[var(--stat-health)]" />} />
              <StatBar label="هوش" value={68} colorVar="--stat-smarts" icon={<IconSmarts className="h-3.5 w-3.5 text-[var(--stat-smarts)]" />} />
              <StatBar label="ظاهر" value={61} colorVar="--stat-looks" icon={<IconLooks className="h-3.5 w-3.5 text-[var(--stat-looks)]" />} />
              <StatBar label="سلامت روان" value={79} colorVar="--stat-mental" icon={<IconMentalHealth className="h-3.5 w-3.5 text-[var(--stat-mental)]" />} />
              <StatBar label="جایگاه اجتماعی" value={44} colorVar="--stat-standing" icon={<IconStanding className="h-3.5 w-3.5 text-[var(--stat-standing)]" />} />
            </div>
          </Card>

          <Card>
            <SectionHeader title="نشان‌ها، مبالغ و حلقه‌های پیشرفت" />
            <div className="flex flex-wrap items-center gap-2">
              <AgeBadge age={24} jalaliYear={1403} />
              <Badge tone="primary">شغل فعلی</Badge>
              <Badge tone="success">تأیید شده</Badge>
              <Badge tone="warning">هشدار مالی</Badge>
              <Badge tone="danger">ریسک بالا</Badge>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-[var(--surface-2)] p-3">
              <div>
                <div className="text-xs text-[var(--text-muted)]">موجودی نمونه</div>
                <div className="text-base font-bold text-[var(--primary-strong)]">
                  <CurrencyText amountToman={1_450_000_000} />
                </div>
              </div>
              <ProgressRing value={17.5} max={20} label="۱۷.۵" />
            </div>
            <div className="mt-3">
              <Sparkline values={[42, 48, 45, 55, 62, 60, 74]} />
            </div>
          </Card>

          <Card className="space-y-3">
            <SectionHeader title="کنترل‌ها و ناوبری" />
            <SegmentedControl
              value={segment}
              onChange={setSegment}
              items={[
                { value: 'a', label: 'تحصیل' },
                { value: 'b', label: 'شغل' },
                { value: 'c', label: 'مهارت‌ها' },
              ]}
            />
            <FilterChips
              value={filter}
              onChange={setFilter}
              items={[
                { value: 'all', label: 'همه' },
                { value: 'work', label: 'فقط کاری' },
                { value: 'life', label: 'شخصی' },
              ]}
            />
            <Slider
              label="تلاش درسی"
              value={sliderVal}
              minLabel="آرام"
              maxLabel="فشرده"
              valueLabel={`${sliderVal}٪`}
              onChange={setSliderVal}
            />
            <Toggle
              checked={toggleOn}
              onChange={setToggleOn}
              label="نمایش رویدادهای اجتماعی"
              description="نمونه سوییچ با توضیح کوتاه"
            />
          </Card>

          <Card className="space-y-2.5">
            <SectionHeader title="دکمه‌های اقدام و ردیف‌ها" />
            <ActionButton
              label="شرکت در دوره تخصصی"
              costText="۴۵ میلیون تومان"
              effectHint="افزایش مهارت و شانس استخدام"
              variant="primary"
              onClick={() => {
                setToastOpen(true);
                window.setTimeout(() => setToastOpen(false), 2200);
              }}
            />
            <ActionButton
              label="مرخصی کوتاه و استراحت"
              costText="رایگان"
              effectHint="سلامت روان +۵"
              variant="secondary"
              onClick={() => setBottomOpen(true)}
            />
            <ActionButton
              label="استعفا از شغل"
              variant="danger"
              onClick={() => setConfirmOpen(true)}
            />
            <ActionButton
              label="اقدام قفل‌شده"
              disabledReason="فقط یک بار در سال"
              disabled
            />
            <ListRow
              title="نمایش برگه تمام‌صفحه"
              subtitle="نمونه ردیف تعاملی با فلش راست‌به‌چپ"
              onClick={() => setFullOpen(true)}
            />
            <LockedNotice message="این بخش از ۱۸ سالگی فعال می‌شود." />
          </Card>

          <EmptyState
            title="نمونه وضعیت خالی"
            description="وقتی هنوز موردی ثبت نشده باشد، این پیام راهنما نمایش داده می‌شود."
          />
        </main>

        <BottomSheet
          open={bottomOpen}
          onClose={() => setBottomOpen(false)}
          title="برگه کشویی نمونه"
          subtitle="قابل کشیدن به پایین برای بستن"
          allowSnapToggle
        >
          <p className="text-xs leading-relaxed text-[var(--text-muted)]">
            این برگه از پایین صفحه باز می‌شود، با کلید Escape یا کشیدن دستگیره بسته می‌شود و از رنگ‌های متغیر تم تبعیت می‌کند.
          </p>
        </BottomSheet>

        <FullScreenSheet
          open={fullOpen}
          onClose={() => setFullOpen(false)}
          title="برگه تمام‌صفحه نمونه"
          subtitle="فلش بازگشت در سمت راست"
        >
          <Card>
            <p className="text-xs leading-relaxed text-[var(--text-muted)]">
              محتوای برگه تمام‌صفحه با فضای امن بالا و پایین برای گوشی‌های امروزی.
            </p>
          </Card>
        </FullScreenSheet>

        <ConfirmDialog
          open={confirmOpen}
          title="تأیید نمونه"
          message="آیا از انجام این عملیات مطمئن هستی؟"
          destructive
          onConfirm={() => setConfirmOpen(false)}
          onCancel={() => setConfirmOpen(false)}
        />

        <Toast visible={toastOpen} message="عملیات نمونه با موفقیت اجرا شد" tone="success" />
      </div>
    </div>
  );
}
