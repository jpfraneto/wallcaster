// src/types/wall.ts
export interface ActivatedWall {
  pda: string;
  owner: string;
  castHash: string; // the parent-cast hash
  username: string; // @handle or truncated address
  pfp: string | null; // Farcaster pfp or null
  fid: number; // Farcaster fid
}
