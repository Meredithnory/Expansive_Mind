// types/next.d.ts
import { NextRequest } from "next/server";

declare module "next/server" {
    interface NextRequest {
        user?: any; // or specify your User type
    }
}
