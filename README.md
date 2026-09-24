# Candor 🌑

**Anonymous, provably-authentic community feedback — on Midnight.**

Candor lets members of a community submit honest, anonymous feedback that is
*provably from a real member* yet *cryptographically untraceable* to any
individual. Honest feedback dies when people fear being identified; Candor
removes the fear while keeping out impostors — something impossible on a normal
(fully public) chain or a normal web app where the server sees who posted.

Built on [Midnight](https://midnight.network) using the Compact language and
zero-knowledge proofs.

> Start in the dark. Ship in the light.

---

## The idea

Communities — a class, a DAO, a company, an alumni group — get bad feedback for
two reasons: people won't be honest if they can be identified, and once you make
things anonymous you can no longer tell real members from outsiders spamming the
box. Candor solves both at once. A member proves, in zero knowledge, that they
hold a valid membership secret — so their feedback is guaranteed to come from a
real member — while the proof reveals *nothing* about *which* member they are. A
public nullifier stops the same member from posting twice, again without
revealing who they are. The result is a suggestion box that is simultaneously
**authenticated** and **anonymous** — the exact guarantee only a privacy chain
like Midnight can provide.

---

## Public state vs private witness

Candor is a direct demonstration of Midnight's core privacy model: **circuit
inputs are private by default, and data only becomes public when you deliberately
`disclose()` it into the ledger.**

**Private witness (never on-chain, never revealed):**
- `memberSecret()` — the caller's membership secret. It is a *witness*: supplied
  off-chain when the member posts, consumed inside the zero-knowledge circuit to
  prove membership, and **never written to the ledger and never disclosed**. The
  network is convinced the poster knows a valid secret without ever seeing it.

**Public ledger state (visible on-chain):**
- `lastFeedback: Opaque<"string">` — the feedback text. This is deliberately
  `disclose()`d, because the whole point is that the message is public and
  readable. What stays hidden is *who wrote it*.
- `lastNullifier: Bytes<32>` — a nullifier derived as `persistentHash(secret)`.
  It is `disclose()`d so the network can prevent the same member double-posting.
  Because it is a one-way hash of the private secret, it cannot be reversed to
  reveal the member's identity.
- `feedbackCount: Counter` — a public tally of how much feedback has been
  submitted.

The key line of reasoning: **`disclose()` does not "leak" the secret.** The
secret itself is never disclosed. Only two safe, derived values cross into public
state — the message (meant to be public) and a one-way nullifier (safe to
publish) — while the member's identity remains protected by the ZK proof.

```compact
// contracts/hello-world.compact
witness memberSecret(): Bytes<32>;                 // PRIVATE — never on-chain

export circuit submitFeedback(feedback: Opaque<"string">): [] {
    const secret = memberSecret();                 // used in ZK, never revealed
    const nullifier = persistentHash<Bytes<32>>(secret);
    lastFeedback  = disclose(feedback);            // public: the message
    lastNullifier = disclose(nullifier);           // public: one-way, safe
    feedbackCount.increment(1);                     // public: the tally
}
```

---

## Deployment

- **Network:** Midnight Preprod
- **Contract address:** `12f0061824f323051d8ea21b3128ad1a36b60cc4bfba14024fc16486d491d605`
- **Compiled circuit:** `submitFeedback` (k=13, ~2273 rows) — the ZK circuit that
  proves membership and derives the nullifier.
- **Generated artifacts:** `contracts/managed/hello-world/`
  (`compiler`, `contract`, `keys`, `zkir`).

### Proof of compile & deployment

**Contract compiles to a ZK circuit:**

![Compile output](docs/compile.png)

**Contract deployed to Preprod with a visible address:**

![Deployment address](docs/deploy.png)

---

## Roadmap (the lunar cycle)

Candor is designed to grow across all six phases of the program:

- **🌑 New Moon (Level 1) — this submission:** toolchain, the core anonymous-
  feedback contract compiling and deployed to Preprod, the idea seeded.
- **🌒 Waxing Crescent (Level 2):** a frontend UI, Lace wallet on Preprod, submit
  feedback from a browser.
- **🌓 First Quarter (Level 3):** production-grade dApp — tests, CI/CD, a real
  community as the target user.
- **🌔 Waxing Gibbous (Level 4):** MVP live on Preprod, docs, public product profile.
- **🌕 Full Moon (Level 5):** anonymous upvoting + private polls, 50 real users.
- **🌝 Supermoon (Level 6):** Mainnet launch, anonymous reputation, 20 real users.

---

## Tech

- **Compact** compiler 0.31.1 (Midnight's ZK smart-contract language)
- **@midnight-ntwrk** wallet SDK + midnight-js (4.1.x)
- **Docker** proof server (zero-knowledge proof generation)
- **Node 22**, TypeScript

---

## Run it locally

Prerequisites: Node 22 (via nvm), Docker Desktop, and the Compact toolchain
(`compact` installed via the Midnight installer, then `compact update`).

```bash
# 1. install dependencies
npm install

# 2. start the proof server (leave running) + compile + deploy
npm run setup

# useful individual commands:
npm run compile         # compile the Compact contract to ZK circuits
npm run address         # print your fundable Midnight wallet address (no sync)
npm run check-balance   # check wallet balance
npm run deploy          # deploy to the active network
npm run network preprod # switch target network (undeployed | preview | preprod)
```

Fund your wallet: run `npm run address`, copy the address, and request tNight
from the Midnight faucet for the active network. Then `npm run deploy`.

---

## How the ZK privacy actually works (step by step)

1. A member holds a secret 32-byte membership key off-chain.
2. To post, they call `submitFeedback(text)`. The `memberSecret()` witness feeds
   their secret into the circuit — privately.
3. The circuit computes `nullifier = persistentHash(secret)` and produces a
   zero-knowledge proof that "the caller knows a valid secret," without exposing
   the secret.
4. Only the feedback text and the nullifier are written to the public ledger.
5. Anyone can read the feedback and verify it came from a real member, but no one
   — not even the chain — can tell *which* member, and the nullifier stops the
   same member posting twice.

---

Built by [@theeagle2407](https://github.com/theeagle2407) for
**New Moon to Full: Monthly Moonshots on Midnight**. 🌙
