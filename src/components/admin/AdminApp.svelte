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

  const api = async <T>(path: string, init?: RequestInit): Promise<T> => {
    const response = await fetch(path, {
      headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
      ...init,
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  };

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
    const response = await fetch('/api/admin/upload', { method: 'POST', body });
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
    <div class="eyebrow">Private admin</div>
    <h1>Nadzmi Writes</h1>
    <button class:active={tab === 'posts'} on:click={() => (tab = 'posts')}>Posts</button>
    <button class:active={tab === 'home'} on:click={() => (tab = 'home')}>Homepage</button>
    <button class:active={tab === 'about'} on:click={() => (tab = 'about')}>About page</button>
    <p>{status}</p>
  </aside>

  <main>
    {#if tab === 'posts'}
      <section class="workspace posts">
        <div class="post-list">
          <button on:click={() => (selectedPost = newPost())}>+ New post</button>
          {#each posts as post}
            <button class:selected={selectedPost?.id === post.id} on:click={() => (selectedPost = { ...post })}>
              <strong>{post.title}</strong>
              <span>{post.draft ? 'Draft' : 'Published'}</span>
            </button>
          {/each}
        </div>

        {#if selectedPost}
          <div class="editor">
            <label>Title<input bind:value={selectedPost.title} /></label>
            <label>Description<input bind:value={selectedPost.description} /></label>
            <label>Date<input type="date" bind:value={selectedPost.date} /></label>
            <label class="checkbox"><input type="checkbox" bind:checked={selectedPost.draft} /> Draft</label>
            <label>Body<textarea rows="18" bind:value={selectedPost.body}></textarea></label>
            <label class="upload">Add image<input type="file" accept="image/*" on:change={onImageChange} /></label>
            <div class="actions">
              <button on:click={savePost} disabled={busy}>Save</button>
              <button class="danger" on:click={deletePost} disabled={busy || !selectedPost.id}>Delete</button>
            </div>
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
  .admin-shell { min-height: 100vh; display: grid; grid-template-columns: 260px 1fr; }
  aside { padding: 2rem; border-right: 1px solid #ddd6ca; }
  aside h1 { margin: .4rem 0 1.5rem; font-family: Georgia, serif; }
  .eyebrow { color: #6f695f; font-size: .8rem; text-transform: uppercase; letter-spacing: .14em; }
  aside button { display: block; width: 100%; margin-bottom: .5rem; padding: .8rem 1rem; border: 1px solid #ddd6ca; background: transparent; text-align: left; border-radius: 999px; }
  aside button.active { background: #211f1a; color: #fffdf9; }
  aside p { color: #6f695f; font-size: .9rem; }
  main { padding: 2rem; }
  .workspace.posts { display: grid; grid-template-columns: 240px minmax(420px, 1fr); gap: 1.5rem; }
  .post-list { display: grid; gap: .75rem; align-content: start; }
  .post-list button { padding: 1rem; border: 1px solid #ddd6ca; background: #fffdf9; text-align: left; border-radius: 1rem; }
  .post-list button.selected { border-color: #55412d; }
  .post-list span { display: block; color: #6f695f; margin-top: .25rem; }
  .editor, .single { display: grid; gap: 1rem; background: #fffdf9; border: 1px solid #ddd6ca; border-radius: 1.25rem; padding: 1.25rem; }
  label { display: grid; gap: .35rem; font-size: .92rem; }
  input, textarea { width: 100%; border: 1px solid #ddd6ca; border-radius: .75rem; padding: .8rem; font: inherit; background: #fff; }
  textarea { resize: vertical; }
  .checkbox { display: flex; align-items: center; gap: .5rem; }
  .checkbox input { width: auto; }
  .upload input { padding: .55rem; }
  .actions { display: flex; gap: .75rem; }
  button { cursor: pointer; }
  .actions button, .single button { border: 0; background: #211f1a; color: #fffdf9; padding: .8rem 1rem; border-radius: 999px; }
  .actions .danger { background: #8b2d2d; }
  @media (max-width: 800px) {
    .admin-shell, .workspace.posts { grid-template-columns: 1fr; }
  }
</style>
