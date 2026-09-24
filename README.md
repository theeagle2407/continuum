# Continuum v0.3

Continuum is a Solana tokenized-equity portfolio interface focused on explaining how raw on-chain positions become effective positions through xStocks corporate actions.

## Local development

Create `.env.local` in this folder with either:

```bash
VITE_SOLANA_RPC_URL=https://rpc.ankr.com/solana/YOUR_KEY
```

or, preferably for a local demo:

```bash
ANKR_RPC_URL=https://rpc.ankr.com/solana/YOUR_KEY
VITE_ANKR_RPC_ENABLED=true
```

The Vite dev server proxies `/__continuum_rpc` to the configured RPC so the browser does not receive the Ankr URL/key.

Then:

```bash
npm install
npm run dev
```
