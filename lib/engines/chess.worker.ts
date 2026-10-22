/// <reference lib="webworker" />
import { searchBestMove, SearchOptions } from "./chess-engine";

self.onmessage = (e: MessageEvent<{ id: number; fen: string; opts: SearchOptions }>) => {
  const { id, fen, opts } = e.data;
  const result = searchBestMove(fen, opts);
  (self as unknown as Worker).postMessage({ id, result });
};
