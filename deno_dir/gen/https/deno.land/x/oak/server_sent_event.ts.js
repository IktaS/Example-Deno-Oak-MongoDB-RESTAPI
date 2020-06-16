// Copyright 2018-2020 the oak authors. All rights reserved. MIT license.
import { assert } from "./deps.ts";
const encoder = new TextEncoder();
class CloseEvent extends Event {
    constructor(eventInit) {
        super("close", eventInit);
    }
}
/** An event which contains information which will be sent to the remote
 * connection and be made available in an `EventSource` as an event. */
export class ServerSentEvent extends Event {
    constructor(type, data, { replacer, space, ...eventInit } = {}) {
        super(type, eventInit);
        this.#type = type;
        try {
            this.#data = typeof data === "string"
                ? data
                : JSON.stringify(data, replacer, space);
        }
        catch (e) {
            assert(e instanceof Error);
            throw new TypeError(`data could not be coerced into a serialized string.\n  ${e.message}`);
        }
        const { id } = eventInit;
        this.#id = id;
    }
    #data;
    #id;
    #type;
    /** The data associated with the event, which will be sent to the client and
     * be made available in the `EventSource`. */
    get data() {
        return this.#data;
    }
    /** The optional ID associated with the event that will be sent to the client
     * and be made available in the `EventSource`. */
    get id() {
        return this.#id;
    }
    toString() {
        const data = `data: ${this.#data.split("\n").join("\ndata: ")}\n`;
        return `${this.#type === "__message" ? "" : `event: ${this.#type}\n`}${this.#id ? `id: ${String(this.#id)}\n` : ""}${data}\n`;
    }
}
const response = `HTTP/1.1 200 OK\n`;
const responseHeaders = new Headers([
    ["Connection", "Keep-Alive"],
    ["Content-Type", "text/event-stream"],
    ["Cache-Control", "no-cache"],
    ["Keep-Alive", `timeout=${Number.MAX_SAFE_INTEGER}`],
]);
export class ServerSentEventTarget extends EventTarget {
    constructor(app, serverRequest, { headers } = {}) {
        super();
        this.#closed = false;
        this.#send = async (payload) => {
            if (this.#closed) {
                return;
            }
            if (this.#ready !== true) {
                await this.#ready;
                this.#ready = true;
            }
            try {
                await (this.#writing = this.#writer.write(encoder.encode(payload)));
                await (this.#writing = this.#writer.flush());
            }
            catch (error) {
                this.#writing = undefined;
                this.dispatchEvent(new CloseEvent({ cancelable: false }));
                const errorEvent = new ErrorEvent("error", { error });
                this.dispatchEvent(errorEvent);
                this.#app.dispatchEvent(errorEvent);
            }
        };
        this.#setup = async (overrideHeaders) => {
            const headers = new Headers(responseHeaders);
            if (overrideHeaders) {
                for (const [key, value] of overrideHeaders) {
                    headers.set(key, value);
                }
            }
            let payload = response;
            for (const [key, value] of headers) {
                payload += `${key}: ${value}\n`;
            }
            payload += `\n`;
            try {
                await this.#writer.write(encoder.encode(payload));
                await this.#writer.flush();
            }
            catch (error) {
                this.dispatchEvent(new CloseEvent({ cancelable: false }));
                const errorEvent = new ErrorEvent("error", { error });
                this.dispatchEvent(errorEvent);
                this.#app.dispatchEvent(errorEvent);
                throw error;
            }
        };
        this.#app = app;
        this.#serverRequest = serverRequest;
        this.#writer = this.#serverRequest.w;
        this.addEventListener("close", () => {
            this.#closed = true;
            try {
                this.#serverRequest.conn.close();
            }
            catch (error) {
                if (!(error instanceof Deno.errors.BadResource)) {
                    const errorEvent = new ErrorEvent("error", { error });
                    this.dispatchEvent(errorEvent);
                    this.#app.dispatchEvent(errorEvent);
                }
            }
        });
        this.#ready = this.#setup(headers);
    }
    #app;
    #closed;
    #ready;
    #serverRequest;
    #writer;
    #writing;
    #send;
    #setup;
    /** Is set to `true` if events cannot be sent to the remote connection.
     * Otherwise it is set to `false`.
     *
     * *Note*: This flag is lazily set, and might not reflect a closed state until
     * another event, comment or message is attempted to be processed. */
    get closed() {
        return this.#closed;
    }
    /** Stop sending events to the remote connection and close the connection. */
    async close() {
        if (this.#ready !== true) {
            await this.#ready;
        }
        if (this.#writing) {
            await this.#writing;
        }
        this.dispatchEvent(new CloseEvent({ cancelable: false }));
    }
    /** Send a comment to the remote connection.  Comments are not exposed to the
     * client `EventSource` but are used for diagnostics and helping ensure a
     * connection is kept alive.
     *
     * ```ts
     * import { Application } from "https://deno.land/x/oak/mod.ts";
     *
     * const app = new Application();
     *
     * app.use((ctx) => {
     *    const sse = ctx.getSSETarget();
     *    sse.dispatchComment("this is a comment");
     * });
     *
     * await app.listen();
     * ```
     */
    dispatchComment(comment) {
        this.#send(`: ${comment.split("\n").join("\n: ")}\n\n`);
        return true;
    }
    /** Dispatch a message to the client.  This message will contain `data: ` only
     * and be available on the client `EventSource` on the `onmessage` or an event
     * listener of type `"message"`. */
    dispatchMessage(data) {
        const event = new ServerSentEvent("__message", data);
        return this.dispatchEvent(event);
    }
    dispatchEvent(event) {
        let dispatched = super.dispatchEvent(event);
        if (dispatched) {
            this.#send(String(event));
        }
        return dispatched;
    }
}
//# sourceMappingURL=file:///mnt/d/Dev/Deno/Example-Deno-Oak-MongoDB-RESTAPI/deno_dir/gen/https/deno.land/x/oak/server_sent_event.ts.js.map