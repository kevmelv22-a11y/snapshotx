import { supabase } from '../supabase';

export type SuggestedFriend = {
  user_id: string;
  username: string;
  display_name: string;
  mutuals: number;
};

export async function fetchSuggestedFriends(limit = 20): Promise<SuggestedFriend[]> {
  const { data, error } = await supabase.rpc('sx_suggest_friends', { p_limit: limit });
  if (error) throw error;
  return (data ?? []) as SuggestedFriend[];
}

export async function hideSuggestion(otherId: string): Promise<void> {
  const { error } = await supabase.rpc('sx_hide_suggestion', { p_other_id: otherId });
  if (error) throw error;
}
