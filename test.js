const fs = require('fs');
const crypto = require('crypto');

const inputUri = 'F:/Data PFE';
const outputUri = '//EPMA-NAS/data/backups';

console.log('Initializing...');
const startTime = Date.now();

processDir(inputUri).then(async inputDir => {
    const initTime = Date.now();
    console.log(`Found ${inputDir.length} files in "${inputUri}" in ${initTime - startTime}ms`);
    console.log('Creating hash dictionary...');

    const hashToFiles = new Map();
    const fileUriToHash = new Map();
    for (const file of inputDir) {
        try {
            const hash = await hashFile(file);
            fileUriToHash.set(file.uri, hash);
            const sameFiles = hashToFiles.get(hash);
            if (sameFiles) {
                sameFiles.push(file);
                hashToFiles.set(hash, sameFiles)
            } else
                hashToFiles.set(hash, [file]);
        } catch(err) {
            console.warn(err);
        }
    }

    const hashMapInitTime = Date.now();
    console.log(`Created ${hashToFiles.size} hashes of ${fileUriToHash.size} files in ${hashMapInitTime - initTime}ms`);

    try {
        fs.accessSync(outputUri + '/info');
        fs.accessSync(outputUri + '/info/hashToFiles.json', fs.constants.W_OK);
        fs.accessSync(outputUri + '/info/fileUriToHash.json', fs.constants.W_OK);

        fs.writeFileSync(outputUri + '/info/hashToFiles.json', JSON.stringify(Array.from(hashToFiles)));
        fs.writeFileSync(outputUri + '/info/fileUriToHash.json', JSON.stringify(Array.from(fileUriToHash)));
        console.log('All files and hashes written.');
    } catch(err) {
        console.warn(err);
    }
});

function hashFile(file) {
    return new Promise((resolve ,reject) => {
        try {
            const hash = crypto.createHash('sha1');

            hash.on('readable', () => {
                const data = hash.read();
                if (data)
                    resolve(data.toString('hex'));
            });

            fs.readFile(file.uri, (err, data) => {
                if (err)
                    reject(err);
                else
                    hash.write(data);
                hash.end();
            });
        } catch(err) {
            reject(err);
        }
    });
}

function processDir(topUri) {
    return new Promise((resolve, reject) => {
        try {
            fs.readdir(topUri, {withFileTypes: true}, async (err, parentDir) => {
                if (err)
                    reject(err);
                else
                    resolve((await Promise.all(Array.from(parentDir).map(async dir => {
                        try {
                            let files = [];
                            dir.uri = `${topUri}/${dir.name}`;

                            if (dir.isDirectory())
                                files.push(processDir(dir.uri));
                            else if (dir.isFile())
                                files.push(dir);

                            return (await Promise.all(files)).flat();
                        } catch (err) {
                            reject(err);
                        }
                    }))).flat());
            });
        } catch(err) {
            reject(err)
        }
    });
}