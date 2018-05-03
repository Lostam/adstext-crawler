const axios = require('axios');
const values = require('./setting').value;
if (values.length == 0 || values[0] == "[ADD YOUR TEXT HERE]") {
    throw ("Please insert values to search in setting.js");
}
//todo prevent duplication when writing to file
class Crawler {
    constructor() {
        this.BATCH_SIZE = 400;
    }
    async crawl(domains) {
        let batch;
        while (domains.length > 0) {
            let maxCount = this.BATCH_SIZE < domains.length ? this.BATCH_SIZE : domains.length;
            batch = domains.splice(0, maxCount);
            await this.batchRequest(batch);
        }
        console.log('Finished');
    }
    async batchRequest(domains) {
        // return new Promise((resolve, reject) => {
        let asyncArr = [];
        console.log('Batch Size : ' + domains.length);
        for (let domain of domains) {
            asyncArr.push(Crawler.makeRequest(domain));
        }
        let adsTextArr = await Promise.all(asyncArr);
        let domainArr = [];
        adsTextArr.forEach((domainObj) => {
            if (domainObj !== null) {
                let domain = Object.keys(domainObj)[0];
                let flag = false;
                values.forEach((textToSearch) => {
                    if (domainObj[domain].indexOf(textToSearch) !== -1) {
                        flag = true;
                    }
                });
                if (flag) {
                    domainArr.push(domain);
                }
            }
        });
        writeToFile(domainArr);
        return;
    }
    static async makeRequest(domain) {
        let x;
        try {
            x = await axios.get('http://www.' + domain + '/ads.txt');
        }
        catch (e) {
            console.log("Error: " + domain);
            return null;
        }
        return { [domain]: x.data };
    }
}
const fs = require('fs');
let txt = fs.readFileSync('./domain_list.txt', 'utf8');
let domains = txt.split('\n');
domains = domains.map(domain => {
    return domain.replace('\r', '');
});
// Used like so
domains = shuffle(domains);
let crawler = new Crawler();
crawler.crawl(domains);
/**
 *
 * @param array an array to shuffle
 * @returns {any} shuffles the array and returns it
 */
function shuffle(array) {
    var currentIndex = array.length, temporaryValue, randomIndex;
    // While there remain elements to shuffle...
    while (0 !== currentIndex) {
        // Pick a remaining element...
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;
        // And swap it with the current element.
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }
    return array;
}
/**
 *
 * @param {string} strArr the content
 * @param {string} pathToAppend the file path
 */
function writeToFile(strArr, pathToAppend = "./" + new Date().toDateString() + ".txt") {
    console.log(strArr);
    if (Array.isArray(strArr)) {
        if (strArr.length === 0)
            return;
        // checking if it's windows or unix and based on the result determines which break space to use
        let is_win = process.platform == "win32";
        let break_space = is_win ? "\r\n" : "\n";
        strArr = strArr.join(break_space);
    }
    console.info("Writing to file...");
    fs.appendFile(pathToAppend, strArr, (error) => {
        if (error) {
            console.error(error);
        }
    });
}
//# sourceMappingURL=crawler.js.map