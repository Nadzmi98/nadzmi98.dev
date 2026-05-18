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

## Cloudflare Workers deployment

This repo also includes a minimal `wrangler.jsonc` for Cloudflare's newer Workers flow:

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`

## Admin setup

The private admin lives at `/admin` and expects two Worker secrets:

- `GITHUB_TOKEN`: a GitHub token with permission to read and write this repository
- `ADMIN_EMAIL`: the single email address allowed through the admin API

Protect both `/admin*` and `/api/admin/*` with Cloudflare Access so only your account can reach them.
