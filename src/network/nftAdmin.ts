// Admin site side of sending NFTs (GAME.md 6.11): the queue from the server's public SQL endpoint, and telling the server
// what was minted. Plain HTTP, so the site needs no game connection. The signature is the same free login text as in the game.
import { nftSkinWord } from '../gameplay/nft.ts';
import { loginMessage } from '../gameplay/walletMessage.ts';
import type { RarityId } from '../config/market.ts';

export interface QueuedNft { ref: string; tokenId: bigint; recipient: string; skin: bigint }
export interface NftAdminSession { server: string; db: string; token: string }

const base = (server: string, db: string) => `${server}/v1/database/${encodeURIComponent(db)}`;

async function newIdentity(server: string): Promise<{ identity: string; token: string }> {
  const res = await fetch(`${server}/v1/identity`, { method: 'POST' });
  if (!res.ok) throw new Error(`server answered ${res.status}`);
  return (await res.json()) as { identity: string; token: string };
}

async function callReducer(session: NftAdminSession, reducer: string, args: unknown[]): Promise<void> {
  const res = await fetch(`${base(session.server, session.db)}/call/${reducer}`, {
    method: 'POST', headers: { Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`${reducer}: ${(await res.text()) || res.status}`);
}

/** NFTs players asked to send, oldest order not guaranteed. */
export async function loadNftQueue(server: string, db: string): Promise<QueuedNft[]> {
  const { token } = await newIdentity(server);
  const res = await fetch(`${base(server, db)}/sql`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: "SELECT * FROM nft WHERE status = 'queued'",
  });
  if (!res.ok) throw new Error(`server answered ${res.status}: ${await res.text()}`);
  const [table] = (await res.json()) as { schema: { elements: { name: { some: string } }[] }; rows: unknown[][] }[];
  const col = (name: string) => {
    const i = table.schema.elements.findIndex((e) => e.name.some === name);
    if (i < 0) throw new Error(`nft table has no column ${name}`);
    return i;
  };
  const c = { ref: col('ref'), tokenId: col('token_id'), season: col('season'), level: col('level'), weapon: col('weapon'), rarity: col('rarity'), seed: col('seed'), recipient: col('recipient') };
  return table.rows.map((r) => ({
    ref: String(r[c.ref]), tokenId: BigInt(String(r[c.tokenId])), recipient: String(r[c.recipient]),
    skin: nftSkinWord(Number(r[c.season]), Number(r[c.level]), { weapon: String(r[c.weapon]), rarity: String(r[c.rarity]) as RarityId }, Number(r[c.seed])),
  }));
}

/** Log in on a new server identity with a signature of the login text. */
export async function nftAdminSession(server: string, db: string, address: string, sign: (message: string) => Promise<string>): Promise<NftAdminSession> {
  const { identity, token } = await newIdentity(server);
  const issuedAtMs = Date.now();
  const signature = await sign(loginMessage(address, identity, issuedAtMs));
  const session = { server, db, token };
  await callReducer(session, 'login', [address, issuedAtMs, signature]);
  return session;
}

/** Tell the server these NFTs were minted in this transaction. Only the admin wallet is accepted. */
export function markNftsSent(session: NftAdminSession, refs: readonly string[], tx: string): Promise<void> {
  return callReducer(session, 'mark_nfts_sent', [refs, tx]);
}
