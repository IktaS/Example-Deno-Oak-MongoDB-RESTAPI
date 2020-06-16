import { Collection } from "./collection.ts";
import { CommandType } from "./types.ts";
import { dispatchAsync, encode } from "./util.ts";
export class Database {
    constructor(client, name) {
        this.client = client;
        this.name = name;
    }
    async listCollectionNames() {
        const names = await dispatchAsync({
            command_type: CommandType.ListCollectionNames,
            client_id: this.client.clientId,
        }, encode(this.name));
        return names;
    }
    collection(name) {
        return new Collection(this.client, this.name, name);
    }
}
//# sourceMappingURL=file:///mnt/d/Dev/Deno/Example-Deno-Oak-MongoDB-RESTAPI/deno_dir/gen/https/deno.land/x/mongo@v0.8.0/ts/database.ts.js.map