import { prepare } from "../deps.ts";
// @ts-ignore
const DenoCore = Deno.core;
const PLUGIN_NAME = "deno_mongo";
let mongoPluginId;
const decoder = new TextDecoder();
const encoder = new TextEncoder();
const pendingCommands = new Map();
let nextCommandId = 0;
export async function init(releaseUrl) {
    const options = {
        name: PLUGIN_NAME,
        urls: {
            darwin: `${releaseUrl}/lib${PLUGIN_NAME}.dylib`,
            windows: `${releaseUrl}/${PLUGIN_NAME}.dll`,
            linux: `${releaseUrl}/lib${PLUGIN_NAME}.so`,
        },
    };
    await prepare(options);
    mongoPluginId = DenoCore.ops()["mongo_command"];
    DenoCore.setAsyncHandler(mongoPluginId, (msg) => {
        const { command_id, data } = JSON.parse(decoder.decode(msg));
        const resolver = pendingCommands.get(command_id);
        resolver && resolver(data);
    });
}
export function encode(str) {
    return encoder.encode(str);
}
export function decode(data) {
    return decoder.decode(data);
}
export function dispatch(command, ...data) {
    const control = encoder.encode(JSON.stringify(command));
    if (!mongoPluginId) {
        throw new Error("The plugin must be initialized before use");
    }
    return DenoCore.dispatch(mongoPluginId, control, ...data);
}
export function dispatchAsync(command, ...data) {
    return new Promise((resolve) => {
        const commandId = nextCommandId++;
        pendingCommands.set(commandId, resolve);
        const control = encoder.encode(JSON.stringify({
            ...command,
            command_id: commandId,
        }));
        if (!mongoPluginId) {
            throw new Error("The plugin must be initialized before use");
        }
        DenoCore.dispatch(mongoPluginId, control, ...data);
    });
}
//# sourceMappingURL=file:///mnt/d/Dev/Deno/Example-Deno-Oak-MongoDB-RESTAPI/deno_dir/gen/https/deno.land/x/mongo@v0.8.0/ts/util.ts.js.map