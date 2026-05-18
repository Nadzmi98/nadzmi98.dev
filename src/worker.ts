export interface Env {
  ASSETS: Fetcher;
  GITHUB_TOKEN: string;
  ADMIN_EMAIL?: string;
}

type PostPayload = {
  id: string;
  title: string;
  description: string;
  date: string;
  draft: boolean;
  body: string;
};

type GitHubFile = { content: string; sha: string };

const owner = 'Nadzmi98';
const repo = 'nadzmi98.dev';
const branch = 'main';
const githubApi = 'https://api.github.com';

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, init);
}

function unauthorized() {
  return new Response('Unauthorized', { status: 401 });
}

function assertAdmin(request: Request, env: Env) {
  const email = request.headers.get('Cf-Access-Authenticated-User-Email');
  return Boolean(email && (!env.ADMIN_EMAIL || email.toLowerCase() === env.ADMIN_EMAIL.toLowerCase()));
}

async function gh<T>(env: Env, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${githubApi}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${env.GITHUB_TOKEN}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

async function getFile(env: Env, path: string): Promise<GitHubFile> {
  const file = await gh<{ content: string; sha: string }>(env, `/repos/${owner}/${repo}/contents/${path}?ref=${branch}`);
  return { content: atob(file.content.replace(/\n/g, '')), sha: file.sha };
}

async function putFile(env: Env, path: string, content: string, message: string, sha?: string) {
  return gh(env, `/repos/${owner}/${repo}/contents/${path}`, {
    method: 'PUT',
    body: JSON.stringify({
      message,
      content: btoa(unescape(encodeURIComponent(content))),
      branch,
      ...(sha ? { sha } : {}),
    }),
  });
}

async function deleteFile(env: Env, path: string, sha: string, message: string) {
  return gh(env, `/repos/${owner}/${repo}/contents/${path}`, {
    method: 'DELETE',
    body: JSON.stringify({ message, sha, branch }),
  });
}

function parseMarkdown(raw: string) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { data: {} as Record<string, string>, body: raw };
  const data: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const index = line.indexOf(':');
    if (index === -1) continue;
    data[line.slice(0, index).trim()] = line.slice(index + 1).trim();
  }
  return { data, body: match[2].trim() };
}

function quote(value: string) {
  return /[:#\n]/.test(value) ? JSON.stringify(value) : value;
}

function renderPost(post: PostPayload) {
  return `---\ntitle: ${quote(post.title)}\ndescription: ${quote(post.description)}\ndate: ${post.date}\ndraft: ${post.draft}\n---\n\n${post.body.trim()}\n`;
}

function renderHome(home: { heading: string; intro: string }) {
  return `---\nheading: ${quote(home.heading)}\nintro: ${quote(home.intro)}\n---\n`;
}

function renderAbout(about: { title: string; body: string }) {
  return `---\ntitle: ${quote(about.title)}\n---\n\n${about.body.trim()}\n`;
}

function slugify(input: string) {
  return input.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function listPosts(env: Env) {
  const files = await gh<Array<{ name: string; path: string }>>(env, `/repos/${owner}/${repo}/contents/src/content/blog?ref=${branch}`);
  const posts = await Promise.all(files.filter((file) => file.name.endsWith('.md')).map(async (file) => {
    const raw = await getFile(env, file.path);
    const parsed = parseMarkdown(raw.content);
    return {
      id: file.name.replace(/\.md$/, ''),
      title: parsed.data.title ?? '',
      description: parsed.data.description ?? '',
      date: parsed.data.date ?? '',
      draft: parsed.data.draft === 'true',
      body: parsed.body,
    } satisfies PostPayload;
  }));
  return posts.sort((a, b) => b.date.localeCompare(a.date));
}

async function handleApi(request: Request, env: Env) {
  if (!assertAdmin(request, env)) return unauthorized();
  const url = new URL(request.url);

  if (url.pathname === '/api/admin/content' && request.method === 'GET') {
    const [posts, homeFile, aboutFile] = await Promise.all([
      listPosts(env),
      getFile(env, 'src/content/site/home.md'),
      getFile(env, 'src/content/site/about.md'),
    ]);
    const homeParsed = parseMarkdown(homeFile.content);
    const aboutParsed = parseMarkdown(aboutFile.content);
    return json({
      posts,
      home: { heading: homeParsed.data.heading ?? '', intro: homeParsed.data.intro ?? '' },
      about: { title: aboutParsed.data.title ?? 'About', body: aboutParsed.body },
    });
  }

  if (url.pathname === '/api/admin/posts' && request.method === 'POST') {
    const post = await request.json<PostPayload>();
    const id = post.id || slugify(post.title);
    if (!id) return new Response('Post title is required', { status: 400 });
    const path = `src/content/blog/${id}.md`;
    let sha: string | undefined;
    try { sha = (await getFile(env, path)).sha; } catch {}
    await putFile(env, path, renderPost({ ...post, id }), `${sha ? 'Update' : 'Create'} post: ${post.title}`, sha);
    return json({ ...post, id });
  }

  if (url.pathname === '/api/admin/posts' && request.method === 'DELETE') {
    const { id } = await request.json<{ id: string }>();
    const path = `src/content/blog/${id}.md`;
    const file = await getFile(env, path);
    await deleteFile(env, path, file.sha, `Delete post: ${id}`);
    return json({ ok: true });
  }

  if (url.pathname === '/api/admin/pages/home' && request.method === 'POST') {
    const payload = await request.json<{ heading: string; intro: string }>();
    const file = await getFile(env, 'src/content/site/home.md');
    await putFile(env, 'src/content/site/home.md', renderHome(payload), 'Update homepage copy', file.sha);
    return json({ ok: true });
  }

  if (url.pathname === '/api/admin/pages/about' && request.method === 'POST') {
    const payload = await request.json<{ title: string; body: string }>();
    const file = await getFile(env, 'src/content/site/about.md');
    await putFile(env, 'src/content/site/about.md', renderAbout(payload), 'Update about page copy', file.sha);
    return json({ ok: true });
  }

  if (url.pathname === '/api/admin/upload' && request.method === 'POST') {
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return new Response('Image file is required', { status: 400 });
    const ext = file.name.split('.').pop() || 'bin';
    const filename = `${Date.now()}-${slugify(file.name.replace(/\.[^.]+$/, ''))}.${ext}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = '';
    bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
    await gh(env, `/repos/${owner}/${repo}/contents/public/uploads/${filename}`, {
      method: 'PUT',
      body: JSON.stringify({
        message: `Upload image: ${filename}`,
        content: btoa(binary),
        branch,
      }),
    });
    return json({ url: `/uploads/${filename}` });
  }

  return new Response('Not found', { status: 404 });
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/admin/')) {
      try {
        return await handleApi(request, env);
      } catch (error) {
        return new Response(error instanceof Error ? error.message : 'Unknown error', { status: 500 });
      }
    }
    return env.ASSETS.fetch(request);
  },
};
