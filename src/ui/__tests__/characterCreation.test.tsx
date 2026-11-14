import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import { CharacterCreation } from '../CharacterCreation';

describe('CharacterCreation Screen', () => {
  it('renders clean identity options without seed input, stat preview bars, or reroll stats button', () => {
    const html = renderToStaticMarkup(
      <CharacterCreation targetSlotId="slot_1" onCreate={() => {}} />,
    );

    // Required clean controls
    expect(html).toContain('شروع زندگی');
    expect(html).toContain('شروع کاملاً تصادفی');
    expect(html).toContain('تنظیمات پیشرفته');
    expect(html).toContain('هویت آغازین');
    expect(html).toContain('پیشنهاد نام');

    // Forbidden seed / stat-preview / reroll elements
    expect(html).not.toContain('بذر سرنوشت');
    expect(html).not.toContain('تاس مجدد');
    expect(html).not.toContain('پیش‌نمایش شناسنامه');
    expect(html).not.toContain('سرشت متعادل');
    expect(html).not.toContain('استعداد درخشان');
    expect(html).not.toContain('خوش‌اقبال');
    expect(html).not.toContain('سلامت');
    expect(html).not.toContain('شادی');
    expect(html).not.toContain('هوش');
    expect(html).not.toContain('جذابیت');
    expect(html).not.toContain('progressbar');
  });
});
