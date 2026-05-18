<script lang="ts">
  type Post = {
    id: string;
    title: string;
    description: string;
    date: string;
    draft: boolean;
    body: string;
  };

  type Home = { heading: string; intro: string };
  type About = { title: string; body: string };

  let posts: Post[] = [];
  let selectedPost: Post | null = null;
  let home: Home = { heading: '', intro: '' };
  let about: About = { title: 'About', body: '' };
  let tab: 'posts' | 'home' | 'about' = 'posts';
  let status = 'Loading…';
  let busy = false;

  async function api<T>(path: string, init?: RequestInit): Promise<T> {
    const headers = new Headers(init?.headers);
    if (init?.body && !headers.has('content-type')) {
      headers.set('content-type', 'application/json');
    }
    const response = await fetch(path, {
      ...init,
      credentials: 'same-origin',
      headers,
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  }

  async function load() {
    try {
      const data = await api<{ posts: Post[]; home: Home; about: About }>('/api/admin/content');
      posts = data.posts;
      home = data.home;
      about = data.about;
      selectedPost = posts[0] ?? newPost();
      status = 'Ready';
    } catch (error) {
      status = error instanceof Error ? error.message : 'Could not load content';
    }
  }

  function newPost(): Post {
    return {
      id: '',
      title: '',
      description: '',
      date: new Date().toISOString().slice(0, 10),
      draft: true,
      body: '',
    };
  }

  async function savePost() {
    if (!selectedPost) return;
    busy = true;
    try {
      const saved = await api<Post>('/api/admin/posts', {
        method: 'POST',
        body: JSON.stringify(selectedPost),
      });
      const existing = posts.findIndex((post) => post.id === saved.id);
      if (existing >= 0) posts[existing] = saved;
      else posts = [saved, ...posts];
      selectedPost = saved;
      status = saved.draft ? 'Draft saved' : 'Post published';
    } catch (error) {
      status = error instanceof Error ? error.message : 'Could not save post';
    } finally {
      busy = false;
    }
  }

  async function deletePost() {
    if (!selectedPost?.id || !confirm('Delete this post?')) return;
    busy = true;
    try {
      await api('/api/admin/posts', {
        method: 'DELETE',
        body: JSON.stringify({ id: selectedPost.id }),
      });
      posts = posts.filter((post) => post.id !== selectedPost?.id);
      selectedPost = posts[0] ?? newPost();
      status = 'Post deleted';
    } catch (error) {
      status = error instanceof Error ? error.message : 'Could not delete post';
    } finally {
      busy = false;
    }
  }

  async function savePage(kind: 'home' | 'about') {
    busy = true;
    try {
      await api(`/api/admin/pages/${kind}`, {
        method: 'POST',
        body: JSON.stringify(kind === 'home' ? home : about),
      });
      status = `${kind === 'home' ? 'Homepage' : 'About page'} saved`;
    } catch (error) {
      status = error instanceof Error ? error.message : `Could not save ${kind}`;
    } finally {
      busy = false;
    }
  }

  async function uploadImage(file: File) {
    const body = new FormData();
    body.append('file', file);
    const response = await fetch('/api/admin/upload', {
      method: 'POST',
      body,
      credentials: 'same-origin',
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json() as Promise<{ url: string }>;
  }

  async function onImageChange(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !selectedPost) return;
    busy = true;
    try {
      const { url } = await uploadImage(file);
      selectedPost.body += `\n\n![${file.name}](${url})\n`;
      status = 'Image uploaded';
    } catch (error) {
      status = error instanceof Error ? error.message : 'Could not upload image';
    } finally {
      busy = false;
      input.value = '';
    }
  }

  load();
</script>

<svelte:head>
  <title>Admin | Nadzmi Writes</title>
</svelte:head>

<div class="admin-shell">
  <aside>
    <div class="brand-block">
      <div class="eyebrow">Private admin</div>
      <h1>Nadzmi Writes</h1>
    </div>

    <nav>
      <button class:active={tab === 'posts'} on:click={() => (tab = 'posts')}>Posts</button>
      <button class:active={tab === 'home'} on:click={() => (tab = 'home')}>Homepage</button>
      <button class:active={tab === 'about'} on:click={() => (tab = 'about')}>About page</button>
    </nav>

    <div class="status-card">
      <span>Status</span>
      <strong>{status}</strong>
    </div>
  </aside>

  <main>
    {#if tab === 'posts'}
      <section class="workspace posts">
        <div class="post-list">
          <div class="section-head">
            <span>Posts</span>
            <button on:click={() => (selectedPost = newPost())}>New</button>
          </div>
          {#each posts as post}
            <button class:selected={selectedPost?.id === post.id} on:click={() => (selectedPost = { ...post })}>
              <strong>{post.title}</strong>
              <span>{post.date} · {post.draft ? 'Draft' : 'Published'}</span>
            </button>
          {/each}
        </div>

        {#if selectedPost}
          <div class="editor">
            <header class="editor-head">
              <div>
                <div class="eyebrow">Post editor</div>
                <h2>{selectedPost.title || 'New post'}</h2>
              </div>
              <label class="checkbox"><input type="checkbox" bind:checked={selectedPost.draft} /> Draft</label>
            </header>

            <div class="meta-grid">
              <label>Title<input bind:value={selectedPost.title} /></label>
              <label>Description<input bind:value={selectedPost.description} /></label>
              <label>Date<input type="date" bind:value={selectedPost.date} /></label>
            </div>

            <label class="body-field">Body<textarea rows="22" bind:value={selectedPost.body}></textarea></label>

            <footer class="editor-foot">
              <label class="upload">Add image<input type="file" accept="image/*" on:change={onImageChange} /></label>
              <div class="actions">
                <button on:click={savePost} disabled={busy}>Save post</button>
                <button class="danger" on:click={deletePost} disabled={busy || !selectedPost.id}>Delete</button>
              </div>
            </footer>
          </div>
        {/if}
      </section>
    {:else if tab === 'home'}
      <section class="workspace single">
        <label>Hero heading<input bind:value={home.heading} /></label>
        <label>Intro copy<textarea rows="5" bind:value={home.intro}></textarea></label>
        <button on:click={() => savePage('home')} disabled={busy}>Save homepage</button>
      </section>
    {:else}
      <section class="workspace single">
        <label>Title<input bind:value={about.title} /></label>
        <label>Body<textarea rows="18" bind:value={about.body}></textarea></label>
        <button on:click={() => savePage('about')} disabled={busy}>Save about page</button>
      </section>
    {/if}
  </main>
</div>

<style>
  :global(body) { margin: 0; background: #f8f6f1; color: #211f1a; font-family: Inter, system-ui, sans-serif; }
  .admin-shell { min-height: 100vh; display: grid; grid-template-columns: 280px minmax(0, 1fr); }
  aside { display: flex; flex-direction: column; gap: 1.5rem; padding: 2rem 1.5rem; border-right: 1px solid #ddd6ca; background: rgba(255, 253, 249, .55); }
  .brand-block h1, .editor-head h2 { font-family: Georgia, serif; letter-spacing: -.03em; }
  .brand-block h1 { margin: .35rem 0 0; font-size: 1.8rem; line-height: 1.15; }
  .eyebrow { color: #6f695f; font-size: .75rem; text-transform: uppercase; letter-spacing: .14em; }
  nav { display: grid; gap: .5rem; }
  nav button { width: 100%; padding: .9rem 1rem; border: 1px solid #ddd6ca; background: transparent; text-align: left; border-radius: 999px; font: inherit; }
  nav button.active { background: #211f1a; color: #fffdf9; border-color: #211f1a; }
  .status-card { margin-top: auto; display: grid; gap: .25rem; padding: 1rem; background: #fffdf9; border: 1px solid #ddd6ca; border-radius: 1rem; }
  .status-card span { color: #6f695f; font-size: .78rem; text-transform: uppercase; letter-spacing: .12em; }
  .status-card strong { font-size: .95rem; }
  main { padding: 2rem; }
  .workspace.posts { display: grid; grid-template-columns: 260px minmax(520px, 1fr); gap: 1.5rem; align-items: start; }
  .post-list { display: grid; gap: .75rem; align-content: start; }
  .section-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: .25rem; }
  .section-head span { color: #6f695f; font-size: .78rem; text-transform: uppercase; letter-spacing: .12em; }
  .section-head button { border: 1px solid #ddd6ca; background: #fffdf9; padding: .45rem .75rem; border-radius: 999px; }
  .post-list > button { padding: 1rem; border: 1px solid #ddd6ca; background: #fffdf9; text-align: left; border-radius: 1rem; }
  .post-list > button.selected { border-color: #55412d; box-shadow: inset 0 0 0 1px #55412d; }
  .post-list span { display: block; color: #6f695f; margin-top: .35rem; font-size: .88rem; }
  .editor, .single { display: grid; gap: 1.25rem; background: #fffdf9; border: 1px solid #ddd6ca; border-radius: 1.5rem; padding: 1.5rem; box-shadow: 0 18px 45px rgba(45, 35, 24, .06); }
  .editor-head { display: flex; justify-content: space-between; gap: 1rem; align-items: flex-start; padding-bottom: 1rem; border-bottom: 1px solid #eee7dc; }
  .editor-head h2 { margin: .2rem 0 0; font-size: 1.7rem; line-height: 1.15; }
  .meta-grid { display: grid; grid-template-columns: 1.1fr 1.2fr 180px; gap: 1rem; }
  label { display: grid; gap: .4rem; color: #554f45; font-size: .86rem; }
  input, textarea { width: 100%; border: 1px solid #ddd6ca; border-radius: .9rem; padding: .9rem 1rem; font: inherit; color: #211f1a; background: #fff; }
  textarea { resize: vertical; line-height: 1.6; }
  .body-field textarea { min-height: 28rem; }
  .checkbox { display: inline-flex; align-items: center; gap: .5rem; color: #211f1a; font-size: .95rem; }
  .checkbox input { width: auto; }
  .editor-foot { display: flex; justify-content: space-between; gap: 1rem; align-items: end; padding-top: 1rem; border-top: 1px solid #eee7dc; }
  .upload { min-width: 240px; }
  .upload input { padding: .65rem; }
  .actions { display: flex; gap: .75rem; }
  button { cursor: pointer; }
  .actions button, .single button { border: 0; background: #211f1a; color: #fffdf9; padding: .85rem 1.1rem; border-radius: 999px; font-weight: 600; }
  .actions .danger { background: #fff3f0; color: #8b2d2d; border: 1px solid #e8c7c0; }
  .single { max-width: 760px; }
  .single textarea { min-height: 10rem; }
  @media (max-width: 980px) {
    .admin-shell, .workspace.posts { grid-template-columns: 1fr; }
    aside { border-right: 0; border-bottom: 1px solid #ddd6ca; }
    .status-card { margin-top: 0; }
    .meta-grid { grid-template-columns: 1fr; }
  }
  @media (max-width: 700px) {
    main { padding: 1rem; }
    .editor, .single { padding: 1rem; border-radius: 1.1rem; }
    .editor-head, .editor-foot { flex-direction: column; align-items: stretch; }
    .upload { min-width: 0; }
  }
</style>
