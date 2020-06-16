// Copyright 2018-2020 the oak authors. All rights reserved. MIT license.
import { contentType, Status } from "./deps.ts";
import { isHtml, isRedirectStatus, encodeUrl } from "./util.ts";
/** A symbol that indicates to `response.redirect()` to attempt to redirect
 * back to the request referrer.  For example:
 *
 * ```ts
 * import { Application, REDIRECT_BACK } from "https://deno.land/x/oak/mod.ts";
 *
 * const app = new Application();
 *
 * app.use((ctx) => {
 *   if (ctx.request.url.pathName === "/back") {
 *     ctx.response.redirect(REDIRECT_BACK, "/");
 *   }
 * });
 *
 * await app.listen({ port: 80 });
 * ```
 */
export const REDIRECT_BACK = Symbol("redirect backwards");
const BODY_TYPES = ["string", "number", "bigint", "boolean", "symbol"];
const encoder = new TextEncoder();
/** Guard for `Deno.Reader`. */
function isReader(value) {
    return value && typeof value === "object" && "read" in value &&
        typeof value.read === "function";
}
function isPromiseLike(value) {
    return value && typeof value === "object" && "then" in value &&
        typeof value.then === "function";
}
async function convertBody(body, type) {
    let result;
    if (BODY_TYPES.includes(typeof body)) {
        const bodyText = String(body);
        result = encoder.encode(bodyText);
        type = type ?? (isHtml(bodyText) ? "html" : "text/plain");
    }
    else if (body instanceof Uint8Array || isReader(body)) {
        result = body;
    }
    else if (body && typeof body === "object") {
        result = encoder.encode(JSON.stringify(body));
        type = type ?? "json";
    }
    else if (typeof body === "function") {
        const result = body.call(null);
        return convertBody(isPromiseLike(result) ? await result : result, type);
    }
    else if (body) {
        throw new TypeError("Response body was set but could not convert.");
    }
    return [result, type];
}
/** An interface to control what response will be sent when the middleware
 * finishes processing the request. */
export class Response {
    constructor(request) {
        this.#headers = new Headers();
        this.#resources = [];
        this.#writable = true;
        this.#getBody = async () => {
            const [body, type] = await convertBody(this.body, this.type);
            this.type = type;
            return body;
        };
        this.#setContentType = () => {
            if (this.type) {
                const contentTypeString = contentType(this.type);
                if (contentTypeString && !this.headers.has("Content-Type")) {
                    this.headers.append("Content-Type", contentTypeString);
                }
            }
        };
        this.#request = request;
    }
    #body;
    #headers;
    #request;
    #resources;
    #serverResponse;
    #status;
    #type;
    #writable;
    #getBody;
    #setContentType;
    /** The body of the response.  The body will be automatically processed when
     * the response is being sent and converted to a `Uint8Array` or a
     * `Deno.Reader`. */
    get body() {
        return this.#body;
    }
    /** The body of the response.  The body will be automatically processed when
     * the response is being sent and converted to a `Uint8Array` or a
     * `Deno.Reader`. */
    set body(value) {
        if (!this.#writable) {
            throw new Error("The response is not writable.");
        }
        this.#body = value;
    }
    /** Headers that will be returned in the response. */
    get headers() {
        return this.#headers;
    }
    /** Headers that will be returned in the response. */
    set headers(value) {
        if (!this.#writable) {
            throw new Error("The response is not writable.");
        }
        this.#headers = value;
    }
    /** The HTTP status of the response.  If this has not been explicitly set,
     * reading the value will return what would be the value of status if the
     * response were sent at this point in processing the middleware.  If the body
     * has been set, the status will be `200 OK`.  If a value for the body has
     * not been set yet, the status will be `404 Not Found`. */
    get status() {
        if (this.#status) {
            return this.#status;
        }
        const typeofbody = typeof this.body;
        return this.body &&
            (BODY_TYPES.includes(typeofbody) || typeofbody === "object")
            ? Status.OK
            : Status.NotFound;
    }
    /** The HTTP status of the response.  If this has not been explicitly set,
     * reading the value will return what would be the value of status if the
     * response were sent at this point in processing the middleware.  If the body
     * has been set, the status will be `200 OK`.  If a value for the body has
     * not been set yet, the status will be `404 Not Found`. */
    set status(value) {
        if (!this.#writable) {
            throw new Error("The response is not writable.");
        }
        this.#status = value;
    }
    /** The media type, or extension of the response.  Setting this value will
     * ensure an appropriate `Content-Type` header is added to the response. */
    get type() {
        return this.#type;
    }
    /** The media type, or extension of the response.  Setting this value will
     * ensure an appropriate `Content-Type` header is added to the response. */
    set type(value) {
        if (!this.#writable) {
            throw new Error("The response is not writable.");
        }
        this.#type = value;
    }
    /** A read-only property which determines if the response is writable or not.
     * Once the response has been processed, this value is set to `false`. */
    get writable() {
        return this.#writable;
    }
    /** Add a resource to the list of resources that will be closed when the
     * request is destroyed. */
    addResource(rid) {
        this.#resources.push(rid);
    }
    /** Release any resources that are being tracked by the response. */
    destroy() {
        this.#writable = false;
        this.#body = undefined;
        this.#serverResponse = undefined;
        for (const rid of this.#resources) {
            Deno.close(rid);
        }
    }
    redirect(url, alt = "/") {
        if (url === REDIRECT_BACK) {
            url = this.#request.headers.get("Referrer") ?? String(alt);
        }
        else if (typeof url === "object") {
            url = String(url);
        }
        this.headers.set("Location", encodeUrl(url));
        if (!this.status || !isRedirectStatus(this.status)) {
            this.status = Status.Found;
        }
        if (this.#request.accepts("html")) {
            url = encodeURI(url);
            this.type = "text/html; charset=utf-8";
            this.body = `Redirecting to <a href="${url}">${url}</a>.`;
            return;
        }
        this.type = "text/plain; charset=utf-8";
        this.body = `Redirecting to ${url}.`;
    }
    /** Take this response and convert it to the response used by the Deno net
     * server.  Calling this will set the response to not be writable.
     *
     * Most users will have no need to call this method. */
    async toServerResponse() {
        if (this.#serverResponse) {
            return this.#serverResponse;
        }
        // Process the body
        const body = await this.#getBody();
        // If there is a response type, set the content type header
        this.#setContentType();
        const { headers } = this;
        // If there is no body and no content type and no set length, then set the
        // content length to 0
        if (!(body ||
            headers.has("Content-Type") ||
            headers.has("Content-Length"))) {
            headers.append("Content-Length", "0");
        }
        this.#writable = false;
        return this.#serverResponse = {
            status: this.#status ?? (body ? Status.OK : Status.NotFound),
            body,
            headers,
        };
    }
}
//# sourceMappingURL=file:///mnt/d/Dev/Deno/Example-Deno-Oak-MongoDB-RESTAPI/deno_dir/gen/https/deno.land/x/oak/response.ts.js.map