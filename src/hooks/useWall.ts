import { useEffect, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { registryPda, wallPda } from "../lib/solana/wallcaster";

export function useOwnedWall(
  connection: any,
  programId: string,
  owner: string | null
) {
  const [wall, setWall] = useState<{
    pda: PublicKey;
    state: string;
    mintIndex: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!connection || !owner) {
      setWall(null);
      setLoading(false);
      return;
    }

    const findUserWall = async () => {
      try {
        setLoading(true);

        // Get registry to know the current mint count
        const registryAccount = await connection.getAccountInfo(registryPda());
        if (!registryAccount) {
          setWall(null);
          setLoading(false);
          return;
        }

        // Parse mint count from registry (offset: 8 + 32 + 32 = 72)
        const mintCount = registryAccount.data.readUInt16LE(8 + 32 + 32);

        console.log("Current mint count:", mintCount);

        // Check each wall from 0 to mintCount-1 to find the one owned by this user
        for (let i = 0; i < mintCount; i++) {
          const wallPdaAddress = wallPda(i);
          const wallAccount = await connection.getAccountInfo(wallPdaAddress);

          if (
            wallAccount &&
            wallAccount.owner.equals(new PublicKey(programId))
          ) {
            // Parse the wall data to check ownership
            // Wall structure: discriminator(8) + owner(32) + cast_hash(32) + price(8) + state(1) + bump(1)

            // Verify discriminator
            const discriminator = wallAccount.data.slice(0, 8);
            const expectedWallDiscriminator = Buffer.from([
              246, 132, 243, 249, 165, 137, 54, 35,
            ]);

            if (discriminator.equals(expectedWallDiscriminator)) {
              // Parse owner (bytes 8-40)
              const wallOwner = new PublicKey(wallAccount.data.slice(8, 40));

              if (wallOwner.toString() === owner) {
                // Parse state (byte at offset 8 + 32 + 32 + 8 = 80)
                const stateValue = wallAccount.data[80];
                const stateNames = ["Inactive", "Active", "Listed"];

                setWall({
                  pda: wallPdaAddress,
                  state: stateNames[stateValue] || "Unknown",
                  mintIndex: i,
                });
                setLoading(false);
                return;
              }
            }
          }
        }

        // No wall found for this user
        setWall(null);
      } catch (error) {
        console.error("Error finding user wall:", error);
        setWall(null);
      } finally {
        setLoading(false);
      }
    };

    findUserWall();
  }, [connection, programId, owner]);

  return { wall, loading };
}
