export var CommandType;
(function (CommandType) {
    CommandType["ConnectWithUri"] = "ConnectWithUri";
    CommandType["ConnectWithOptions"] = "ConnectWithOptions";
    CommandType["ListDatabases"] = "ListDatabases";
    CommandType["ListCollectionNames"] = "ListCollectionNames";
    CommandType["Find"] = "Find";
    CommandType["InsertOne"] = "InsertOne";
    CommandType["InsertMany"] = "InsertMany";
    CommandType["Delete"] = "Delete";
    CommandType["Update"] = "Update";
    CommandType["Aggregate"] = "Aggregate";
    CommandType["Count"] = "Count";
    CommandType["CreateIndexes"] = "CreateIndexes";
})(CommandType || (CommandType = {}));
export function ObjectId($oid) {
    const isLegal = /^[0-9a-fA-F]{24}$/.test($oid);
    if (!isLegal) {
        throw new Error(`ObjectId("${$oid}") is not legal.`);
    }
    return { $oid };
}
//# sourceMappingURL=file:///mnt/d/Dev/Deno/Example-Deno-Oak-MongoDB-RESTAPI/deno_dir/gen/https/deno.land/x/mongo@v0.8.0/ts/types.ts.js.map