export function convert(data) {
    if (data instanceof Array) {
        return data.map((item) => convert(item));
    }
    if (data instanceof Date) {
        return { $date: { $numberLong: data.getTime() } };
    }
    if (data instanceof Object) {
        Object.keys(data).forEach((key) => {
            data[key] = convert(data[key]);
        });
        return data;
    }
    return data;
}
export function parse(data) {
    if (data instanceof Array) {
        return data.map((item) => parse(item));
    }
    if (data && typeof data === "object") {
        if (data.$date && data.$date.$numberLong) {
            return new Date(data.$date.$numberLong);
        }
        Object.keys(data).forEach((key) => {
            data[key] = parse(data[key]);
        });
        return data;
    }
    return data;
}
//# sourceMappingURL=file:///mnt/d/Dev/Deno/Example-Deno-Oak-MongoDB-RESTAPI/deno_dir/gen/https/deno.land/x/mongo@v0.8.0/ts/type_convert.ts.js.map