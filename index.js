const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

// get full path listing from a directory
// options to filter the listing by type
//    type: "files" | "dirs" | "both"
async function readDirectory(dir, options = {type = "files"}) {
    let files = await fsp.readdir({withFileTypes: true});
    if (options.type === "files") {
        files = files.filter(entry => entry.isFile());
    } else if (options.type === "dirs") {
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

module.exports = { readDirectory, walk };
