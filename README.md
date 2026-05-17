# Personal Blog

A small Astro blog with Markdown posts and optional Svelte support.

## Commands

- `npm install`
- `npm run dev`
- `npm run build`
- `npm run preview`

## Writing a post

Create a Markdown file in `src/content/blog/`:

```md
---
title: My post
description: A short summary.
date: 2026-05-17
draft: false
---

Your writing here.
```

Set `draft: true` to keep a post out of the public site.

## Production URL

The site is configured for `https://nadzmi98.dev`.

## Cloudflare Pages deployment

Use these settings when creating the Pages project:

- Build command: `npm run build`
- Output directory: `dist`
