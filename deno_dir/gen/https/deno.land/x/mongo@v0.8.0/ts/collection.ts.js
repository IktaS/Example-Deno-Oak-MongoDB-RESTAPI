import { CommandType } from "./types.ts";
import { convert, parse } from "./type_convert.ts";
import { dispatchAsync, encode } from "./util.ts";
export class Collection {
    constructor(client, dbName, collectionName) {
        this.client = client;
        this.dbName = dbName;
        this.collectionName = collectionName;
    }
    async _find(filter, options) {
        const doc = await dispatchAsync({
            command_type: CommandType.Find,
            client_id: this.client.clientId,
        }, encode(JSON.stringify({
            dbName: this.dbName,
            collectionName: this.collectionName,
            filter,
            ...options,
        })));
        return doc;
    }
    async count(filter) {
        const count = await dispatchAsync({
            command_type: CommandType.Count,
            client_id: this.client.clientId,
        }, encode(JSON.stringify({
            dbName: this.dbName,
            collectionName: this.collectionName,
            filter,
        })));
        return count;
    }
    async findOne(filter) {
        return parse(await this._find(filter, { findOne: true }));
    }
    async find(filter, options) {
        return parse(await this._find(filter, { findOne: false, ...options }));
    }
    async insertOne(doc) {
        const _id = await dispatchAsync({
            command_type: CommandType.InsertOne,
            client_id: this.client.clientId,
        }, encode(JSON.stringify({
            dbName: this.dbName,
            collectionName: this.collectionName,
            doc: convert(doc),
        })));
        return _id;
    }
    async insertMany(docs) {
        const _ids = await dispatchAsync({
            command_type: CommandType.InsertMany,
            client_id: this.client.clientId,
        }, encode(JSON.stringify({
            dbName: this.dbName,
            collectionName: this.collectionName,
            docs: convert(docs),
        })));
        return _ids;
    }
    async _delete(query, deleteOne = false) {
        const deleteCount = await dispatchAsync({
            command_type: CommandType.Delete,
            client_id: this.client.clientId,
        }, encode(JSON.stringify({
            dbName: this.dbName,
            collectionName: this.collectionName,
            query,
            deleteOne,
        })));
        return deleteCount;
    }
    deleteOne(query) {
        return this._delete(query, true);
    }
    deleteMany(query) {
        return this._delete(query, false);
    }
    async _update(query, update, updateOne = false) {
        const result = await dispatchAsync({
            command_type: CommandType.Update,
            client_id: this.client.clientId,
        }, encode(JSON.stringify({
            dbName: this.dbName,
            collectionName: this.collectionName,
            query: convert(query),
            update: convert(update),
            updateOne,
        })));
        return result;
    }
    updateOne(query, update) {
        return this._update(query, update, true);
    }
    updateMany(query, update) {
        return this._update(query, update, false);
    }
    async aggregate(pipeline) {
        const docs = await dispatchAsync({
            command_type: CommandType.Aggregate,
            client_id: this.client.clientId,
        }, encode(JSON.stringify({
            dbName: this.dbName,
            collectionName: this.collectionName,
            pipeline,
        })));
        return parse(docs);
    }
    async createIndexes(models) {
        const docs = await dispatchAsync({
            command_type: CommandType.CreateIndexes,
            client_id: this.client.clientId,
        }, encode(JSON.stringify({
            dbName: this.dbName,
            collectionName: this.collectionName,
            models,
        })));
        return docs;
    }
}
//# sourceMappingURL=file:///mnt/d/Dev/Deno/Example-Deno-Oak-MongoDB-RESTAPI/deno_dir/gen/https/deno.land/x/mongo@v0.8.0/ts/collection.ts.js.map