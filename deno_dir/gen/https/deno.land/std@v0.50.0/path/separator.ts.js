// Copyright 2018-2020 the Deno authors. All rights reserved. MIT license.
const isWindows = Deno.build.os == "windows";
export const SEP = isWindows ? "\\" : "/";
export const SEP_PATTERN = isWindows ? /[\\/]+/ : /\/+/;
//# sourceMappingURL=file:///mnt/d/Dev/Deno/Example-Deno-Oak-MongoDB-RESTAPI/deno_dir/gen/https/deno.land/std@v0.50.0/path/separator.ts.js.map