// Copyright 2018-2020 the oak authors. All rights reserved. MIT license.
import { httpErrors } from "./httpError.ts";
import { isMediaType } from "./isMediaType.ts";
import { FormDataReader } from "./multipart.ts";
import { preferredCharsets } from "./negotiation/charset.ts";
import { preferredEncodings } from "./negotiation/encoding.ts";
import { preferredLanguages } from "./negotiation/language.ts";
import { preferredMediaTypes } from "./negotiation/mediaType.ts";
const decoder = new TextDecoder();
const defaultBodyContentTypes = {
    json: ["json", "application/*+json", "application/csp-report"],
    form: ["urlencoded"],
    formData: ["multipart"],
    text: ["text"],
};
/** An interface which provides information about the current request. */
export class Request {
    constructor(serverRequest, proxy = false, secure = false) {
        this.#proxy = proxy;
        this.#secure = secure;
        this.#serverRequest = serverRequest;
    }
    #body;
    #proxy;
    #rawBodyPromise;
    #secure;
    #serverRequest;
    #url;
    /** Is `true` if the request has a body, otherwise `false`. */
    get hasBody() {
        return (this.headers.get("transfer-encoding") !== null ||
            !!parseInt(this.headers.get("content-length") ?? ""));
    }
    /** The `Headers` supplied in the request. */
    get headers() {
        return this.#serverRequest.headers;
    }
    /** Request remote address. When the application's `.proxy` is true, the
     * `X-Forwarded-For` will be used to determine the requesting remote address.
     */
    get ip() {
        return this.#proxy
            ? this.ips[0]
            : this.#serverRequest.conn.remoteAddr.hostname;
    }
    /** When the application's `.proxy` is `true`, this will be set to an array of
     * IPs, ordered from upstream to downstream, based on the value of the header
     * `X-Forwarded-For`.  When `false` an empty array is returned. */
    get ips() {
        return this.#proxy
            ? (this.#serverRequest.headers.get("x-forwarded-for") ??
                this.#serverRequest.conn.remoteAddr.hostname).split(/\s*,\s*/)
            : [];
    }
    /** The HTTP Method used by the request. */
    get method() {
        return this.#serverRequest.method;
    }
    /** Shortcut to `request.url.protocol === "https:"`. */
    get secure() {
        return this.#secure;
    }
    /** Set to the value of the _original_ Deno server request. */
    get serverRequest() {
        return this.#serverRequest;
    }
    /** A parsed URL for the request which complies with the browser standards.
     * When the application's `.proxy` is `true`, this value will be based off of
     * the `X-Forwarded-Proto` and `X-Forwarded-Host` header values if present in
     * the request. */
    get url() {
        if (!this.#url) {
            const serverRequest = this.#serverRequest;
            let proto;
            let host;
            if (this.#proxy) {
                proto = serverRequest
                    .headers.get("x-forwarded-proto")?.split(/\s*,\s*/, 1)[0] ??
                    "http";
                host = serverRequest.headers.get("x-forwarded-host") ??
                    serverRequest.headers.get("host") ?? "";
            }
            else {
                proto = this.#secure ? "https" : "http";
                host = serverRequest.headers.get("host") ?? "";
            }
            this.#url = new URL(`${proto}://${host}${serverRequest.url}`);
        }
        return this.#url;
    }
    accepts(...types) {
        const acceptValue = this.#serverRequest.headers.get("Accept");
        if (!acceptValue) {
            return;
        }
        if (types.length) {
            return preferredMediaTypes(acceptValue, types)[0];
        }
        return preferredMediaTypes(acceptValue);
    }
    acceptsCharsets(...charsets) {
        const acceptCharsetValue = this.#serverRequest.headers.get("Accept-Charset");
        if (!acceptCharsetValue) {
            return;
        }
        if (charsets.length) {
            return preferredCharsets(acceptCharsetValue, charsets)[0];
        }
        return preferredCharsets(acceptCharsetValue);
    }
    acceptsEncodings(...encodings) {
        const acceptEncodingValue = this.#serverRequest.headers.get("Accept-Encoding");
        if (!acceptEncodingValue) {
            return;
        }
        if (encodings.length) {
            return preferredEncodings(acceptEncodingValue, encodings)[0];
        }
        return preferredEncodings(acceptEncodingValue);
    }
    acceptsLanguages(...langs) {
        const acceptLanguageValue = this.#serverRequest.headers.get("Accept-Language");
        if (!acceptLanguageValue) {
            return;
        }
        if (langs.length) {
            return preferredLanguages(acceptLanguageValue, langs)[0];
        }
        return preferredLanguages(acceptLanguageValue);
    }
    async body({ asReader, contentTypes = {} } = {}) {
        if (this.#body) {
            if (asReader && this.#body.type !== "reader") {
                return Promise.reject(new TypeError(`Body already consumed as type: "${this.#body.type}".`));
            }
            else if (this.#body.type === "reader") {
                return Promise.reject(new TypeError(`Body already consumed as type: "reader".`));
            }
            return this.#body;
        }
        const encoding = this.headers.get("content-encoding") || "identity";
        if (encoding !== "identity") {
            throw new httpErrors.UnsupportedMediaType(`Unsupported content-encoding: ${encoding}`);
        }
        if (!this.hasBody) {
            return (this.#body = { type: "undefined", value: undefined });
        }
        const contentType = this.headers.get("content-type");
        if (contentType) {
            if (asReader) {
                return (this.#body = {
                    type: "reader",
                    value: this.#serverRequest.body,
                });
            }
            const contentTypesFormData = [
                ...defaultBodyContentTypes.formData,
                ...(contentTypes.formData ?? []),
            ];
            if (isMediaType(contentType, contentTypesFormData)) {
                return (this.#body = {
                    type: "form-data",
                    value: new FormDataReader(contentType, this.#serverRequest.body),
                });
            }
            const rawBody = await (this.#rawBodyPromise ??
                (this.#rawBodyPromise = Deno.readAll(this.#serverRequest.body)));
            const value = decoder.decode(rawBody);
            const contentTypesRaw = contentTypes.raw;
            const contentTypesJson = [
                ...defaultBodyContentTypes.json,
                ...(contentTypes.json ?? []),
            ];
            const contentTypesForm = [
                ...defaultBodyContentTypes.form,
                ...(contentTypes.form ?? []),
            ];
            const contentTypesText = [
                ...defaultBodyContentTypes.text,
                ...(contentTypes.text ?? []),
            ];
            console.log("contentType", contentType);
            if (contentTypesRaw && isMediaType(contentType, contentTypesRaw)) {
                return (this.#body = { type: "raw", value: rawBody });
            }
            else if (isMediaType(contentType, contentTypesJson)) {
                return (this.#body = { type: "json", value: JSON.parse(value) });
            }
            else if (isMediaType(contentType, contentTypesForm)) {
                return (this.#body = {
                    type: "form",
                    value: new URLSearchParams(value.replace(/\+/g, " ")),
                });
            }
            else if (isMediaType(contentType, contentTypesText)) {
                return (this.#body = { type: "text", value });
            }
            else {
                return (this.#body = { type: "raw", value: rawBody });
            }
        }
        throw new httpErrors.UnsupportedMediaType(contentType
            ? `Unsupported content-type: ${contentType}`
            : "Missing content-type");
    }
}
//# sourceMappingURL=file:///mnt/d/Dev/Deno/Example-Deno-Oak-MongoDB-RESTAPI/deno_dir/gen/https/deno.land/x/oak/request.ts.js.map