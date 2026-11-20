import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { installMockBackend, resetMockBackend } from './mock-backend';
import { dismissAll } from '../lib/toast';

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
class IntersectionObserverStub {
  readonly root = null;
  readonly rootMargin = '';
  readonly thresholds: readonly number[] = [];
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] { return []; }
}
Object.defineProperty(window, 'ResizeObserver', { writable: true, value: ResizeObserverStub });
Object.defineProperty(window, 'IntersectionObserver', { writable: true, value: IntersectionObserverStub });
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({ matches: false, media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false }),
});
Object.defineProperty(window, 'scrollTo', { writable: true, value: () => {} });
Element.prototype.scrollIntoView = () => {};
if (!('createObjectURL' in URL)) Object.defineProperty(URL, 'createObjectURL', { writable: true, value: () => 'blob:mock' });

installMockBackend();

beforeEach(() => {
  window.localStorage.clear();
  window.location.hash = '';
  resetMockBackend();
  dismissAll();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
