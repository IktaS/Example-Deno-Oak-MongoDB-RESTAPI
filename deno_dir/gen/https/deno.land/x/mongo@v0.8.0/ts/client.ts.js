import { Database } from "./database.ts";
import { CommandType } from "./types.ts";
import { decode, dispatch, dispatchAsync, encode } from "./util.ts";
export class MongoClient {
    constructor() {
        this._clientId = 0;
    }
    get clientId() {
        return this._clientId;
    }
    connectWithUri(uri) {
        const data = dispatch({ command_type: CommandType.ConnectWithUri }, encode(uri));
        this._clientId = parseInt(decode(data));
    }
    connectWithOptions(options) {
        const data = dispatch({ command_type: CommandType.ConnectWithOptions }, encode(JSON.stringify(options)));
        this._clientId = parseInt(decode(data));
    }
    async listDatabases() {
        return (await dispatchAsync({
            command_type: CommandType.ListDatabases,
            client_id: this._clientId,
        }));
    }
    database(name) {
        return new Database(this, name);
    }
}
//# sourceMappingURL=file:///mnt/d/Dev/Deno/Example-Deno-Oak-MongoDB-RESTAPI/deno_dir/gen/https/deno.land/x/mongo@v0.8.0/ts/client.ts.js.map