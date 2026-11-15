import { expect, test } from 'bun:test';
import { handle } from '../src/index.js';
import { LAB_CARDS } from '../src/labs.js';

async function canonicals(path, env = {}, origin = 'https://learn.flisk.si') {
  const values = [];
  const res = await handle(new Request(`${origin}${path}`), env);
  await new HTMLRewriter().on('head link[rel="canonical"]', {
    element: (e) => values.push(e.getAttribute('href')),
  }).transform(res).text();
  return values;
}

test.each(['/', '/?utm_source=test', '/?a=1&b=2', '/learn?question=test'])('home canonical ignores the query and Learn alias: %s', async (path) => {
  expect(await canonicals(path)).toEqual(['https://learn.flisk.si/']);
});

test.each(['https://learn.flisk.si', 'https://learn.flisk.si/'])('canonical uses the configured public origin %s', async (origin) => {
  expect(await canonicals('/?source=preview', { PUBLIC_ORIGIN: origin }, 'https://preview.test')).toEqual(['https://learn.flisk.si/']);
});

test.each(['/', '/practice', '/exam'])('alternate-host %s defaults to the primary public origin', async (path) => {
  expect(await canonicals(`${path}?source=preview`, {}, 'https://preview.test')).toEqual([`https://learn.flisk.si${path}`]);
});

test('an explicit public origin still overrides the primary canonical default', async () => {
  expect(await canonicals('/practice?source=preview', { PUBLIC_ORIGIN: 'https://academy.example/' }, 'https://preview.test')).toEqual(['https://academy.example/practice']);
});

test.each(['/practice', '/exam'])('the shared head gives %s its own path without the query', async (path) => {
  expect(await canonicals(`${path}?source=test`)).toEqual([`https://learn.flisk.si${path}`]);
});

test('a lab has its own canonical URL', async () => {
  const path = `/practice/${LAB_CARDS[0].id}`;
  expect(await canonicals(`${path}?step=2`)).toEqual([`https://learn.flisk.si${path}`]);
});

test('signed-in pages keep the same canonical and private cache policy', async () => {
  expect(await canonicals('/', { DEV_LOGIN: 'test-learner' })).toEqual(['https://learn.flisk.si/']);
  const res = await handle(new Request('https://learn.flisk.si/'), { DEV_LOGIN: 'test-learner' });
  expect(res.headers.get('cache-control')).toBe('no-store');
});

test('error pages do not advertise a canonical URL', async () => {
  expect(await canonicals('/missing')).toEqual([]);
  expect(await canonicals('/auth/login')).toEqual([]);
});
