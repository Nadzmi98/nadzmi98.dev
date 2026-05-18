import { getEntry, render } from 'astro:content';

export async function getHomeContent() {
  const entry = await getEntry('site', 'home');
  if (!entry) throw new Error('Missing home content');
  return entry.data;
}

export async function getAboutContent() {
  const entry = await getEntry('site', 'about');
  if (!entry) throw new Error('Missing about content');
  const rendered = await render(entry);
  return { data: entry.data, Content: rendered.Content };
}
