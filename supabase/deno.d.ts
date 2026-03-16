declare global {
  namespace Deno {
    namespace env {
      function get(key: string): string | undefined;
    }
  }
}

declare global {
  interface AbortSignal {
    timeout(ms: number): AbortSignal;
  }
}

declare module "https://*" {
  const value: any;
  export default value;
  export * from "https://*";
}

export {};