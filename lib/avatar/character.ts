/**
 * Own character set (male / female ChatGPT-style art). The art cannot show skin tone, hair colour or
 * hairstyle, so the character is the one body choice the editors offer. Stored per account in
 * user_metadata.gender (read back by hooks/useSession → wardrobe.switchUser) and in the local wardrobe.
 */
import { supabase } from '../supabase';
import { useWardrobe } from '../../stores/wardrobe';
import type { Gender } from './outfit';

export const CHARACTER_LABEL: Record<Gender, string> = { male: 'Man', female: 'Vrouw' };

/** Saves the character on the account, then switches the local wardrobe (keeps a saved outfit, else the start look). */
export async function saveCharacter(gender: Gender): Promise<unknown | null> {
  if (useWardrobe.getState().gender !== gender) {
    const { error } = await supabase.auth.updateUser({ data: { gender } });
    if (error) return error;
  }
  useWardrobe.getState().setGender(gender);
  return null;
}
