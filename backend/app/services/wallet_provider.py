"""Read-only wallet balance provider for public blockchain balance tracking."""

import json
import re
import urllib.request
from typing import Dict, List, Optional
from pydantic import BaseModel

from app.core.exceptions import GHOSTException


class DetectedAsset(BaseModel):
    """Asset balance detected from a public wallet address."""
    symbol: str
    quantity: float
    network: str
    source: str = "Wallet"


class WalletBalanceProvider:
    """Read-only blockchain provider for public wallet balances."""

    SUPPORTED_NETWORKS = ["Ethereum", "Bitcoin", "Solana"]

    @staticmethod
    def validate_address(address: str, network: str) -> str:
        """Validates public wallet address format for supported network."""
        clean_addr = address.strip()
        if not clean_addr:
            raise GHOSTException("Public wallet address cannot be empty.", code="INVALID_ADDRESS")

        net = network.capitalize()
        if net == "Ethereum":
            if not re.match(r"^0x[a-fA-F0-9]{40}$", clean_addr):
                raise GHOSTException("Invalid Ethereum public address. Expected format: 0x...", code="INVALID_ETH_ADDRESS")
        elif net == "Bitcoin":
            if not re.match(r"^(1|3|bc1)[a-zA-Z0-9]{25,59}$", clean_addr):
                raise GHOSTException("Invalid Bitcoin public address. Expected format starting with 1, 3, or bc1.", code="INVALID_BTC_ADDRESS")
        elif net == "Solana":
            if not re.match(r"^[1-9A-HJ-NP-Za-km-z]{32,44}$", clean_addr):
                raise GHOSTException("Invalid Solana public address.", code="INVALID_SOL_ADDRESS")
        else:
            raise GHOSTException(f"Network '{network}' is not supported yet. Supported: Ethereum, Bitcoin, Solana.", code="UNSUPPORTED_NETWORK")

        return clean_addr

    async def fetch_balances(self, address: str, network: str) -> List[DetectedAsset]:
        """Fetches publicly available token balances for a verified public address."""
        clean_addr = self.validate_address(address, network)
        net = network.capitalize()

        try:
            if net == "Ethereum":
                return self._fetch_ethereum_balances(clean_addr)
            elif net == "Bitcoin":
                return self._fetch_bitcoin_balances(clean_addr)
            elif net == "Solana":
                return self._fetch_solana_balances(clean_addr)
            return []
        except GHOSTException:
            raise
        except Exception as exc:
            raise GHOSTException(f"Unable to update wallet balances right now for {net}.", code="WALLET_FETCH_FAILED")

    def _fetch_ethereum_balances(self, address: str) -> List[DetectedAsset]:
        """Queries public Ethereum RPC node for balance."""
        rpc_urls = ["https://eth.drpc.org", "https://rpc.ankr.com/eth"]
        eth_balance = 0.0

        for url in rpc_urls:
            try:
                payload = json.dumps({"jsonrpc": "2.0", "method": "eth_getBalance", "params": [address, "latest"], "id": 1}).encode()
                req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json", "User-Agent": "GHOST/1.0"})
                with urllib.request.urlopen(req, timeout=5) as r:
                    res = json.loads(r.read())
                    if "result" in res:
                        wei = int(res["result"], 16)
                        eth_balance = wei / 1e18
                        break
            except Exception:
                continue

        assets = [DetectedAsset(symbol="ETH", quantity=round(eth_balance, 6), network="Ethereum")]
        return assets

    def _fetch_bitcoin_balances(self, address: str) -> List[DetectedAsset]:
        """Queries public Blockstream API for Bitcoin balance."""
        url = f"https://blockstream.info/api/address/{address}"
        btc_balance = 0.0

        try:
            req = urllib.request.Request(url, headers={"User-Agent": "GHOST/1.0"})
            with urllib.request.urlopen(req, timeout=5) as r:
                res = json.loads(r.read())
                stats = res.get("chain_stats", {})
                sats = stats.get("funded_txo_sum", 0) - stats.get("spent_txo_sum", 0)
                btc_balance = max(0.0, sats / 1e8)
        except Exception:
            btc_balance = 0.0

        return [DetectedAsset(symbol="BTC", quantity=round(btc_balance, 8), network="Bitcoin")]

    def _fetch_solana_balances(self, address: str) -> List[DetectedAsset]:
        """Queries public Solana RPC node for balance."""
        url = "https://solana-rpc.publicnode.com"
        sol_balance = 0.0

        try:
            payload = json.dumps({"jsonrpc": "2.0", "method": "getBalance", "params": [address], "id": 1}).encode()
            req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json", "User-Agent": "GHOST/1.0"})
            with urllib.request.urlopen(req, timeout=5) as r:
                res = json.loads(r.read())
                if "result" in res and "value" in res["result"]:
                    lamports = res["result"]["value"]
                    sol_balance = lamports / 1e9
        except Exception:
            sol_balance = 0.0

        return [DetectedAsset(symbol="SOL", quantity=round(sol_balance, 6), network="Solana")]


wallet_provider = WalletBalanceProvider()
