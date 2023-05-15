import {
  ConnectWallet,
  useActiveClaimCondition,
  useContract,
  useContractMetadata,
  useNFT,
  useTotalCirculatingSupply,
} from "@thirdweb-dev/react";
import { BigNumber } from "ethers";
import { useMemo } from "react";
import { ERC1155ClaimButton } from "./components/Erc1155ClaimButton";
import { HeadingImage } from "./components/HeadingImage";
import { PoweredBy } from "./components/PoweredBy";

const urlParams = new URL(window.location.toString()).searchParams;
const tokenId = urlParams.get("tokenId") || "0";
const contractAddress = urlParams.get("contract") || "";

export default function Home() {
  const contractQuery = useContract(contractAddress);
  const contractMetadata = useContractMetadata(contractQuery.contract);
  const nft = useNFT(contractQuery.contract, tokenId);
  const theme = (urlParams.get("theme") || "light") as "dark" | "light";
  const root = window.document.documentElement;
  root.classList.add(theme);

  const claimedSupply = useTotalCirculatingSupply(
    contractQuery.contract,
    tokenId,
  );

  const activeClaimCondition = useActiveClaimCondition(
    contractQuery.contract,
    tokenId,
  );

  const totalAvailableSupply = useMemo(() => {
    try {
      return BigNumber.from(activeClaimCondition.data?.availableSupply || 0);
    } catch {
      return BigNumber.from(1_000_000);
    }
  }, [activeClaimCondition.data?.availableSupply]);

  const numberClaimed = useMemo(() => {
    return BigNumber.from(claimedSupply.data || 0).toString();
  }, [claimedSupply]);

  const numberTotal = useMemo(() => {
    const n = totalAvailableSupply.add(BigNumber.from(claimedSupply.data || 0));
    if (n.gte(1_000_000)) {
      return "";
    }
    return n.toString();
  }, [totalAvailableSupply, claimedSupply]);

  const isLoading = activeClaimCondition.isLoading || claimedSupply.isLoading;

  if (!contractAddress) {
    return (
      <div className="flex h-full items-center justify-center">
        No contract address provided
      </div>
    );
  }

  return (
    <div className="min-h-screen w-screen">
      <ConnectWallet className="!absolute !right-4 !top-4" theme={theme} />
      <div className="grid h-screen grid-cols-1 lg:grid-cols-12">
        <div className="hidden h-full w-full items-center justify-center lg:col-span-5 lg:flex lg:px-12">
          <HeadingImage
            src={nft?.data?.metadata.image || contractMetadata.data?.image}
            isLoading={isLoading}
          />
        </div>
        <div className="col-span-1 flex h-full w-full items-center justify-center lg:col-span-7">
          <div className="flex w-full max-w-xl flex-col gap-4 rounded-xl p-12 lg:border lg:border-gray-400 lg:dark:border-gray-800">
            <div className="mt-8 flex w-full xs:mb-8 xs:mt-0 lg:hidden">
              <HeadingImage
                src={nft?.data?.metadata.image || contractMetadata.data?.image}
                isLoading={isLoading}
              />
            </div>

            <div className="flex flex-col gap-2 xs:gap-4">
              {isLoading ? (
                <div
                  role="status"
                  className="animate-pulse space-y-8 md:flex md:items-center md:space-x-8 md:space-y-0"
                >
                  <div className="w-full">
                    <div className="h-10 w-24 rounded-full bg-gray-200 dark:bg-gray-700"></div>
                  </div>
                </div>
              ) : (
                <p>
                  <span className="text-lg font-bold tracking-wider text-gray-500 xs:text-xl lg:text-2xl">
                    {numberClaimed}
                  </span>{" "}
                  <span className="text-lg font-bold tracking-wider xs:text-xl lg:text-2xl">
                    / {numberTotal} minted
                  </span>
                </p>
              )}
              <h1 className="line-clamp-1 text-2xl font-bold xs:text-3xl lg:text-4xl">
                {contractMetadata.isLoading ? (
                  <div
                    role="status"
                    className="animate-pulse space-y-8 md:flex md:items-center md:space-x-8 md:space-y-0"
                  >
                    <div className="w-full">
                      <div className="h-8 w-48 rounded-full bg-gray-200 dark:bg-gray-700"></div>
                    </div>
                    <span className="sr-only">Loading...</span>
                  </div>
                ) : (
                  contractMetadata.data?.name
                )}
              </h1>
              {contractMetadata.data?.description ||
              contractMetadata.isLoading ? (
                <div className="line-clamp-2 text-gray-500">
                  {contractMetadata.isLoading ? (
                    <div
                      role="status"
                      className="animate-pulse space-y-8 md:flex md:items-center md:space-x-8 md:space-y-0"
                    >
                      <div className="w-full">
                        <div className="mb-2.5 h-2 max-w-[480px] rounded-full bg-gray-200 dark:bg-gray-700"></div>
                        <div className="mb-2.5 h-2 rounded-full bg-gray-200 dark:bg-gray-700"></div>
                      </div>
                      <span className="sr-only">Loading...</span>
                    </div>
                  ) : (
                    contractMetadata.data?.description
                  )}
                </div>
              ) : null}
            </div>
            <div className="flex w-full gap-4">
              <ERC1155ClaimButton
                contract={contractQuery.contract}
                tokenId={tokenId}
                theme={theme}
              />
            </div>
          </div>
        </div>
      </div>
      <PoweredBy />
    </div>
  );
}
