import { useEffect, useState } from "react";
import { Connection, PublicKey } from "@solana/web3.js";
import { getWallByOwner, WallAccount } from "../lib/solana/wall";

export function useOwnedWall(
  connection: Connection,
  programId: string,
  wallet: string | null
) {
  const [wall, setWall] = useState<WallAccount | null>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error>();

  useEffect(() => {
    if (!wallet) {
      setWall(null);
      return;
    }

    (async () => {
      try {
        setLoading(true);
        const w = await getWallByOwner(
          connection,
          new PublicKey(programId),
          new PublicKey(wallet)
        );
        setWall(w);
      } catch (e) {
        setError(e as Error);
      } finally {
        setLoading(false);
      }
    })();
  }, [connection, programId, wallet]);

  return { wall, loading, error };
}
