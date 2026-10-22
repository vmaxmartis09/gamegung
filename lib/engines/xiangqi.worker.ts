/// <reference lib="webworker" />
import { searchXiangqi, XSearchOptions } from "./xiangqi-engine";

self.onmessage = (e: MessageEvent<{ id: number; fen: string; history: number[]; opts: XSearchOptions }>) => {
  const { id, fen, history, opts } = e.data;
  const result = searchXiangqi(fen, history, opts);
  (self as unknown as Worker).postMessage({ id, result });
};
