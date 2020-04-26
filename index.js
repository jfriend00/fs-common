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

module.exports = { readDirectory };
