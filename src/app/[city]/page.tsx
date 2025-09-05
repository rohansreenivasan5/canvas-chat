"use client";

import { useCallback, useEffect, useState } from 'react';
import { useParams, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase, type Post, type Comment } from '@/lib/supabase/client';
import { getOrCreateDeviceId } from '@/lib/utils/device';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

type Tab = 'hot' | 'new';

export default function CityPage() {
  const params = useParams<{ city: string }>();
  const citySlug = params?.city as string;

  const pathname = usePathname();
  const search = useSearchParams();

  // Single source of truth
  const tabParam = search.get("t");
  const tab: Tab = tabParam === "new" ? "new" : "hot";
  
  // Debug: log what we're getting from URL
  console.log("URL param 't':", tabParam, "→ tab:", tab);

  const tabClass = (active: boolean) =>
    [
      "px-4 py-2 rounded cursor-pointer",
      active ? "border border-white bg-transparent text-white"
             : "bg-black text-white border border-transparent hover:bg-black/80",
    ].join(" ");

  const [cityId, setCityId] = useState<number | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [body, setBody] = useState('');
  const [commentsByPost, setCommentsByPost] = useState<Record<string, Comment[]>>({});
  const [openThreads, setOpenThreads] = useState<Record<string, boolean>>({});

  const [voteCounts, setVoteCounts] = useState<Record<string, { ups: number; downs: number }>>({});

  const fetchPostsNew = useCallback(async (cid: number) => {
    const { data } = await supabase
      .from('posts')
      .select('*')
      .eq('city_id', cid)
      .order('created_at', { ascending: false })
      .limit(50);
    const list = data ?? [];
    setPosts(list);
    const ids = list.map(p => p.id);
    if (ids.length > 0) {
      const { data: votes } = await supabase.from('post_votes').select('post_id, value').in('post_id', ids);
      const counts: Record<string, { ups: number; downs: number }> = {};
      ids.forEach(id => { counts[id] = { ups: 0, downs: 0 }; });
      (votes ?? []).forEach((r: { post_id: string; value: 1 | -1 }) => {
        const c = counts[r.post_id] ?? (counts[r.post_id] = { ups: 0, downs: 0 });
        if (r.value === 1) c.ups += 1; else c.downs += 1;
      });
      setVoteCounts(counts);
    } else {
      setVoteCounts({});
    }
  }, []);

  const fetchPostsHot = useCallback(async (cid: number) => {
    const { data } = await supabase
      .from('posts')
      .select('*')
      .eq('city_id', cid)
      .limit(100);
    const posts = data ?? [];
    const ids = posts.map(p => p.id);
    let counts: Record<string, { ups: number; downs: number }> = {};
    if (ids.length > 0) {
      const { data: votes } = await supabase.from('post_votes').select('post_id, value').in('post_id', ids);
      counts = {};
      ids.forEach(id => { counts[id] = { ups: 0, downs: 0 }; });
      (votes ?? []).forEach((r: { post_id: string; value: 1 | -1 }) => {
        const c = counts[r.post_id] ?? (counts[r.post_id] = { ups: 0, downs: 0 });
        if (r.value === 1) c.ups += 1; else c.downs += 1;
      });
    }
    const scores = posts.map((p) => {
      const c = counts[p.id] ?? { ups: 0, downs: 0 };
      const totalVotes = c.ups + c.downs;
      const timestamp = new Date(p.created_at).getTime();
      return { post: p, totalVotes, timestamp };
    });
    scores.sort((a, b) => {
      // Primary sort: total votes (ups + downs) descending
      if (b.totalVotes !== a.totalVotes) {
        return b.totalVotes - a.totalVotes;
      }
      // Tiebreaker: newer posts first (higher timestamp)
      return b.timestamp - a.timestamp;
    });
    const ordered = scores.slice(0, 50).map(s => s.post);
    setPosts(ordered);
    setVoteCounts(counts);
  }, []);

  useEffect(() => {
    supabase.from('cities').select('id').eq('slug', citySlug).single().then(({ data }) => {
      if (data) setCityId(data.id);
    });
  }, [citySlug]);

  // Load whenever city or tab changes
  useEffect(() => {
    if (!cityId) return;
    if (tab === 'new') {
      void fetchPostsNew(cityId);
    }
    if (tab === 'hot') {
      void fetchPostsHot(cityId);
    }
    // keep deps small on purpose; fetchers are memoized
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityId, tab]);


  useEffect(() => {
    if (!cityId) return;
    const channel = supabase
      .channel(`posts-${cityId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts', filter: `city_id=eq.${cityId}` }, (payload) => {
        const incoming = payload.new as Post;
        setPosts(prev => {
          if (prev.find(p => p.id === incoming.id)) return prev; // dedupe
          return [incoming, ...prev];
        });
        // counts start at zero until vote events arrive
        setVoteCounts(prev => ({ ...prev, [incoming.id]: prev[incoming.id] ?? { ups: 0, downs: 0 } }));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'posts', filter: `city_id=eq.${cityId}` }, (payload) => {
        const removed = payload.old as Post;
        setPosts(prev => prev.filter(p => p.id !== removed.id));
        setVoteCounts(prev => { const { [removed.id]: _, ...rest } = prev; return rest; });
        setCommentsByPost(prev => { const { [removed.id]: __, ...rest } = prev; return rest; });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [cityId]);

  // Subscribe to post_votes to keep counts live
  type PostVoteRow = { post_id: string; device_id: string; value: 1 | -1 };
  useEffect(() => {
    if (!cityId) return;
    const channel = supabase
      .channel(`post-votes-${cityId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_votes' }, (payload: RealtimePostgresChangesPayload<PostVoteRow>) => {
        const postId = (payload.new as PostVoteRow | null)?.post_id ?? (payload.old as PostVoteRow | null)?.post_id;
        if (!postId) return;
        // only update if we currently show this post
        setVoteCounts(prev => {
          if (!posts.find(p => p.id === postId)) return prev;
          const current = prev[postId] ?? { ups: 0, downs: 0 };
          const next = { ...current };
          if (payload.eventType === 'INSERT') {
            const val = (payload.new as PostVoteRow | null)?.value as number | undefined;
            if (val === 1) next.ups += 1; else if (val === -1) next.downs += 1;
          } else if (payload.eventType === 'UPDATE') {
            const oldVal = (payload.old as PostVoteRow | null)?.value as number | undefined;
            const newVal = (payload.new as PostVoteRow | null)?.value as number | undefined;
            if (oldVal === 1) next.ups -= 1; else if (oldVal === -1) next.downs -= 1;
            if (newVal === 1) next.ups += 1; else if (newVal === -1) next.downs += 1;
          } else if (payload.eventType === 'DELETE') {
            const oldVal = (payload.old as PostVoteRow | null)?.value as number | undefined;
            if (oldVal === 1) next.ups -= 1; else if (oldVal === -1) next.downs -= 1;
          }
          return { ...prev, [postId]: next };
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [cityId, posts]);

  async function createPost() {
    if (!cityId || !body.trim()) return;
    const text = body.trim();
    setBody('');
    // optimistic: prepend a placeholder which will be replaced on realtime or returning
    const temp: Post = { id: `temp-${Date.now()}`, city_id: cityId, body: text, created_at: new Date().toISOString() };
    setPosts(prev => [temp, ...prev]);
    setVoteCounts(prev => ({ ...prev, [temp.id]: { ups: 0, downs: 0 } }));
    const { data, error } = await supabase.from('posts').insert({ city_id: cityId, body: text }).select('*').single();
    if (!error && data) {
      setPosts(prev => {
        const withoutTemp = prev.filter(p => p.id !== temp.id);
        // if realtime already added real row, avoid duplicate
        if (withoutTemp.find(p => p.id === data.id)) return withoutTemp;
        return [data as Post, ...withoutTemp];
      });
    } else {
      // rollback temp on failure
      setPosts(prev => prev.filter(p => p.id !== temp.id));
    }
  }

  async function toggleThread(postId: string) {
    setOpenThreads(prev => ({ ...prev, [postId]: !prev[postId] }));
    if (!openThreads[postId]) {
      const { data } = await supabase.from('comments').select('*').eq('post_id', postId).order('created_at', { ascending: true });
      setCommentsByPost(prev => ({ ...prev, [postId]: data ?? [] }));
    }
  }

  async function deletePost(postId: string) {
    // optimistic removal
    const snapshot = posts;
    setPosts(prev => prev.filter(p => p.id !== postId));
    setVoteCounts(prev => { const { [postId]: _, ...rest } = prev; return rest; });
    setCommentsByPost(prev => { const { [postId]: __, ...rest } = prev; return rest; });
    const { error } = await supabase.from('posts').delete().eq('id', postId);
    if (error) {
      // rollback on failure
      setPosts(snapshot);
    }
  }

  async function addComment(postId: string, text: string) {
    if (!text.trim()) return;
    const temp: Comment = { id: `temp-${Date.now()}`, post_id: postId, parent_id: null, body: text.trim(), created_at: new Date().toISOString() };
    setCommentsByPost(prev => ({ ...prev, [postId]: [...(prev[postId] ?? []), temp] }));
    const { data, error } = await supabase.from('comments').insert({ post_id: postId, body: text.trim(), parent_id: null }).select('*').single();
    if (!error && data) {
      setCommentsByPost(prev => ({ ...prev, [postId]: (prev[postId] ?? []).filter(c => c.id !== temp.id).concat([data]) }));
    } else {
      // rollback temp on failure
      setCommentsByPost(prev => ({ ...prev, [postId]: (prev[postId] ?? []).filter(c => c.id !== temp.id) }));
    }
  }

  async function deleteComment(postId: string, commentId: string) {
    // optimistic removal
    const snapshot = commentsByPost[postId] ?? [];
    setCommentsByPost(prev => ({ ...prev, [postId]: (prev[postId] ?? []).filter(c => c.id !== commentId) }));
    const { error } = await supabase.from('comments').delete().eq('id', commentId);
    if (error) {
      // rollback on failure
      setCommentsByPost(prev => ({ ...prev, [postId]: snapshot }));
    }
  }

  async function votePost(postId: string, value: 1 | -1) {
    const device = getOrCreateDeviceId();
    const { data: existing } = await supabase.from('post_votes').select('*').eq('post_id', postId).eq('device_id', device).maybeSingle();
    if (!existing) {
      // optimistic
      setVoteCounts(prev => ({ ...prev, [postId]: { ups: (prev[postId]?.ups ?? 0) + (value === 1 ? 1 : 0), downs: (prev[postId]?.downs ?? 0) + (value === -1 ? 1 : 0) } }));
      await supabase.from('post_votes').insert({ post_id: postId, device_id: device, value });
    } else if (existing.value === value) {
      // toggle off: delete row (requires delete policy)
      setVoteCounts(prev => ({ ...prev, [postId]: { ups: (prev[postId]?.ups ?? 0) - (value === 1 ? 1 : 0), downs: (prev[postId]?.downs ?? 0) - (value === -1 ? 1 : 0) } }));
      const { error } = await supabase.from('post_votes').delete().eq('post_id', postId).eq('device_id', device);
      if (error) {
        // rollback if delete not allowed
        setVoteCounts(prev => ({ ...prev, [postId]: { ups: (prev[postId]?.ups ?? 0) + (value === 1 ? 1 : 0), downs: (prev[postId]?.downs ?? 0) + (value === -1 ? 1 : 0) } }));
      }
    } else {
      // optimistic swap
      setVoteCounts(prev => ({
        ...prev,
        [postId]: {
          ups: (prev[postId]?.ups ?? 0) + (value === 1 ? 1 : -1),
          downs: (prev[postId]?.downs ?? 0) + (value === -1 ? 1 : -1),
        },
      }));
      await supabase.from('post_votes').update({ value }).eq('post_id', postId).eq('device_id', device);
    }
    // no re-fetch; realtime channel will reconcile and hot reorder handled locally if needed
  }
  return (
    <main className="min-h-screen p-4 max-w-2xl mx-auto">
      <h2 className="text-2xl font-semibold mb-3">{citySlug.toUpperCase()}</h2>
      <div className="inline-flex gap-3 mb-4 select-none" role="tablist" aria-label="Sort posts">
        <Link
          href={`${pathname}?t=hot`}
          replace
          scroll={false}
          role="tab"
          aria-selected={tab === "hot"}
          className={tabClass(tab === "hot")}
        >
          Hot
        </Link>
        <Link
          href={`${pathname}?t=new`}
          replace
          scroll={false}
          role="tab"
          aria-selected={tab === "new"}
          className={tabClass(tab === "new")}
        >
          New
        </Link>
      </div>
      <div className="mb-4">
        <textarea className="w-full border rounded p-2" placeholder="what's happening?" maxLength={280} value={body} onChange={(e) => setBody(e.target.value)} />
        <div className="flex justify-end mt-2">
          <button className="px-3 py-2 bg-black text-white rounded" onClick={createPost}>Post</button>
        </div>
      </div>

      <ul className="space-y-3">
        {posts.map((p) => (
          <li key={p.id} className="border rounded p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="whitespace-pre-wrap">{p.body}</div>
              <div className="text-xs text-gray-500">{new Date(p.created_at).toLocaleTimeString()}</div>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <button className="px-2 py-1 border rounded" onClick={() => votePost(p.id, 1)}>⬆ {voteCounts[p.id]?.ups ?? 0}</button>
              <button className="px-2 py-1 border rounded" onClick={() => votePost(p.id, -1)}>⬇ {voteCounts[p.id]?.downs ?? 0}</button>
              <button className="px-2 py-1 border rounded" onClick={() => toggleThread(p.id)}>Reply</button>
              <button className="ml-auto px-2 py-1 border rounded text-red-600" onClick={() => deletePost(p.id)}>Delete</button>
            </div>
            {openThreads[p.id] && (
              <Thread postId={p.id} comments={commentsByPost[p.id] ?? []} onAdd={addComment} onDelete={deleteComment} />
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}

function Thread({ postId, comments, onAdd, onDelete }: { postId: string; comments: Comment[]; onAdd: (postId: string, text: string) => Promise<void>; onDelete: (postId: string, commentId: string) => Promise<void> }) {
  const [text, setText] = useState('');
  useEffect(() => {
    const channel = supabase
      .channel(`comments-${postId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments', filter: `post_id=eq.${postId}` }, (_payload: RealtimePostgresChangesPayload<Comment>) => {
        // Parent manages optimistic updates. Minimal no-op here.
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'comments', filter: `post_id=eq.${postId}` }, (payload: RealtimePostgresChangesPayload<Comment>) => {
        const removed = payload.old;
        if (!removed) return;
        // Optimistic parent removal already handled when user deletes locally
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [postId]);
  return (
    <div className="mt-3 border-t pt-3 space-y-2">
      <div className="flex gap-2">
        <input className="flex-1 border rounded p-2" placeholder="reply..." value={text} onChange={(e) => setText(e.target.value)} />
        <button className="px-3 py-2 border rounded" onClick={() => { onAdd(postId, text); setText(''); }}>Send</button>
      </div>
      <ul className="space-y-2">
        {comments.map(c => (
          <li key={c.id} className="text-sm flex items-start justify-between gap-2">
            <span className="whitespace-pre-wrap">{c.body}</span>
            <span className="text-xs text-gray-500">{new Date(c.created_at).toLocaleTimeString()}</span>
            <button className="text-xs px-2 py-1 border rounded text-red-600" onClick={() => onDelete(postId, c.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}


