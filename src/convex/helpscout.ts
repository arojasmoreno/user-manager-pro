"use node";

/**
 * Help Scout Mailbox API 2.0 integration.
 *
 * A signed-in user sends a support request from the app and it lands in a Help
 * Scout inbox, already tagged and linked to their account, so support answers
 * in one place instead of by email.
 *
 * The credentials live in the deployment environment and are only ever read
 * here, inside a Node action — never in the browser.
 */

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";

const API_BASE = "https://api.helpscout.net/v2";
/** Every conversation created from here is tagged so it can be filtered. */
const TAGS = ["doc-manager"];

export class HelpScoutNotConfiguredError extends Error {
  constructor() {
    super(
      "El soporte no está configurado. Añade HELPSCOUT_CLIENT_ID, HELPSCOUT_CLIENT_SECRET y HELPSCOUT_MAILBOX_ID en la pestaña Keys.",
    );
    this.name = "HelpScoutNotConfiguredError";
  }
}

export type Credentials = {
  clientId: string;
  clientSecret: string;
  mailboxId: number;
};

/** Reads and validates the deployment configuration. */
export function readCredentials(env: Record<string, string | undefined>): Credentials {
  const clientId = env.HELPSCOUT_CLIENT_ID?.trim();
  const clientSecret = env.HELPSCOUT_CLIENT_SECRET?.trim();
  const rawMailboxId = env.HELPSCOUT_MAILBOX_ID?.trim();
  const mailboxId = Number(rawMailboxId);

  if (!clientId || !clientSecret || !rawMailboxId || !Number.isInteger(mailboxId)) {
    throw new HelpScoutNotConfiguredError();
  }
  return { clientId, clientSecret, mailboxId };
}

/**
 * Exchanges the client credentials for an access token (Client Credentials
 * flow). Tokens last two days, so it is fetched per request rather than cached.
 */
export async function fetchAccessToken(
  credentials: Credentials,
  fetchImpl: typeof fetch,
): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
  });

  const res = await fetchImpl(`${API_BASE}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Help Scout rechazó las credenciales (${res.status}). ${detail.slice(0, 200)}`,
    );
  }

  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error("Help Scout no devolvió un token de acceso.");
  }
  return data.access_token;
}

/**
 * Help Scout takes a first name of 1-40 characters, while our users have a
 * single free-form `name`. Use the first word, so the conversation is not
 * rejected when someone typed "Antonio Rojas Moreno".
 */
export function customerFirstName(name: string | undefined): string | undefined {
  const first = name?.trim().split(/\s+/)[0];
  if (!first) return undefined;
  return first.slice(0, 40);
}

export type SupportPayload = {
  subject: string;
  body: string;
  customerEmail: string;
  customerName?: string;
  /** Extra context, e.g. the ficha the user was looking at. */
  context?: string;
};

/** Creates a conversation with one customer thread. */
export async function createConversation(
  payload: SupportPayload,
  credentials: Credentials,
  fetchImpl: typeof fetch,
): Promise<{ conversationId: number | null }> {
  const token = await fetchAccessToken(credentials, fetchImpl);
  const firstName = customerFirstName(payload.customerName);

  const res = await fetchImpl(`${API_BASE}/conversations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      subject: payload.subject,
      type: "email",
      status: "active",
      mailboxId: credentials.mailboxId,
      customer: {
        email: payload.customerEmail,
        ...(firstName ? { firstName } : {}),
      },
      threads: [
        {
          type: "customer",
          customer: { email: payload.customerEmail },
          text: payload.context
            ? `${payload.body}\n\n---\nContexto: ${payload.context}`
            : payload.body,
        },
      ],
      tags: TAGS,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Help Scout no pudo crear la conversación (${res.status}). ${detail.slice(0, 200)}`,
    );
  }

  // 201 Created answers with the resource in the body.
  const data = (await res.json().catch(() => null)) as {
    id?: number;
  } | null;
  return { conversationId: data?.id ?? null };
}

const MAX_SUBJECT = 120;
const MAX_BODY = 4000;
const MAX_CONTEXT = 500;

export const sendSupportRequest = action({
  args: {
    subject: v.string(),
    body: v.string(),
    context: v.optional(v.string()),
  },
  returns: v.object({ conversationId: v.union(v.number(), v.null()) }),
  // The return type is written out: without it, inferring it through
  // `internal.access.requireUserInternal` makes the action's own type
  // self-referential, because the generated api object includes this action.
  handler: async (
    ctx,
    args,
  ): Promise<{ conversationId: number | null }> => {
    const user = await ctx.runQuery(internal.access.requireUserInternal, {});
    if (!user.email) {
      throw new Error(
        "Tu cuenta no tiene correo electrónico, así que no podemos abrir la solicitud.",
      );
    }

    const subject = args.subject.trim();
    const body = args.body.trim();
    if (subject === "" || body === "") {
      throw new Error("Escribe un asunto y un mensaje antes de enviar.");
    }
    if (subject.length > MAX_SUBJECT) {
      throw new Error(`El asunto no puede pasar de ${MAX_SUBJECT} caracteres.`);
    }
    if (body.length > MAX_BODY) {
      throw new Error(`El mensaje no puede pasar de ${MAX_BODY} caracteres.`);
    }

    const credentials = readCredentials(process.env);
    const context = args.context?.trim().slice(0, MAX_CONTEXT);

    return await createConversation(
      {
        subject,
        body,
        context: context || undefined,
        customerEmail: user.email,
        customerName: user.name,
      },
      credentials,
      fetch,
    );
  },
});
