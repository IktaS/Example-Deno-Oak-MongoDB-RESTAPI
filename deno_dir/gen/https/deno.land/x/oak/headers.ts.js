// Copyright 2018-2020 the oak authors. All rights reserved. MIT license.
import { httpErrors } from "./httpError.ts";
const COLON = ":".charCodeAt(0);
const HTAB = "\t".charCodeAt(0);
const SPACE = " ".charCodeAt(0);
const decoder = new TextDecoder();
/** With a provided attribute pattern, return a RegExp which will match and
 * capture in the first group the value of the attribute from a header value. */
export function toParamRegExp(attributePattern, flags) {
    // deno-fmt-ignore
    return new RegExp(`(?:^|;)\\s*${attributePattern}\\s*=\\s*` +
        `(` +
        `[^";\\s][^;\\s]*` +
        `|` +
        `"(?:[^"\\\\]|\\\\"?)+"?` +
        `)`, flags);
}
/** Asynchronously read the headers out of body request and resolve with them as
 * a `Headers` object. */
export async function readHeaders(body) {
    const headers = new Headers();
    let readResult = await body.readLine();
    while (readResult) {
        const { bytes } = readResult;
        if (!bytes.length) {
            return headers;
        }
        let i = bytes.indexOf(COLON);
        if (i === -1) {
            throw new httpErrors.BadRequest(`Malformed header: ${decoder.decode(bytes)}`);
        }
        const key = decoder.decode(bytes.subarray(0, i));
        if (key === "") {
            throw new httpErrors.BadRequest("Invalid header key.");
        }
        i++;
        while (i < bytes.byteLength && (bytes[i] === SPACE || bytes[i] === HTAB)) {
            i++;
        }
        const value = decoder.decode(bytes.subarray(i));
        try {
            headers.append(key, value);
        }
        catch { }
        readResult = await body.readLine();
    }
    throw new httpErrors.BadRequest("Unexpected end of body reached.");
}
/** Unquotes attribute values that might be pass as part of a header. */
export function unquote(value) {
    if (value.startsWith(`"`)) {
        const parts = value.slice(1).split(`\\"`);
        for (let i = 0; i < parts.length; ++i) {
            const quoteIndex = parts[i].indexOf(`"`);
            if (quoteIndex !== -1) {
                parts[i] = parts[i].slice(0, quoteIndex);
                parts.length = i + 1; // Truncates and stops the loop
            }
            parts[i] = parts[i].replace(/\\(.)/g, "$1");
        }
        value = parts.join(`"`);
    }
    return value;
}
//# sourceMappingURL=file:///mnt/d/Dev/Deno/Example-Deno-Oak-MongoDB-RESTAPI/deno_dir/gen/https/deno.land/x/oak/headers.ts.js.map