/**
 * Adapted directly from @koa/router at
 * https://github.com/koajs/router/ which is licensed as:
 *
 * The MIT License (MIT)
 *
 * Copyright (c) 2015 Alexander C. Mingoia
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
import { assert, compile, pathParse, pathToRegexp, Status, } from "./deps.ts";
import { httpErrors } from "./httpError.ts";
import { compose } from "./middleware.ts";
import { decodeComponent } from "./util.ts";
/** Generate a URL from a string, potentially replace route params with
 * values. */
function toUrl(url, params = {}, options) {
    const tokens = pathParse(url);
    let replace = {};
    if (tokens.some((token) => typeof token === "object")) {
        replace = params;
    }
    else {
        options = params;
    }
    const toPath = compile(url, options);
    let replaced = toPath(replace);
    if (options && options.query) {
        const url = new URL(replaced, "http://oak");
        if (typeof options.query === "string") {
            url.search = options.query;
        }
        else {
            url.search = String(options.query instanceof URLSearchParams
                ? options.query
                : new URLSearchParams(options.query));
        }
        return `${url.pathname}${url.search}${url.hash}`;
    }
    return replaced;
}
class Layer {
    constructor(path, methods, middleware, { name, ...opts } = {}) {
        this.#paramNames = [];
        this.#opts = opts;
        this.name = name;
        this.methods = [...methods];
        if (this.methods.includes("GET")) {
            this.methods.unshift("HEAD");
        }
        this.stack = Array.isArray(middleware) ? middleware : [middleware];
        this.path = path;
        this.#regexp = pathToRegexp(path, this.#paramNames, this.#opts);
    }
    #opts;
    #paramNames;
    #regexp;
    match(path) {
        return this.#regexp.test(path);
    }
    params(captures, existingParams = {}) {
        const params = existingParams;
        for (let i = 0; i < captures.length; i++) {
            if (this.#paramNames[i]) {
                const c = captures[i];
                params[this.#paramNames[i].name] = c ? decodeComponent(c) : c;
            }
        }
        return params;
    }
    captures(path) {
        if (this.#opts.ignoreCaptures) {
            return [];
        }
        return path.match(this.#regexp)?.slice(1) ?? [];
    }
    url(params = {}, options) {
        const url = this.path.replace(/\(\.\*\)/g, "");
        return toUrl(url, params, options);
    }
    param(param, fn) {
        const stack = this.stack;
        const params = this.#paramNames;
        const middleware = function (ctx, next) {
            const p = ctx.params[param];
            assert(p);
            return fn.call(this, p, ctx, next);
        };
        middleware.param = param;
        const names = params.map((p) => p.name);
        const x = names.indexOf(param);
        if (x >= 0) {
            for (let i = 0; i < stack.length; i++) {
                const fn = stack[i];
                if (!fn.param || names.indexOf(fn.param) > x) {
                    stack.splice(i, 0, middleware);
                    break;
                }
            }
        }
        return this;
    }
    setPrefix(prefix) {
        if (this.path) {
            this.path = this.path !== "/" || this.#opts.strict === true
                ? `${prefix}${this.path}`
                : prefix;
            this.#paramNames = [];
            this.#regexp = pathToRegexp(this.path, this.#paramNames, this.#opts);
        }
        return this;
    }
    toJSON() {
        return {
            methods: [...this.methods],
            middleware: [...this.stack],
            paramNames: this.#paramNames.map((key) => key.name),
            path: this.path,
            regexp: this.#regexp,
            options: { ...this.#opts },
        };
    }
}
/** An interface for registering middleware that will run when certain HTTP
 * methods and paths are requested, as well as provides a way to parameterize
 * parts of the requested path. */
export class Router {
    constructor(opts = {}) {
        this.#params = {};
        this.#stack = [];
        this.#match = (path, method) => {
            const matches = {
                path: [],
                pathAndMethod: [],
                route: false,
            };
            for (const route of this.#stack) {
                if (route.match(path)) {
                    matches.path.push(route);
                    if (route.methods.length === 0 || route.methods.includes(method)) {
                        matches.pathAndMethod.push(route);
                        if (route.methods.length) {
                            matches.route = true;
                        }
                    }
                }
            }
            return matches;
        };
        this.#register = (path, middleware, methods, options = {}) => {
            if (Array.isArray(path)) {
                for (const p of path) {
                    this.#register(p, middleware, methods, options);
                }
                return;
            }
            const { end, name, sensitive, strict, ignoreCaptures } = options;
            const route = new Layer(path, methods, middleware, {
                end: end === false ? end : true,
                name,
                sensitive: sensitive ?? this.#opts.sensitive ?? false,
                strict: strict ?? this.#opts.strict ?? false,
                ignoreCaptures,
            });
            if (this.#opts.prefix) {
                route.setPrefix(this.#opts.prefix);
            }
            for (const [param, mw] of Object.entries(this.#params)) {
                route.param(param, mw);
            }
            this.#stack.push(route);
        };
        this.#route = (name) => {
            for (const route of this.#stack) {
                if (route.name === name) {
                    return route;
                }
            }
        };
        this.#useVerb = (nameOrPath, pathOrMiddleware, middleware, methods) => {
            let name = undefined;
            let path;
            if (typeof pathOrMiddleware === "string") {
                name = nameOrPath;
                path = pathOrMiddleware;
            }
            else {
                path = nameOrPath;
                middleware.unshift(pathOrMiddleware);
            }
            this.#register(path, middleware, methods, { name });
        };
        this.#opts = opts;
        this.#methods = opts.methods ?? [
            "DELETE",
            "GET",
            "HEAD",
            "OPTIONS",
            "PATCH",
            "POST",
            "PUT",
        ];
    }
    #opts;
    #methods;
    #params;
    #stack;
    #match;
    #register;
    #route;
    #useVerb;
    all(nameOrPath, pathOrMiddleware, ...middleware) {
        this.#useVerb(nameOrPath, pathOrMiddleware, middleware, ["DELETE", "GET", "POST", "PUT"]);
        return this;
    }
    /** Middleware that handles requests for HTTP methods registered with the
     * router.  If none of the routes handle a method, then "not allowed" logic
     * will be used.  If a method is supported by some routes, but not the
     * particular matched router, then "not implemented" will be returned.
     *
     * The middleware will also automatically handle the `OPTIONS` method,
     * responding with a `200 OK` when the `Allowed` header sent to the allowed
     * methods for a given route.
     *
     * By default, a "not allowed" request will respond with a `405 Not Allowed`
     * and a "not implemented" will respond with a `501 Not Implemented`. Setting
     * the option `.throw` to `true` will cause the middleware to throw an
     * `HTTPError` instead of setting the response status.  The error can be
     * overridden by providing a `.notImplemented` or `.notAllowed` method in the
     * options, of which the value will be returned will be thrown instead of the
     * HTTP error. */
    allowedMethods(options = {}) {
        const implemented = this.#methods;
        const allowedMethods = async (context, next) => {
            const ctx = context;
            await next();
            if (!ctx.response.status || ctx.response.status === Status.NotFound) {
                assert(ctx.matched);
                const allowed = new Set();
                for (const route of ctx.matched) {
                    for (const method of route.methods) {
                        allowed.add(method);
                    }
                }
                const allowedStr = [...allowed].join(", ");
                if (!implemented.includes(ctx.request.method)) {
                    if (options.throw) {
                        throw options.notImplemented
                            ? options.notImplemented()
                            : new httpErrors.NotImplemented();
                    }
                    else {
                        ctx.response.status = Status.NotImplemented;
                        ctx.response.headers.set("Allowed", allowedStr);
                    }
                }
                else if (allowed.size) {
                    if (ctx.request.method === "OPTIONS") {
                        ctx.response.status = Status.OK;
                        ctx.response.headers.set("Allowed", allowedStr);
                    }
                    else if (!allowed.has(ctx.request.method)) {
                        if (options.throw) {
                            throw options.methodNotAllowed
                                ? options.methodNotAllowed()
                                : new httpErrors.MethodNotAllowed();
                        }
                        else {
                            ctx.response.status = Status.MethodNotAllowed;
                            ctx.response.headers.set("Allowed", allowedStr);
                        }
                    }
                }
            }
        };
        return allowedMethods;
    }
    delete(nameOrPath, pathOrMiddleware, ...middleware) {
        this.#useVerb(nameOrPath, pathOrMiddleware, middleware, ["DELETE"]);
        return this;
    }
    /** Iterate over the routes currently added to the router.  To be compatible
     * with the iterable interfaces, both the key and value are set to the value
     * of the route. */
    *entries() {
        for (const route of this.#stack) {
            const value = route.toJSON();
            yield [value, value];
        }
    }
    /** Iterate over the routes currently added to the router, calling the
     * `callback` function for each value. */
    forEach(callback, thisArg = null) {
        for (const route of this.#stack) {
            const value = route.toJSON();
            callback.call(thisArg, value, value, this);
        }
    }
    get(nameOrPath, pathOrMiddleware, ...middleware) {
        this.#useVerb(nameOrPath, pathOrMiddleware, middleware, ["GET"]);
        return this;
    }
    head(nameOrPath, pathOrMiddleware, ...middleware) {
        this.#useVerb(nameOrPath, pathOrMiddleware, middleware, ["HEAD"]);
        return this;
    }
    /** Iterate over the routes currently added to the router.  To be compatible
     * with the iterable interfaces, the key is set to the value of the route. */
    *keys() {
        for (const route of this.#stack) {
            yield route.toJSON();
        }
    }
    options(nameOrPath, pathOrMiddleware, ...middleware) {
        this.#useVerb(nameOrPath, pathOrMiddleware, middleware, ["OPTIONS"]);
        return this;
    }
    /** Register param middleware, which will be called when the particular param
     * is parsed from the route. */
    param(param, middleware) {
        this.#params[param] = middleware;
        for (const route of this.#stack) {
            route.param(param, middleware);
        }
        return this;
    }
    patch(nameOrPath, pathOrMiddleware, ...middleware) {
        this.#useVerb(nameOrPath, pathOrMiddleware, middleware, ["PATCH"]);
        return this;
    }
    post(nameOrPath, pathOrMiddleware, ...middleware) {
        this.#useVerb(nameOrPath, pathOrMiddleware, middleware, ["POST"]);
        return this;
    }
    /** Set the router prefix for this router. */
    prefix(prefix) {
        prefix = prefix.replace(/\/$/, "");
        this.#opts.prefix = prefix;
        for (const route of this.#stack) {
            route.setPrefix(prefix);
        }
        return this;
    }
    put(nameOrPath, pathOrMiddleware, ...middleware) {
        this.#useVerb(nameOrPath, pathOrMiddleware, middleware, ["PUT"]);
        return this;
    }
    /** Register a direction middleware, where when the `source` path is matched
     * the router will redirect the request to the `destination` path.  A `status`
     * of `302 Found` will be set by default.
     *
     * The `source` and `destination` can be named routes. */
    redirect(source, destination, status = Status.Found) {
        if (source[0] !== "/") {
            const s = this.url(source);
            if (!s) {
                throw new RangeError(`Could not resolve named route: "${source}"`);
            }
            source = s;
        }
        if (destination[0] !== "/") {
            const d = this.url(destination);
            if (!d) {
                throw new RangeError(`Could not resolve named route: "${source}"`);
            }
            destination = d;
        }
        this.all(source, (ctx) => {
            ctx.response.redirect(destination);
            ctx.response.status = status;
        });
        return this;
    }
    /** Return middleware that will do all the route processing that the router
     * has been configured to handle.  Typical usage would be something like this:
     *
     * ```ts
     * import { Application, Router } from "https://deno.land/x/oak/mod.ts";
     *
     * const app = new Application();
     * const router = new Router();
     *
     * // register routes
     *
     * app.use(router.routes());
     * app.use(router.allowedMethods());
     * await app.listen({ port: 80 });
     * ```
     */
    routes() {
        const dispatch = (context, next) => {
            const ctx = context;
            const { url: { pathname }, method } = ctx.request;
            const path = this.#opts.routerPath ?? ctx.routerPath ?? pathname;
            const matches = this.#match(path, method);
            if (ctx.matched) {
                ctx.matched.push(...matches.path);
            }
            else {
                ctx.matched = [...matches.path];
            }
            ctx.router = this;
            if (!matches.route)
                return next();
            const { pathAndMethod: matchedRoutes } = matches;
            const chain = matchedRoutes.reduce((prev, route) => [
                ...prev,
                (ctx, next) => {
                    ctx.captures = route.captures(path);
                    ctx.params = route.params(ctx.captures, ctx.params);
                    ctx.routeName = route.name;
                    return next();
                },
                ...route.stack,
            ], []);
            return compose(chain)(ctx, next);
        };
        dispatch.router = this;
        return dispatch;
    }
    /** Generate a URL pathname for a named route, interpolating the optional
     * params provided.  Also accepts an optional set of options. */
    url(name, params, options) {
        const route = this.#route(name);
        if (route) {
            return route.url(params, options);
        }
    }
    use(pathOrMiddleware, ...middleware) {
        let path;
        if (typeof pathOrMiddleware === "string" || Array.isArray(pathOrMiddleware)) {
            path = pathOrMiddleware;
        }
        else {
            middleware.unshift(pathOrMiddleware);
        }
        this.#register(path ?? "(.*)", middleware, [], { end: false, ignoreCaptures: !path });
        return this;
    }
    /** Iterate over the routes currently added to the router. */
    *values() {
        for (const route of this.#stack) {
            yield route.toJSON();
        }
    }
    /** Provide an iterator interface that iterates over the routes registered
     * with the router. */
    *[Symbol.iterator]() {
        for (const route of this.#stack) {
            yield route.toJSON();
        }
    }
    /** Generate a URL pathname based on the provided path, interpolating the
     * optional params provided.  Also accepts an optional set of options. */
    static url(path, params, options) {
        return toUrl(path, params, options);
    }
}
//# sourceMappingURL=file:///mnt/d/Dev/Deno/Example-Deno-Oak-MongoDB-RESTAPI/deno_dir/gen/https/deno.land/x/oak/router.ts.js.map