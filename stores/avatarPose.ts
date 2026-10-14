/** Chosen profile pose (roadmap step 8). Local only (AsyncStorage); account sync needs migration 20261013180000_avatar_pose.sql. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { DEFAULT_POSE, isPoseId, type PoseId } from '../lib/avatar/poses';

type PoseState = { pose: PoseId; setPose: (p: PoseId) => void };

export const useAvatarPose = create<PoseState>()(persist(set => ({
  pose: DEFAULT_POSE,
  setPose: pose => set({ pose: isPoseId(pose) ? pose : DEFAULT_POSE }),
}), {
  name: 'sx-avatar-pose',
  storage: createJSONStorage(() => AsyncStorage),
  merge: (persisted, current) => ({ ...current, pose: isPoseId((persisted as Partial<PoseState> | undefined)?.pose) ? (persisted as PoseState).pose : DEFAULT_POSE }),
}));
