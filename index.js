const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

// get full path listing from a directory
// options to filter the listing by type
//    type: "files" | "dirs" | "both"
async function readDirectory(dir, {type = "files"} = {}) {
    console.log(type);
    let files = await fsp.readdir(dir, {withFileTypes: true});
    if (type === "files") {
        files = files.filter(entry => entry.isFile());
    } else if (type === "dirs") {
        files = files.filter(entry => entry.isDirectory());
    }
    return files.map(entry => {
        return path.join(dir, entry.name);
    });
}

// Crawl a directory hierarchy, accumlate a set of results
// as a callback processes each file.
async function walk(dir, callback = null, results = []) {
    const files = await fsp.readdir(dir, {withFileTypes: true});
    const dirs = [];
    for (const file of files) {
        const fullPath = path.join(dir, file.name);
        if (file.isFile()) {
            if (callback) {
                const r = await callback(fullPath);
                if (r !== undefined) {
                    results.push(r);
                }
            } else {
                results.push(fullPath);
            }
        } else if (file.isDirectory()) {
            // save this until we're done with files
            dirs.push(fullPath);
        }
    }
    for (const d of dirs) {
        await walk(d, callback, results);
    }
    return results;
}

// call fsp.open() normally, but add a writeBufferCheck method to the handle that
// automatically checks to see if the proper number of bytes were written to the file
// We do it this way to avoid modify the fileHandle prototype and affecting other users
// of that object
async function open(...args) {
    let handle = await fsp.open(...args);

    handle.writeBufferCheck = async function(...writeArgs) {
        let [buffer, offset, length] = writeArgs;
        if (!Buffer.isBuffer(buffer)) {
            throw new Error("Can only use writeBufferCheck with a Buffer as first argument");
        }
        let result = await this.write(...writeArgs);
        // length is optional
        if (!length) {
            length = buffer.length;
        }
        if (result.bytesWritten !== length) {
            throw new Error(`All bytes not written to file ${writeArgs[0]}./nRequested to write ${length}, actually wrote ${result.bytesWritten}`);
        }
        return result;
    }

    handle.closeLog = function(logFn = console.log.bind(console)) {
        return this.close().catch(err => {
            logFn(err);
            // eat the error, do not propagate it (that is the point of this function)
        });
    }

    return handle;
}

function unlinkIgnore(path) {
    return fsp.unlink(path).catch(err => {
        // intentionally eat the error
    });
}

module.exports = { fsc: {readDirectory, walk, open, unlinkIgnore}, fs, fsp, path };
