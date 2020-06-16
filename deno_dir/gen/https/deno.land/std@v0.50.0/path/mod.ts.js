// Copyright the Browserify authors. MIT License.
// Ported mostly from https://github.com/browserify/path-browserify/
import * as _win32 from "./win32.ts";
import * as _posix from "./posix.ts";
const isWindows = Deno.build.os == "windows";
const path = isWindows ? _win32 : _posix;
export const win32 = _win32;
export const posix = _posix;
export const { basename, delimiter, dirname, extname, format, fromFileUrl, isAbsolute, join, normalize, parse, relative, resolve, sep, toNamespacedPath, } = path;
export * from "./common.ts";
export { SEP, SEP_PATTERN } from "./separator.ts";
export * from "./interface.ts";
export * from "./glob.ts";
//# sourceMappingURL=file:///mnt/d/Dev/Deno/Example-Deno-Oak-MongoDB-RESTAPI/deno_dir/gen/https/deno.land/std@v0.50.0/path/mod.ts.js.map