import { NextRequest, NextResponse } from "next/server";

const GET_NETWORK_SNAPSHOT_SELECTOR = "0xa6931e6d";

export async function GET(req: NextRequest) {
  const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL;

  if (!contractAddress || !rpcUrl) {
    return NextResponse.json({ configured: false });
  }

  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_call",
        params: [
          {
            to: contractAddress,
            data: GET_NETWORK_SNAPSHOT_SELECTOR,
          },
          "latest",
        ],
      }),
    });

    const json = await response.json();

    if (json.error) {
      console.error("[/api/chain-state] RPC error:", json.error);
      return NextResponse.json(
        { configured: true, error: json.error.message },
        { status: 500 }
      );
    }

    // Decode the 5 × uint256 tuple
    const hex = json.result as string;
    if (!hex || hex === "0x") {
      return NextResponse.json(
        { configured: true, error: "Empty response from contract" },
        { status: 500 }
      );
    }

    const data = hex.replace("0x", "");

    // Each uint256 = 32 bytes = 64 hex chars
    const totalNetworkStake  = BigInt("0x" + data.slice(0,   64));
    const totalSlashedStake  = BigInt("0x" + data.slice(64,  128));
    const networkRiskScore   = Number(BigInt("0x" + data.slice(128, 192)));
    const validatorCount     = Number(BigInt("0x" + data.slice(192, 256)));
    const avsCount           = Number(BigInt("0x" + data.slice(256, 320)));

    return NextResponse.json({
      configured: true,
      contractAddress,
      totalNetworkStake:  totalNetworkStake.toString(),
      totalSlashedStake:  totalSlashedStake.toString(),
      networkRiskScore,
      validatorCount,
      avsCount,
      fetchedAt: new Date().toISOString(),
    });

  } catch (err) {
    console.error("[/api/chain-state]", err);
    return NextResponse.json(
      { configured: true, error: "Failed to reach RPC" },
      { status: 500 }
    );
  }
}
