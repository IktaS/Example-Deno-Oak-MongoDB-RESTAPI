// Copyright 2018-2020 the Deno authors. All rights reserved. MIT license.
const { lstat, lstatSync } = Deno;
/**
 * Test whether or not the given path exists by checking with the file system
 */
export async function exists(filePath) {
    try {
        await lstat(filePath);
        return true;
    }
    catch (err) {
        if (err instanceof Deno.errors.NotFound) {
            return false;
        }
        throw err;
    }
}
/**
 * Test whether or not the given path exists by checking with the file system
 */
export function existsSync(filePath) {
    try {
        lstatSync(filePath);
        return true;
    }
    catch (err) {
        if (err instanceof Deno.errors.NotFound) {
            return false;
        }
        throw err;
    }
}
//# sourceMappingURL=file:///mnt/d/Dev/Deno/Example-Deno-Oak-MongoDB-RESTAPI/deno_dir/gen/https/deno.land/std@v0.50.0/fs/exists.ts.js.map