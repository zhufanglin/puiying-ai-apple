declare module "pdfjs-dist" {
  interface GlobalWorkerOptionsType {
    workerSrc: string;
  }
  export const GlobalWorkerOptions: GlobalWorkerOptionsType;

  interface TextItem {
    str: string;
  }

  interface TextContent {
    items: TextItem[];
  }

  interface PDFPageViewport {
    width: number;
    height: number;
    clone(params?: { dontFlip?: boolean }): PDFPageViewport;
  }

  interface PDFPageProxy {
    getTextContent(): Promise<TextContent>;
    render(params: {
      canvasContext: CanvasRenderingContext2D | null;
      viewport: PDFPageViewport;
    }): { promise: Promise<void> };
    getViewport(params: { scale: number; rotation?: number }): PDFPageViewport;
    cleanup(): void;
  }

  interface PDFDocumentProxy {
    numPages: number;
    getPage(pageNumber: number): Promise<PDFPageProxy>;
    destroy(): void;
  }

  interface GetDocumentParams {
    data?: ArrayBuffer;
    url?: string;
  }

  function getDocument(params: GetDocumentParams): { promise: Promise<PDFDocumentProxy> };
  export { getDocument };
  export type { PDFDocumentProxy, PDFPageProxy, TextItem, TextContent };
}
