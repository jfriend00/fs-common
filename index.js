const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const listDirectory = require('./fslist.js');

// Promise version of readble.pipe(writable)
// that has error reporting on the readstream
// and on the writestream
// readable.pipe(writeable) does not monitor errors on the readstream
//
// options:
//     resolveOn: "finish", "unpipe", "close"   (default is close)
// The options object is also passed through to .pipe()
//
function pipe(readStream, writeStream, opts = {}) {
    let options = Object.assign({resolveOn: "close"}, opts);
    let resolveEvent = options.resolveOn;
    delete options.resolveOn;
    return new Promise((resolve, reject) => {
        function errorHandler(err) {
            cleanup();
            reject(err);
        }

        function doneHandler() {
            cleanup();
            resolve();
        }

        function cleanup() {
            readStream.off('error', errorHandler);
            writeStream.off('error', errorHandler);
            writeStream.off(resolveEvent, doneHandler);
        }

        // register our event handlers
        readStream.once('error', errorHandler);
        writeStream.once('error', errorHandler);
        writeStream.once(resolveEvent, doneHandler);

        // start the pipe operation
        readStream.pipe(writeStream, options);
    });
}

/*
// get full path listing from a directory
// options to filter the listing by type
//    type: "files" | "dirs" | "both"
async function listDirectory(dir, {type = "files"} = {}) {
    console.log(type);
    let files = await fsp.readdir(dir, {withFileTypes: true});
    if (type === "files") {
        files = files.filter(entry => entry.isFile());
    } else if (type === "dirs") {
        files = files.filter(entry => entry.isDirectory());
    }
    return files.map(entry => {
        return path.resolve(path.join(dir, entry.name));
    });
}
*/

// Crawl a directory hierarchy, accumlate a set of results
// as a callback processes each file.
async function walk(dir, callback = null, results = []) {
    const files = await fsp.readdir(dir, {withFileTypes: true});
    const dirs = [];
    for (const file of files) {
        const fullPath = path.join(dir, file.name);
        if (file.isFile()) {
            if (callback) {
                const r = await callback(fullPath, file.name);
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

// calls fsp.open() normally, but adds several methods to the flieHandle
//
//    writeBufferCheck() method to the handle that automatically checks to see
//                       if the proper number of bytes were written to the file
//                       and throws if the desired number of bytes were not written
//
//    closeIgnore()      method to close the file, catch and eat errors
//                       For use when you don't want to log or fail the whole
//                       promise chain when there's an error closing the file as
//                       there's nothing to do about it anyway
//    closeIgnoreLog()   same as closeIgnore, but will log the error.
//                       default logger is console.log, but you can pass a logging
//                       function if you want.
// We do it this way to avoid modifying the fileHandle prototype and affecting other users
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
            throw new Error(`All bytes not written to file ${args[0]}./nRequested to write ${length}, actually wrote ${result.bytesWritten}`);
        }
        return result;
    }

    handle.closeIgnore = function() {
        return this.close().catch(err => {
            // silent about the error
        });
    }

    handle.closeIgnoreLog = function(logFn = console.log.bind(console)) {
        return this.close().catch(err => {
            logFn(err);
            // eat the error, do not propagate it (that is the point of this function)
        });
    }

    return handle;
}

// calls fsp.unlink() and ignores errors
function unlinkIgnore(path) {
    return fsp.unlink(path).catch(err => {
        // intentionally eat the error
    });
}

// this is meant to be used like this:
// const {fs, fsp, fsc, path} = require('fs-common');
// where this module's methods are on the fsc object
module.exports = { fsc: {
    listDirectory,
    walk,
    open,
    unlinkIgnore,
    pipe,
}, fs, fsp, path };
