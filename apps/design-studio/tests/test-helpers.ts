import assert from 'node:assert/strict';

type Matcher = RegExp | string;

export function expect(actual: unknown, message?: string) {
  const build = (negated: boolean) => ({
    toBe(expected: unknown) { negated ? assert.notStrictEqual(actual, expected, message) : assert.strictEqual(actual, expected, message); },
    toEqual(expected: unknown) { negated ? assert.notDeepStrictEqual(actual, expected, message) : assert.deepStrictEqual(actual, expected, message); },
    toBeDefined() { negated ? assert.strictEqual(actual, undefined, message) : assert.notStrictEqual(actual, undefined, message); },
    toBeTruthy() { negated ? assert.ok(!actual, message) : assert.ok(actual, message); },
    toContain(expected: unknown) {
      const contains = typeof actual === 'string' ? actual.includes(String(expected)) : Array.isArray(actual) ? actual.includes(expected) : false;
      negated ? assert.ok(!contains, message) : assert.ok(contains, message);
    },
    toHaveLength(expected: number) { const length = (actual as { length?: number })?.length; negated ? assert.notStrictEqual(length, expected, message) : assert.strictEqual(length, expected, message); },
    toBeGreaterThan(expected: number) { negated ? assert.ok(!(Number(actual) > expected), message) : assert.ok(Number(actual) > expected, message); },
    toBeGreaterThanOrEqual(expected: number) { negated ? assert.ok(!(Number(actual) >= expected), message) : assert.ok(Number(actual) >= expected, message); },
    toBeCloseTo(expected: number, precision = 2) { const close = Math.abs(Number(actual) - expected) <= 10 ** -precision / 2; negated ? assert.ok(!close, message) : assert.ok(close, `${message ?? ''} expected ${actual} to be close to ${expected}`); },
    toMatch(expected: Matcher) { const matched = typeof expected === 'string' ? String(actual).includes(expected) : expected.test(String(actual)); negated ? assert.ok(!matched, message) : assert.ok(matched, message); },
    toThrow(expected?: Matcher) {
      assert.strictEqual(typeof actual, 'function', 'toThrow requires a function');
      if (negated) assert.doesNotThrow(actual as () => void); else assert.throws(actual as () => void, expected instanceof RegExp ? expected : expected ? new RegExp(expected) : undefined);
    },
  });
  const positive = build(false);
  return Object.assign(positive, {
    not: build(true),
    rejects: {
      async toThrow(expected?: Matcher) {
        assert.ok(actual instanceof Promise, 'rejects.toThrow requires a Promise');
        await assert.rejects(actual, expected instanceof RegExp ? expected : expected ? new RegExp(expected) : undefined);
      },
    },
  });
}
