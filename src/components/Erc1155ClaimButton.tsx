import {
  DropContract,
  useActiveClaimConditionForWallet,
  useAddress,
  useClaimConditions,
  useClaimerProofs,
  useClaimIneligibilityReasons,
  useTotalCirculatingSupply,
  Web3Button,
} from "@thirdweb-dev/react";
import { NFTDrop, SignatureDrop, TokenDrop } from "@thirdweb-dev/sdk";
import { BigNumber, BigNumberish, utils } from "ethers";
import React, { useMemo, useState } from "react";
import { useDebounce } from "../hooks/useDebounce";
import { parseIneligibility } from "../utils/parseIneligibility";
import { useToast } from "./ui/use-toast";

interface ClaimButtonProps {
  contract?: Exclude<DropContract, TokenDrop | SignatureDrop | NFTDrop>;
  tokenId: BigNumberish;
  theme?: "dark" | "light";
}

const urlParams = new URL(window.location.toString()).searchParams;
const primaryColor = urlParams.get("primaryColor") || undefined;

const colors = {
  purple: "#7C3AED",
  blue: "#3B82F6",
  orange: "#F59E0B",
  pink: "#EC4899",
  green: "#10B981",
  red: "#EF4444",
  teal: "#14B8A6",
  cyan: "#22D3EE",
  yellow: "#FBBF24",
} as const;

export const ERC1155ClaimButton: React.FC<ClaimButtonProps> = ({
  contract,
  tokenId,
  theme,
}) => {
  const address = useAddress();
  const [quantity, setQuantity] = useState(1);
  const { toast } = useToast();
  const debouncedQuantity = useDebounce(quantity, 500);
  const claimConditions = useClaimConditions(contract);
  const activeClaimCondition = useActiveClaimConditionForWallet(
    contract,
    address,
    tokenId,
  );
  const claimerProofs = useClaimerProofs(contract, address || "", tokenId);
  const claimIneligibilityReasons = useClaimIneligibilityReasons(
    contract,
    {
      quantity: debouncedQuantity,
      walletAddress: address || "",
    },
    tokenId,
  );
  const claimedSupply = useTotalCirculatingSupply(contract, tokenId);

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

  const priceToMint = useMemo(() => {
    const bnPrice = BigNumber.from(
      activeClaimCondition.data?.currencyMetadata.value || 0,
    );
    return `${utils.formatUnits(
      bnPrice.mul(quantity).toString(),
      activeClaimCondition.data?.currencyMetadata.decimals || 18,
    )} ${activeClaimCondition.data?.currencyMetadata.symbol}`;
  }, [
    activeClaimCondition.data?.currencyMetadata.decimals,
    activeClaimCondition.data?.currencyMetadata.symbol,
    activeClaimCondition.data?.currencyMetadata.value,
    quantity,
  ]);

  const maxClaimable = useMemo(() => {
    let bnMaxClaimable;
    try {
      bnMaxClaimable = BigNumber.from(
        activeClaimCondition.data?.maxClaimableSupply || 0,
      );
    } catch (e) {
      bnMaxClaimable = BigNumber.from(1_000_000);
    }

    let perTransactionClaimable;
    try {
      perTransactionClaimable = BigNumber.from(
        activeClaimCondition.data?.maxClaimablePerWallet || 0,
      );
    } catch (e) {
      perTransactionClaimable = BigNumber.from(1_000_000);
    }

    if (perTransactionClaimable.lte(bnMaxClaimable)) {
      bnMaxClaimable = perTransactionClaimable;
    }

    const snapshotClaimable = claimerProofs.data?.maxClaimable;

    if (snapshotClaimable) {
      if (snapshotClaimable === "0") {
        // allowed unlimited for the snapshot
        bnMaxClaimable = BigNumber.from(1_000_000);
      } else {
        try {
          bnMaxClaimable = BigNumber.from(snapshotClaimable);
        } catch (e) {
          // fall back to default case
        }
      }
    }

    let max;
    if (totalAvailableSupply.lt(bnMaxClaimable)) {
      max = totalAvailableSupply;
    } else {
      max = bnMaxClaimable;
    }

    if (max.gte(1_000_000)) {
      return 1_000_000;
    }
    return max.toNumber();
  }, [
    claimerProofs.data?.maxClaimable,
    totalAvailableSupply,
    activeClaimCondition.data?.maxClaimableSupply,
    activeClaimCondition.data?.maxClaimablePerWallet,
  ]);

  const isSoldOut = useMemo(() => {
    try {
      return (
        (activeClaimCondition.isSuccess &&
          BigNumber.from(activeClaimCondition.data?.availableSupply || 0).lte(
            0,
          )) ||
        numberClaimed === numberTotal
      );
    } catch (e) {
      return false;
    }
  }, [
    activeClaimCondition.data?.availableSupply,
    activeClaimCondition.isSuccess,
    numberClaimed,
    numberTotal,
  ]);

  const canClaim = useMemo(() => {
    return (
      activeClaimCondition.isSuccess &&
      claimIneligibilityReasons.isSuccess &&
      claimIneligibilityReasons.data?.length === 0 &&
      !isSoldOut
    );
  }, [
    activeClaimCondition.isSuccess,
    claimIneligibilityReasons.data?.length,
    claimIneligibilityReasons.isSuccess,
    isSoldOut,
  ]);

  const isLoading = useMemo(() => {
    return (
      activeClaimCondition.isLoading || claimedSupply.isLoading || !contract
    );
  }, [activeClaimCondition.isLoading, contract, claimedSupply.isLoading]);

  const buttonLoading = useMemo(
    () => isLoading || claimIneligibilityReasons.isLoading,
    [claimIneligibilityReasons.isLoading, isLoading],
  );
  const buttonText = useMemo(() => {
    if (isSoldOut) {
      return "Sold Out";
    }

    if (canClaim) {
      const pricePerToken = BigNumber.from(
        activeClaimCondition.data?.currencyMetadata.value || 0,
      );
      if (pricePerToken.eq(0)) {
        return "Mint (Free)";
      }
      return `Mint (${priceToMint})`;
    }
    if (claimIneligibilityReasons.data?.length) {
      return parseIneligibility(claimIneligibilityReasons.data, quantity);
    }
    if (buttonLoading) {
      return "Checking eligibility...";
    }

    return "Minting not available";
  }, [
    isSoldOut,
    canClaim,
    claimIneligibilityReasons.data,
    buttonLoading,
    activeClaimCondition.data?.currencyMetadata.value,
    priceToMint,
    quantity,
  ]);

  if (
    claimConditions.data?.length === 0 ||
    claimConditions.data?.every((cc) => cc.maxClaimableSupply === "0")
  ) {
    return (
      <span className="text-red-500">
        This drop is not ready to be minted yet. (No claim condition set)
      </span>
    );
  }

  if (
    (claimConditions.data &&
      claimConditions.data.length > 0 &&
      activeClaimCondition.isError) ||
    (activeClaimCondition.data &&
      activeClaimCondition.data.startTime > new Date())
  ) {
    return (
      <span className="text-gray-500">
        Drop is starting soon. Please check back later.
      </span>
    );
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-center lg:gap-4 ">
        <div className="flex h-11 w-full rounded-lg border border-gray-400 px-2 dark:border-gray-800 md:w-full">
          <button
            onClick={() => {
              const value = quantity - 1;
              if (value > maxClaimable) {
                setQuantity(maxClaimable);
              } else if (value < 1) {
                setQuantity(1);
              } else {
                setQuantity(value);
              }
            }}
            className="flex h-full items-center justify-center rounded-l-md px-2 text-center text-2xl disabled:cursor-not-allowed disabled:text-gray-500 dark:text-white dark:disabled:text-gray-600"
            disabled={isSoldOut || quantity - 1 < 1}
          >
            -
          </button>
          <p className="flex h-full w-full items-center justify-center text-center font-mono dark:text-white lg:w-full">
            {!isLoading && isSoldOut ? "Sold Out" : quantity}
          </p>
          <button
            onClick={() => {
              const value = quantity + 1;
              if (value > maxClaimable) {
                setQuantity(maxClaimable);
              } else if (value < 1) {
                setQuantity(1);
              } else {
                setQuantity(value);
              }
            }}
            className={
              "flex h-full items-center justify-center rounded-r-md px-2 text-center text-2xl disabled:cursor-not-allowed disabled:text-gray-500 dark:text-white dark:disabled:text-gray-600"
            }
            disabled={isSoldOut || quantity + 1 > maxClaimable}
          >
            +
          </button>
        </div>
        <Web3Button
          contractAddress={contract?.getAddress() || ""}
          style={{
            backgroundColor:
              colors[primaryColor as keyof typeof colors] || primaryColor,
            maxHeight: "43px",
          }}
          theme={theme}
          action={(cntr) => cntr.erc1155.claim(tokenId, quantity)}
          isDisabled={!canClaim || buttonLoading}
          onError={(err) => {
            console.error(err);
            console.log({ err });
            toast({
              title: "Failed to mint drop",
              description: (err as any).reason || "",
              duration: 9000,
              variant: "destructive",
            });
          }}
          onSuccess={() => {
            toast({
              title: "Successfully minted",
              description: "The NFT has been transferred to your wallet",
              duration: 5000,
              className: "bg-green-500",
            });
          }}
        >
          {buttonLoading ? (
            <div role="status">
              <svg
                aria-hidden="true"
                className="mr-2 h-4 w-4 animate-spin fill-blue-600 text-gray-200 dark:text-gray-600"
                viewBox="0 0 100 101"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
                  fill="currentColor"
                />
                <path
                  d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
                  fill="currentFill"
                />
              </svg>
              <span className="sr-only">Loading...</span>
            </div>
          ) : (
            buttonText
          )}
        </Web3Button>
      </div>
    </div>
  );
};
