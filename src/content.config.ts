import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blog = defineCollection({
  loader: glob({ base: './src/content/blog', pattern: '**/*.md' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    draft: z.boolean().default(false),
  }),
});

const site = defineCollection({
  loader: glob({ base: './src/content/site', pattern: '**/*.md' }),
  schema: z.object({
    heading: z.string().optional(),
    intro: z.string().optional(),
    title: z.string().optional(),
  }),
});

export const collections = { blog, site };
