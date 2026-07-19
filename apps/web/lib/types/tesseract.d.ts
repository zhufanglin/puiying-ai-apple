declare module "tesseract.js" {
  namespace Tesseract {
    interface Worker {
      recognize(
        image: string | File | Blob | HTMLCanvasElement | HTMLImageElement,
        options?: Record<string, unknown>,
        config?: Record<string, unknown>
      ): Promise<WorkerResult>;
      reinitialize(language: string, oem: OEM, config?: Record<string, unknown>): Promise<void>;
      setParameters(params: Record<string, unknown>): Promise<void>;
      terminate(): Promise<void>;
    }

    interface WorkerResult {
      data: {
        text: string;
        confidence: number;
        lines?: Array<{
          text: string;
          confidence: number;
          bbox: { x0: number; y0: number; x1: number; y1: number };
        }>;
      };
    }

    enum OEM {
      DEFAULT = 3,
      TESSERACT_ONLY = 0,
      LSTM_ONLY = 1,
      TESSERACT_LSTM_COMBINED = 2,
    }

    enum PSM {
      AUTO = 3,
      AUTO_OSD = 0,
      AUTO_ONLY = 1,
      SINGLE_BLOCK = 6,
      SINGLE_LINE = 7,
      SINGLE_WORD = 8,
    }

    function createWorker(
      lang?: string,
      oem?: OEM,
      options?: Record<string, unknown>,
      config?: Record<string, unknown>
    ): Promise<Worker>;
  }

  export = Tesseract;
}
