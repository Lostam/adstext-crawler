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
    // checking if it's windows or unix and based on the result determines which break space to use
    let is_win = get_is_windows();
    let break_space = is_win ? "\r\n" : "\n";
    if (Array.isArray(strArr)) {
        if (strArr.length === 0)
            return;
        //todo add a string check
        let exisitingDomains = getFoundDomains(pathToAppend, break_space);
        strArr = exisitingDomains ? array1_minus_array2(strArr, exisitingDomains) : strArr;
        strArr = strArr.join(break_space);
    }
    console.info("Writing to file...");
    fs.appendFile(pathToAppend, strArr, (error) => {
        if (error) {
            console.error(error);
        }
    });
}
/**
 *
 * @param {string} file_path
 * @param {string} break_space which break space the use (e.g \n or \r\n)
 * @returns {any} the list of domains from the existing file, if dose'nt exist returns null;
 */
function getFoundDomains(file_path, break_space) {
    try {
        return fs.readFileSync(file_path, "utf8").split(break_space);
    }
    catch (err) {
        return null;
    }
}
/**
 *
 * @param arr1 a string array
 * @param arr2 a string array
 * @returns {string[]} all the items in arr1 minus the items in arr2
 */
function array1_minus_array2(arr1, arr2) {
    return arr1.filter((item) => {
        return arr2.indexOf(item) === -1;
    });
}
/**
 *
 * @returns {boolean} true if the operating system is windows and false otherwise
 */
function get_is_windows() {
    return process.platform == "win32";
}
//# sourceMappingURL=crawler.js.map