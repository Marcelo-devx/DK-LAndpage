declare module "https://deno.land/std@0.190.0/http/server.ts" {
  export function serve(handler: (req: Request) => Response | Promise<Response>): void;
}

declare module "https://esm.sh/@supabase/supabase-js@2.45.0" {
  export * from "@supabase/supabase-js";
}

declare module "https://deno.land/*" {
  const value: any;
  export default value;
  export const serve: any;
  export const createClient: any;
}

declare module "https://esm.sh/*" {
  const value: any;
  export default value;
  export const createClient: any;
}

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

interface AbortSignal {
  timeout(ms: number): AbortSignal;
}

export {};