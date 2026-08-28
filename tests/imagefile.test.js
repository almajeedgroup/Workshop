import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fitDimensions, dataUrlBytes, isSupportedImage, MAX_IMAGE_PX,
} from '../src/lib/imagefile.js';

test('fit: an image already small enough is left alone', () => {
  assert.deepEqual(fitDimensions(300, 300, 480), { width: 300, height: 300 });
  assert.deepEqual(fitDimensions(480, 200, 480), { width: 480, height: 200 });
});

test('fit: a large square shrinks to the limit', () => {
  assert.deepEqual(fitDimensions(2000, 2000, 480), { width: 480, height: 480 });
});

test('fit: aspect ratio survives the shrink', () => {
  const { width, height } = fitDimensions(1600, 800, 480);
  assert.equal(width, 480);
  assert.equal(height, 240);
});

test('fit: a very thin image never loses its last pixel', () => {
  const { width, height } = fitDimensions(4000, 3, 480);
  assert.equal(width, 480);
  assert.equal(height, 1);
});

test('fit: nonsense dimensions give nothing rather than NaN', () => {
  assert.deepEqual(fitDimensions(0, 100), { width: 0, height: 0 });
  assert.deepEqual(fitDimensions(NaN, NaN), { width: 0, height: 0 });
  assert.deepEqual(fitDimensions(-10, -10), { width: 0, height: 0 });
});

test('fit: the default limit is the shared constant', () => {
  assert.deepEqual(fitDimensions(1000, 1000), { width: MAX_IMAGE_PX, height: MAX_IMAGE_PX });
});

test('bytes: measures the stored string, and tolerates nothing', () => {
  assert.equal(dataUrlBytes('data:image/png;base64,AAAA'), 26);
  assert.equal(dataUrlBytes(''), 0);
  assert.equal(dataUrlBytes(undefined), 0);
  assert.equal(dataUrlBytes(null), 0);
});

test('types: the formats a browser can draw are accepted', () => {
  for (const t of ['image/png', 'image/jpeg', 'image/webp', 'IMAGE/PNG']) {
    assert.equal(isSupportedImage(t), true, t);
  }
});

test('types: a PDF or a missing type is refused', () => {
  for (const t of ['application/pdf', 'text/plain', '', undefined, 'image/svg+xml']) {
    assert.equal(isSupportedImage(t), false, String(t));
  }
});
