import { type DAS, Helius, Interface } from "helius-sdk";

const heliusApiKey = process.env.HELIUS_API_KEY;
if (!heliusApiKey) {
  throw new Error("HELIUS_API_KEY environment variable is required");
}

export const helius = new Helius(heliusApiKey);

export const getAssetsByOwner = async (
  ownerAddress: string,
  onlyFungible: boolean = true,
): Promise<DAS.GetAssetResponse[]> => {
  const response = await helius.rpc.getAssetsByOwner({
    ownerAddress,
    page: 1,
    displayOptions: {
      showFungible: true,
    },
  });

  if (onlyFungible) {
    return response.items.filter(
      (item) => item.interface === Interface.FUNGIBLE_TOKEN || item.interface === Interface.FUNGIBLE_ASSET,
    );
  }

  return response.items;
};
