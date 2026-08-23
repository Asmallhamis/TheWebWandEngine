import { expect, test } from '@playwright/test';

test.setTimeout(60_000);

test('在线折叠应与原有事后折叠结果一致', async ({ page }) => {
  await page.goto('/__evaltest8.html');
  await page.waitForFunction(() => (window as any).__ready === true);

  const spells = {
    '15': 'OMEGA',
    '18': 'LIGHT_BULLET',
    '19': 'DIVIDE_10',
    '20': 'OMEGA',
    '21': 'HEAL_BULLET',
    '22': 'DIVIDE_4',
    '23': 'DIVIDE_2',
    '24': 'OMEGA',
    '25': 'LIGHT_BULLET',
    '26': 'LIGHT_BULLET',
    '27': 'LIGHT_BULLET',
    '28': 'LIGHT_BULLET',
    '29': 'LIGHT_BULLET',
  };
  const spellUses = { '21': 0 };

  const run = (incrementalFold: boolean) => page.evaluate(
    ({ spells, spellUses, incrementalFold }) => (window as any).__runComplex(
      spells,
      spellUses,
      20_000,
      {
        numCasts: 1,
        timelineEventLimit: 0,
        timelineStream: false,
        incrementalFold,
        returnTreeJson: true,
      },
    ),
    { spells, spellUses, incrementalFold },
  );

  const incremental = await run(true);
  const legacy = await run(false);

  expect(incremental.ok, `在线折叠失败: ${incremental.error}`).toBe(true);
  expect(legacy.ok, `事后折叠失败: ${legacy.error}`).toBe(true);
  expect(incremental.counts).toEqual(legacy.counts);
  expect(incremental.castCounts).toEqual(legacy.castCounts);
  expect(incremental.treeJson).toBe(legacy.treeJson);
});
