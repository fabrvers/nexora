/**
 * Declarations pour le module sans typage fourni.
 *
 * Ecrites ici plutot que via des paquets @types : la surface utilisee est
 * minuscule, et cela evite une dependance de plus a installer.
 */

declare module "archiver" {
  import type { Writable } from "node:stream";

  interface Archive {
    pipe(destination: Writable): void;
    file(chemin: string, options: { name: string }): void;
    on(evenement: "error", rappel: (erreur: Error) => void): void;
    finalize(): Promise<void>;
  }
  function archiver(
    format: "zip" | "tar",
    options?: { zlib?: { level?: number } },
  ): Archive;
  export default archiver;
}

declare module "mailparser" {
  interface PieceJointeAnalysee {
    filename?: string;
    contentType?: string;
    contentDisposition?: string;
    cid?: string;
    related?: boolean;
    size?: number;
    content: Buffer;
  }
  interface MessageAnalyse {
    subject?: string;
    from?: { text?: string };
    date?: Date;
    attachments?: PieceJointeAnalysee[];
  }
  export function simpleParser(source: Buffer | string): Promise<MessageAnalyse>;
}
