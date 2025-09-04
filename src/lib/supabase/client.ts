import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.warn('Supabase env not set: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '');

export type City = { id: number; slug: string; name: string };
export type Post = { id: string; city_id: number; body: string; created_at: string };
export type Comment = { id: string; post_id: string; parent_id: string | null; body: string; created_at: string };
export type PostVote = { post_id: string; device_id: string; value: 1 | -1 };
export type CommentVote = { comment_id: string; device_id: string; value: 1 | -1 };


