#!/usr/bin/env node
/**
 * Writes public/sitemap.xml from the pages on disk, using the homepage canonical as the domain.
 * Run after adding or removing a page:   npm run sitemap
 */
import { writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pages, origin, pub } from './lib.mjs';

const base = origin();
const urls = pages().filter(p => !p.is404).map(p => base + p.url);
const xml = ['<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...urls.map(u => `  <url><loc>${u}</loc></url>`),
  '</urlset>', ''].join('\n');
writeFileSync(join(pub, 'sitemap.xml'), xml);
console.log(`sitemap.xml written: ${urls.length} URLs on ${base}`);
