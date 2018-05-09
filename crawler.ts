const axios = require('axios');
const values = require('./setting').value;
const memwatch = require('memwatch-next');

const fs = require('fs');


if (values.length == 0 || values[0] == "[ADD YOUR TEXT HERE]") {
    throw ("Please insert values to search in setting.js")
}

setTimeout(() => {
    process.exit(1);
}, 1000 * 60 * 10);
memwatch.on('leak', (info) => {
    console.error('Memory leak detected:\n', info);
    process.exit(1);
});

//todo prevent duplication when writing to file
class Crawler {
    private BATCH_SIZE: number = 400;
    private DOMAINS_FILE_NAME: string = './domain_list.txt';
    static BREAK_SPACE = Crawler.get_is_windows() ? "\r\n" : "\n";

    async crawl(domains: string[]) {
        let batch;
        while (domains.length > 0) {
            let maxCount = this.BATCH_SIZE < domains.length ? this.BATCH_SIZE : domains.length;
            batch = domains.splice(0, maxCount);
            await this.batchRequest(batch);
        }
        console.log('Finished');
    }

    async batchRequest(domains: string[]) {
        // return new Promise((resolve, reject) => {
        let asyncArr: Promise<any>[] = [];
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
                    if (typeof domainObj[domain] === 'string') {
                        if (domainObj[domain].indexOf(textToSearch) !== -1) {
                            flag = true;
                        }
                    }
                });
                if (flag) {
                    domainArr.push(domain);
                }
            }
        });
        this.removeQueriedDomains(domains);
        this.writeToFile(domainArr);
        return;
    }

    static async makeRequest(domain: string): Promise<any> {
        let x;
        try {
            x = await axios.get('http://www.' + domain + '/ads.txt')
        }
        catch (e) {
            // console.log("Error: " + domain);
            return null;
        }
        return {[domain]: x.data};

    }

    /**
     *
     * @param array an array to shuffle
     * @returns {any} shuffles the array and returns it
     */
    static shuffle(array) {
        let currentIndex = array.length, temporaryValue, randomIndex;

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
    writeToFile(strArr: string | string[], pathToAppend: string = "./" + new Date().toDateString() + ".txt"): void {
        // checking if it's windows or unix and based on the result determines which break space to use

        if (Array.isArray(strArr)) {
            if (strArr.length === 0) return;
            //todo add a string check
            let exisitingDomains: string[] | null = getFoundDomains(pathToAppend);
            strArr = exisitingDomains ? array1_minus_array2(strArr, exisitingDomains) : strArr;
            strArr = BREAK_SPACE + strArr.join(BREAK_SPACE)
        }
        console.info(`Writing to file...`);
        fs.appendFile(pathToAppend, strArr, (error) => {
            if (error) {
                console.error(error);
            }
        });
    }

    /**
     *
     * @param {string} file_path
     * @returns {any} the list of domains from the existing file, if dose'nt exist returns null;
     */
    static getFoundDomains(file_path: string) {
        try {
            return fs.readFileSync(file_path, "utf8").split(this.BREAK_SPACE);
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
    array1_minus_array2(arr1, arr2): string[] {
        return arr1.filter((item) => {
            return arr2.indexOf(item) === -1;
        })
    }

    /**
     *
     * @returns {boolean} true if the operating system is windows and false otherwise
     */
    static get_is_windows() {
        return process.platform == "win32";
    }

    removeQueriedDomains(domainsToRemove: string[]) {
        fs.readFile(this.DOMAINS_FILE_NAME, 'utf8', (err, data) => {
            if (err) {
                console.log(err);
                return;
            }
            let domains = data.split(Crawler.BREAK_SPACE).map(domain => {
                return domain.replace('\r', '');
            });
            let newText = this.array1_minus_array2(domains, domainsToRemove);
            fs.writeFileSync(this.DOMAINS_FILE_NAME, newText.join('\n'))
        })
    }


}

let txt = fs.readFileSync(DOMAINS_FILE_NAME, 'utf8');
let domains = txt.split('\n');
domains = domains.map(domain => {
    return domain.replace('\r', '');
});
// Used like so
domains = Crawler.shuffle(domains);
let crawler = new Crawler();
crawler.crawl(domains);

