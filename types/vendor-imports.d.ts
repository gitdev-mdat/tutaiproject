declare module 'pdfjs-dist/legacy/build/pdf.mjs' {
  export function getDocument(input: {
    data: Uint8Array;
    useSystemFonts?: boolean;
    isEvalSupported?: boolean;
    verbosity?: number;
    /** Directory (with trailing slash) of pdf.js's wasm image decoders. */
    wasmUrl?: string;
  }): {
    promise: Promise<{
      numPages: number;
      destroy(): Promise<void>;
      getPage(pageNumber: number): Promise<{
        cleanup(): void;
        getViewport(input: { scale: number }): { width: number; height: number };
        render(input: {
          canvas: HTMLCanvasElement;
          canvasContext: CanvasRenderingContext2D;
          viewport: { width: number; height: number };
        }): { promise: Promise<void> };
        getTextContent(): Promise<{
          items: Array<{
            str?: string;
            width?: number;
            height?: number;
            transform?: number[];
          }>;
        }>;
      }>;
    }>;
  };
}

declare module 'mammoth' {
  export function extractRawText(input: { buffer: Buffer }): Promise<{
    value: string;
    messages: Array<{ type: string; message: string }>;
  }>;
}
