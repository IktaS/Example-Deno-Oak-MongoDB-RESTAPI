// Copyright 2018-2020 the oak authors. All rights reserved. MIT license.
const matchCache = {};
const FIELD_CONTENT_REGEXP = /^[\u0009\u0020-\u007e\u0080-\u00ff]+$/;
const KEY_REGEXP = /(?:^|;) *([^=]*)=[^;]*/g;
const SAME_SITE_REGEXP = /^(?:lax|none|strict)$/i;
function getPattern(name) {
    if (name in matchCache) {
        return matchCache[name];
    }
    return matchCache[name] = new RegExp(`(?:^|;) *${name.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&")}=([^;]*)`);
}
function pushCookie(headers, cookie) {
    if (cookie.overwrite) {
        for (let i = headers.length - 1; i >= 0; i--) {
            if (headers[i].indexOf(`${cookie.name}=`) === 0) {
                headers.splice(i, 1);
            }
        }
    }
    headers.push(cookie.toHeader());
}
function validateCookieProperty(key, value) {
    if (value && !FIELD_CONTENT_REGEXP.test(value)) {
        throw new TypeError(`The ${key} of the cookie (${value}) is invalid.`);
    }
}
class Cookie {
    /** A logical representation of a cookie, used to internally manage the
     * cookie instances. */
    constructor(name, value, attributes) {
        this.httpOnly = true;
        this.overwrite = false;
        this.path = "/";
        this.sameSite = false;
        this.secure = false;
        validateCookieProperty("name", name);
        validateCookieProperty("value", value);
        this.name = name;
        this.value = value ?? "";
        Object.assign(this, attributes);
        if (!this.value) {
            this.expires = new Date(0);
            this.maxAge = undefined;
        }
        validateCookieProperty("path", this.path);
        validateCookieProperty("domain", this.domain);
        if (this.sameSite && typeof this.sameSite === "string" &&
            !SAME_SITE_REGEXP.test(this.sameSite)) {
            throw new TypeError(`The sameSite of the cookie ("${this.sameSite}") is invalid.`);
        }
    }
    toHeader() {
        let header = this.toString();
        if (this.maxAge) {
            this.expires = new Date(Date.now() + this.maxAge);
        }
        if (this.path) {
            header += `; path=${this.path}`;
        }
        if (this.expires) {
            header += `; expires=${this.expires.toUTCString()}`;
        }
        if (this.domain) {
            header += `; domain=${this.domain}`;
        }
        if (this.sameSite) {
            header += `; samesite=${this.sameSite === true ? "strict" : this.sameSite.toLowerCase()}`;
        }
        if (this.secure) {
            header += "; secure";
        }
        if (this.httpOnly) {
            header += "; httponly";
        }
        return header;
    }
    toString() {
        return `${this.name}=${this.value}`;
    }
}
/** An interface which allows setting and accessing cookies related to both the
 * current request and response. */
export class Cookies {
    constructor(request, response, options = {}) {
        this.#requestKeys = () => {
            if (this.#cookieKeys) {
                return this.#cookieKeys;
            }
            const result = this.#cookieKeys = [];
            const header = this.#request.headers.get("cookie");
            if (!header) {
                return result;
            }
            let matches;
            while ((matches = KEY_REGEXP.exec(header))) {
                const [, key] = matches;
                result.push(key);
            }
            return result;
        };
        const { keys, secure } = options;
        this.#keys = keys;
        this.#request = request;
        this.#response = response;
        this.#secure = secure;
    }
    #cookieKeys;
    #keys;
    #request;
    #response;
    #secure;
    #requestKeys;
    /** Set a cookie to be deleted in the response.  This is a "shortcut" to
     * `.set(name, null, options?)`. */
    delete(name, options = {}) {
        this.set(name, null, options);
        return true;
    }
    /** Iterate over the request's cookies, yielding up a tuple containing the
     * key and the value.
     *
     * If there are keys set on the application, only keys and values that are
     * properly signed will be returned. */
    *entries() {
        const keys = this.#requestKeys();
        for (const key of keys) {
            const value = this.get(key);
            if (value) {
                yield [key, value];
            }
        }
    }
    forEach(callback, thisArg = null) {
        const keys = this.#requestKeys();
        for (const key of keys) {
            const value = this.get(key);
            if (value) {
                callback.call(thisArg, key, value, this);
            }
        }
    }
    /** Get the value of a cookie from the request.
     *
     * If the cookie is signed, and the signature is invalid, the cookie will
     * be set to be deleted in the the response.  If the signature uses an "old"
     * key, the cookie will be re-signed with the current key and be added to the
     * response to be updated. */
    get(name, options = {}) {
        const signed = options.signed ?? !!this.#keys;
        const nameSig = `${name}.sig`;
        const header = this.#request.headers.get("cookie");
        if (!header) {
            return;
        }
        const match = header.match(getPattern(name));
        if (!match) {
            return;
        }
        const [, value] = match;
        if (!signed) {
            return value;
        }
        const digest = this.get(nameSig, { signed: false });
        if (!digest) {
            return;
        }
        const data = `${name}=${value}`;
        if (!this.#keys) {
            throw new TypeError("keys required for signed cookies");
        }
        const index = this.#keys.indexOf(data, digest);
        if (index < 0) {
            this.delete(nameSig, { path: "/", signed: false });
        }
        else {
            if (index) {
                // the key has "aged" and needs to be re-signed
                this.set(nameSig, this.#keys.sign(data), { signed: false });
            }
            return value;
        }
    }
    /** Iterate over the request's cookies, yielding up the keys.
     *
     * If there are keys set on the application, only the keys that are properly
     * signed will be returned. */
    *keys() {
        const keys = this.#requestKeys();
        for (const key of keys) {
            const value = this.get(key);
            if (value) {
                yield key;
            }
        }
    }
    /** Set a cookie in the response.
     *
     * If there are keys set in the application, cookies will be automatically
     * signed, unless overridden by the set options.  Cookies can be deleted by
     * setting the value to `null`. */
    set(name, value, options = {}) {
        const request = this.#request;
        const response = this.#response;
        let headers = response.headers.get("Set-Cookie") ?? [];
        if (typeof headers === "string") {
            headers = [headers];
        }
        const secure = this.#secure !== undefined ? this.#secure : request.secure;
        const signed = options.signed ?? !!this.#keys;
        if (!secure && options.secure) {
            throw new TypeError("Cannot send secure cookie over unencrypted connection.");
        }
        const cookie = new Cookie(name, value, options);
        cookie.secure = options.secure ?? secure;
        pushCookie(headers, cookie);
        if (signed) {
            if (!this.#keys) {
                throw new TypeError(".keys required for signed cookies.");
            }
            cookie.value = this.#keys.sign(cookie.toString());
            cookie.name += ".sig";
            pushCookie(headers, cookie);
        }
        for (const header of headers) {
            response.headers.append("Set-Cookie", header);
        }
        return this;
    }
    /** Iterate over the request's cookies, yielding up each value.
     *
     * If there are keys set on the application, only the values that are
     * properly signed will be returned. */
    *values() {
        const keys = this.#requestKeys();
        for (const key of keys) {
            const value = this.get(key);
            if (value) {
                yield value;
            }
        }
    }
    /** Iterate over the request's cookies, yielding up a tuple containing the
     * key and the value.
     *
     * If there are keys set on the application, only keys and values that are
     * properly signed will be returned. */
    *[Symbol.iterator]() {
        const keys = this.#requestKeys();
        for (const key of keys) {
            const value = this.get(key);
            if (value) {
                yield [key, value];
            }
        }
    }
}
//# sourceMappingURL=file:///mnt/d/Dev/Deno/Example-Deno-Oak-MongoDB-RESTAPI/deno_dir/gen/https/deno.land/x/oak/cookies.ts.js.map