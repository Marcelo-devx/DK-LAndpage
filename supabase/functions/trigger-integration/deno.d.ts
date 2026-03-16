/// <reference lib="deno.ns" />

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

declare module "https://deno.land/*" {
  const value: any;
  export default value;
  export * from "https://deno.land/*";
}

declare module "https://esm.sh/*" {
  const value: any;
  export default value;
  export * from "https://esm.sh/*";
}

export {};