// Copyright 2018-2020 the Deno authors. All rights reserved. MIT license.
const { open, openSync, close, renameSync, statSync } = Deno;
import { getLevelByName, LogLevels } from "./levels.ts";
import { red, yellow, blue, bold } from "../fmt/colors.ts";
import { existsSync, exists } from "../fs/exists.ts";
const DEFAULT_FORMATTER = "{levelName} {msg}";
export class BaseHandler {
    constructor(levelName, options = {}) {
        this.level = getLevelByName(levelName);
        this.levelName = levelName;
        this.formatter = options.formatter || DEFAULT_FORMATTER;
    }
    handle(logRecord) {
        if (this.level > logRecord.level)
            return;
        const msg = this.format(logRecord);
        return this.log(msg);
    }
    format(logRecord) {
        if (this.formatter instanceof Function) {
            return this.formatter(logRecord);
        }
        return this.formatter.replace(/{(\S+)}/g, (match, p1) => {
            const value = logRecord[p1];
            // do not interpolate missing values
            if (!value) {
                return match;
            }
            return String(value);
        });
    }
    log(_msg) { }
    async setup() { }
    async destroy() { }
}
export class ConsoleHandler extends BaseHandler {
    format(logRecord) {
        let msg = super.format(logRecord);
        switch (logRecord.level) {
            case LogLevels.INFO:
                msg = blue(msg);
                break;
            case LogLevels.WARNING:
                msg = yellow(msg);
                break;
            case LogLevels.ERROR:
                msg = red(msg);
                break;
            case LogLevels.CRITICAL:
                msg = bold(red(msg));
                break;
            default:
                break;
        }
        return msg;
    }
    log(msg) {
        console.log(msg);
    }
}
export class WriterHandler extends BaseHandler {
    constructor() {
        super(...arguments);
        this.#encoder = new TextEncoder();
    }
    #encoder;
}
export class FileHandler extends WriterHandler {
    constructor(levelName, options) {
        super(levelName, options);
        this.#encoder = new TextEncoder();
        this._filename = options.filename;
        // default to append mode, write only
        this._mode = options.mode ? options.mode : "a";
        this._openOptions = {
            createNew: this._mode === "x",
            create: this._mode !== "x",
            append: this._mode === "a",
            truncate: this._mode !== "a",
            write: true,
        };
    }
    #encoder;
    async setup() {
        this._file = await open(this._filename, this._openOptions);
        this._writer = this._file;
    }
    log(msg) {
        Deno.writeSync(this._file.rid, this.#encoder.encode(msg + "\n"));
    }
    destroy() {
        this._file.close();
        return Promise.resolve();
    }
}
export class RotatingFileHandler extends FileHandler {
    constructor(levelName, options) {
        super(levelName, options);
        this.#maxBytes = options.maxBytes;
        this.#maxBackupCount = options.maxBackupCount;
    }
    #maxBytes;
    #maxBackupCount;
    async setup() {
        if (this.#maxBytes < 1) {
            throw new Error("maxBytes cannot be less than 1");
        }
        if (this.#maxBackupCount < 1) {
            throw new Error("maxBackupCount cannot be less than 1");
        }
        await super.setup();
        if (this._mode === "w") {
            // Remove old backups too as it doesn't make sense to start with a clean
            // log file, but old backups
            for (let i = 1; i <= this.#maxBackupCount; i++) {
                if (await exists(this._filename + "." + i)) {
                    await Deno.remove(this._filename + "." + i);
                }
            }
        }
        else if (this._mode === "x") {
            // Throw if any backups also exist
            for (let i = 1; i <= this.#maxBackupCount; i++) {
                if (await exists(this._filename + "." + i)) {
                    Deno.close(this._file.rid);
                    throw new Deno.errors.AlreadyExists("Backup log file " + this._filename + "." + i + " already exists");
                }
            }
        }
    }
    handle(logRecord) {
        if (this.level > logRecord.level)
            return;
        const msg = this.format(logRecord);
        const currentFileSize = statSync(this._filename).size;
        if (currentFileSize + msg.length > this.#maxBytes) {
            this.rotateLogFiles();
        }
        return this.log(msg);
    }
    rotateLogFiles() {
        close(this._file.rid);
        for (let i = this.#maxBackupCount - 1; i >= 0; i--) {
            const source = this._filename + (i === 0 ? "" : "." + i);
            const dest = this._filename + "." + (i + 1);
            if (existsSync(source)) {
                renameSync(source, dest);
            }
        }
        this._file = openSync(this._filename, this._openOptions);
        this._writer = this._file;
    }
}
//# sourceMappingURL=file:///mnt/d/Dev/Deno/Example-Deno-Oak-MongoDB-RESTAPI/deno_dir/gen/https/deno.land/std@v0.50.0/log/handlers.ts.js.map