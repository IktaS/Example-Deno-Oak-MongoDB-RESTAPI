import { exists, Hash, log, path } from "./deps.ts";
const os = Deno.build.os;
const md5 = new Hash("md5");
const PLUGIN_SUFFIX_MAP = {
    darwin: ".dylib",
    linux: ".so",
    windows: ".dll",
};
const pluginSuffix = PLUGIN_SUFFIX_MAP[os];
export async function download(options) {
    const { name, urls, checkCache = true } = options;
    const remoteUrl = urls[os];
    const remoteHash = md5.digestString(remoteUrl + pluginSuffix).hex();
    const cacheFileName = `${name}_${remoteHash}${pluginSuffix}`;
    const localPath = path.resolve(".deno_plugins", cacheFileName);
    await Deno.mkdir(".deno_plugins", { recursive: true });
    if (!(await exists(localPath)) || !checkCache) {
        if (!remoteUrl) {
            throw Error(`"${name}" plugin does not provide binaries suitable for the current system`);
        }
        if (remoteUrl.startsWith("file://")) {
            const fromPath = path.resolve(remoteUrl.slice(7));
            await copyFromLocal(name, fromPath, localPath);
        }
        else {
            await downloadFromRemote(name, remoteUrl, localPath);
        }
    }
    return localPath;
}
export async function prepare(options) {
    const { name, printLog = true } = options;
    if (printLog) {
        await log.setup({});
    }
    const localPath = await download(options);
    log.info(`load deno plugin "${name}" from local "${localPath}"`);
    return Deno.openPlugin(localPath);
}
async function downloadFromRemote(name, remoteUrl, savePath) {
    log.info(`downloading deno plugin "${name}" from "${remoteUrl}"`);
    const download = await fetch(remoteUrl);
    if (download.status !== 200) {
        throw Error(`downloading plugin "${name}" from "${remoteUrl}" failed.`);
    }
    const pluginFileData = await download.arrayBuffer();
    await Deno.writeFile(savePath, new Uint8Array(pluginFileData));
}
async function copyFromLocal(name, from, to) {
    log.info(`copy deno plugin "${name}" from "${from}"`);
    if (!(await exists(from))) {
        throw Error(`copy plugin "${name}" from "${from}" failed, ${from} does not exist.`);
    }
    await Deno.copyFile(from, to);
}
//# sourceMappingURL=file:///mnt/d/Dev/Deno/Example-Deno-Oak-MongoDB-RESTAPI/deno_dir/gen/https/deno.land/x/plugin_prepare@v0.6.0/mod.ts.js.map