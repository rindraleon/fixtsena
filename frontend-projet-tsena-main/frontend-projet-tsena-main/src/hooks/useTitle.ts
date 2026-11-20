import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { env } from '../lib/env';
import { SITE } from '../lib/site';

export const APP_NAME = SITE.name;

export interface SeoOptions {
  readonly description?: string;
  readonly noindex?: boolean;
  readonly image?: string;
  readonly type?: 'website' | 'product' | 'article';
}

function upsertMeta(selector: string, attrs: Record<string, string>): HTMLMetaElement {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    document.head.appendChild(el);
  }
  Object.entries(attrs).forEach(([key, value]) => el!.setAttribute(key, value));
  return el;
}

function upsertLink(rel: string, href: string): void {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
}

const PRIVATE_PREFIXES = ['/dashboard', '/commande', '/reinitialiser-mot-de-passe', '/verification-email'];

export function isPrivatePath(pathname: string): boolean {
  return PRIVATE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`) || pathname.startsWith(`${prefix}?`));
}

function canonicalFor(pathname: string, search: string): string {
  const base = env.siteUrl;
  const path = pathname === '/' ? '/' : pathname.replace(/\/+$/, '');
  const prefix = env.routerMode === 'hash' ? '/#' : '';
  return `${base}${prefix}${path}${search}`;
}

export default function useTitle(title: string, options: SeoOptions = {}) {
  const { pathname, search } = useLocation();
  const { description, image, type = 'website' } = options;
  const noindex = options.noindex ?? isPrivatePath(pathname);

  useEffect(() => {
    const previousTitle = document.title;
    const fullTitle = title ? `${title} | ${APP_NAME}` : `${APP_NAME} — ${SITE.tagline}`;
    const desc = description?.trim() || SITE.description;
    const canonical = canonicalFor(pathname, '');
    const ogImage = image || `${env.siteUrl}/og-image.png`;

    document.title = fullTitle;
    upsertMeta('meta[name="description"]', { name: 'description', content: desc });
    upsertMeta('meta[name="robots"]', { name: 'robots', content: noindex ? 'noindex, nofollow' : 'index, follow' });
    upsertLink('canonical', canonical);
    upsertMeta('meta[property="og:title"]', { property: 'og:title', content: fullTitle });
    upsertMeta('meta[property="og:description"]', { property: 'og:description', content: desc });
    upsertMeta('meta[property="og:url"]', { property: 'og:url', content: canonical });
    upsertMeta('meta[property="og:type"]', { property: 'og:type', content: type });
    upsertMeta('meta[property="og:image"]', { property: 'og:image', content: ogImage });
    upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: fullTitle });
    upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: desc });
    upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: ogImage });

    return () => {
      document.title = previousTitle;
    };
  }, [title, description, noindex, image, type, pathname, search]);
}
