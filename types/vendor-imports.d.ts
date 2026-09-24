declare module 'pdfjs-dist/legacy/build/pdf.mjs' {
  export function getDocument(input: { data: Uint8Array; useSystemFonts?: boolean }): {
    promise: Promise<{
      numPages: number;
      getPage(pageNumber: number): Promise<{
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
