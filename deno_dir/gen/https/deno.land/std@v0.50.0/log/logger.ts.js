// Copyright 2018-2020 the Deno authors. All rights reserved. MIT license.
import { LogLevels, getLevelByName, getLevelName, } from "./levels.ts";
export class LogRecord {
    constructor(msg, args, level) {
        this.msg = msg;
        this.#args = [...args];
        this.level = level;
        this.#datetime = new Date();
        this.levelName = getLevelName(level);
    }
    #args;
    #datetime;
    get args() {
        return [...this.#args];
    }
    get datetime() {
        return new Date(this.#datetime.getTime());
    }
}
export class Logger {
    constructor(levelName, handlers) {
        this.level = getLevelByName(levelName);
        this.levelName = levelName;
        this.handlers = handlers || [];
    }
    _log(level, msg, ...args) {
        if (this.level > level)
            return;
        const record = new LogRecord(msg, args, level);
        this.handlers.forEach((handler) => {
            handler.handle(record);
        });
    }
    debug(msg, ...args) {
        this._log(LogLevels.DEBUG, msg, ...args);
    }
    info(msg, ...args) {
        this._log(LogLevels.INFO, msg, ...args);
    }
    warning(msg, ...args) {
        this._log(LogLevels.WARNING, msg, ...args);
    }
    error(msg, ...args) {
        this._log(LogLevels.ERROR, msg, ...args);
    }
    critical(msg, ...args) {
        this._log(LogLevels.CRITICAL, msg, ...args);
    }
}
//# sourceMappingURL=file:///mnt/d/Dev/Deno/Example-Deno-Oak-MongoDB-RESTAPI/deno_dir/gen/https/deno.land/std@v0.50.0/log/logger.ts.js.map