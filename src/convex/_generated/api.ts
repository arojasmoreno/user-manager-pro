/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as access from "../access.js";
import type * as accountSetup from "../accountSetup.js";
import type * as ai from "../ai.js";
import type * as aiClient from "../aiClient.js";
import type * as assistant from "../assistant.js";
import type * as auth from "../auth.js";
import type * as auth_emailOtp from "../auth/emailOtp.js";
import type * as fichaIndex from "../fichaIndex.js";
import type * as fichas from "../fichas.js";
import type * as fichasAdmin from "../fichasAdmin.js";
import type * as fichaTypes from "../fichaTypes.js";
import type * as http from "../http.js";
import type * as traducciones from "../traducciones.js";
import type * as traduccionesAi from "../traduccionesAi.js";
import type * as users from "../users.js";
import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import { anyApi, componentsGeneric } from "convex/server";

const fullApi: ApiFromModules<{
  access: typeof access;
  accountSetup: typeof accountSetup;
  ai: typeof ai;
  aiClient: typeof aiClient;
  assistant: typeof assistant;
  auth: typeof auth;
  "auth/emailOtp": typeof auth_emailOtp;
  fichaIndex: typeof fichaIndex;
  fichas: typeof fichas;
  fichasAdmin: typeof fichasAdmin;
  fichaTypes: typeof fichaTypes;
  http: typeof http;
  traducciones: typeof traducciones;
  traduccionesAi: typeof traduccionesAi;
  users: typeof users;
}> = anyApi as any;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
> = anyApi as any;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
> = anyApi as any;

export declare const components: {};
