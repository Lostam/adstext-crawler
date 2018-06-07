const fs = require('fs');
const axios = require('axios');

const values:string[] = require('./setting').value;
 // const memwatch = require('memwatch-next');

let REGEX = new RegExp(".*.com,.(p|[0-9])");

if (values.length == 0 || values[0] == "[ADD YOUR TEXT HERE]") {
    throw ("Please insert values to search in setting.js")
}

// let random = 1000*60*10*((Math.random()*6)+1);
// console.log(`restarting in ${random/1000/60}`);
// setTimeout(()=>{
//     console.log("killing");
//     process.exit(1);
// },random);

class Crawler {
    private static BATCH_SIZE: number = 200;
     private static DOMAINS_FILE_NAME: string = './domain_list.txt';
    private static FOUND_DOMAIN_FILE_NAME: string = './found_domains.txt';
    private static  BREAK_SPACE = Crawler.get_is_windows() ? "\r\n" : "\n";

    constructor(inputFile?:string,outputFile?:string) {
        Crawler.FOUND_DOMAIN_FILE_NAME = outputFile ? outputFile : Crawler.FOUND_DOMAIN_FILE_NAME;
        Crawler.DOMAINS_FILE_NAME = inputFile ? inputFile : Crawler.DOMAINS_FILE_NAME;

        if (!fs.existsSync(Crawler.DOMAINS_FILE_NAME)) {
            console.log("Input file doe's not exist : "+Crawler.DOMAINS_FILE_NAME)
            throw "File not found";
        }
        console.log("Started reading file...");
        console.time("readFile");
        let txt: string = fs.readFileSync(Crawler.DOMAINS_FILE_NAME, 'utf8');
        console.log("Read from file took : ");console.timeEnd("readFile");
        let domains: string[] = txt.split('\n');
        console.log(`${domains.length } domains left`);
        domains = domains.map((domain: string) => {
            return domain.replace('\r', '');
        });
        console.time("shuffle");
        domains = Crawler.shuffle(domains);
        console.timeEnd("shuffle");
        this.crawl(domains);
    }

    async crawl(domains: string[]) {

        while (domains.length > 0) {
            let maxCount = Crawler.BATCH_SIZE < domains.length ? Crawler.BATCH_SIZE : domains.length;
            let batch:string[] = domains.splice(0, maxCount);
            console.time("Crawling");
            console.log(`Starting crawl, batch size : ${batch.length}`);
            let foundDomains: string[] = await this.batchRequest(batch);
            console.timeEnd("Crawling");
            console.log(`found ${foundDomains.length} domains`);
            await Crawler.saveAndDelete(foundDomains, batch);
        }
        console.log('Finished');
    }


    /**
     * Saving the domains to the out file and removes them from the origin file to prevent duplicate requests
     * @param {string[]} domains
     * @returns {Promise<void>}
     */
    static async  saveAndDelete(domains_to_add:string[],domains_to_delete:string[]) {
        // if (domains_to_add.length == 0){
        //     return;
        // }
        this.writeToFile(domains_to_add);
        await Crawler.removeQueriedDomains(domains_to_delete)
    }
    async batchRequest(domains: string[]) {
        let waitForResults = domains.map((domain: string) => {
            return Crawler.promiseArrToSingle(Crawler.makeMultipleRequests(domain))
                .then(res => {
                    return {[domain]: res}
                });
        });
        const results: object[] = await Promise.all(waitForResults);
        return results
        // filter out site's with out required ads txt
            .filter((item) => {
                return Crawler.isArrInString(values, item[Object.keys(item)[0]]);
            })
            // map only the domains
            .map(item => {
                return Object.keys(item)[0];
            })
        // this.removeQueriedDomains(domains);
    }

    /**
     * the issue : if one promise in an array of promises fails then Promise.all fails as well
     * the solution : resolving all the promises before using in Promise.all
     * @param {Promise<any>[]} arr
     * @returns {Promise<any>[]}
     */
    static formatArrOfPromise(arr: Promise<any>[]): Promise<any>[] {
        return arr.map(item => {
            return item.then(x => {
                return x
            }).catch(x => {
                return x
            });
        });
    }

    /**
     * making 4 requests for each domain
     * @param {string} domain
     * @returns {Promise<{data: any}>[]}
     */
    static makeMultipleRequests(domain: string): Promise<{ data: any }>[] {
        let urls = [
            'http://www.' + domain + '/ads.txt',
            'https://www.' + domain + '/ads.txt',
            'http://' + domain + '/ads.txt',
            'https://' + domain + '/ads.txt'
        ];
        let promise_arr: Promise<any>[] = [];
        for (let url of urls) {
            promise_arr.push(axios.get(url));
        }
        return this.formatArrOfPromise(promise_arr);
    }

    static async promiseArrToSingle(arr: Promise<any>[]): Promise<string> {
        return Promise.all(arr).then(res => {
            for (let item of res) {
                if (item.data && typeof item.data === "string" && item.data.search(REGEX) > -1) {
                    return item.data;
                }
                else if (item.data && typeof item.data !== "string") {
                    fs.appendFile("./error.txt", item.data, (error) => {
                        if (error) {
                            console.error(error);
                        }
                    });
                }
            }
            return null;
        });
    }

    /**
     *
     * @param array an array to shuffle
     * @returns {string[]} shuffles the array and returns it
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
    static writeToFile(strArr: string | string[], pathToAppend: string = this.FOUND_DOMAIN_FILE_NAME): void {
        // checking if it's windows or unix and based on the result determines which break space to use

        if (Array.isArray(strArr)) {
            if (strArr.length === 0) return;
            //todo add a string check
            let existingDomains: string[] | null = Crawler.getFoundDomains(pathToAppend);
            strArr = existingDomains ? Crawler.array1_minus_array2(strArr, existingDomains) : strArr;
            strArr = Crawler.BREAK_SPACE + strArr.join(Crawler.BREAK_SPACE)
        }
        console.time("write to file");
        console.info(`Writing to file...`);
        fs.appendFile(pathToAppend, strArr, (error) => {
            if (error) {
                console.error(error);
            }
            console.timeEnd("write to file");
        });
    }

    /**
     *
     * @param {string} file_path
     * @returns {string} the list of domains from the existing file, if dose'nt exist returns null;
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
    static array1_minus_array2(arr1, arr2): string[] {
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

    static removeQueriedDomains(domainsToRemove: string[]) {
        return new Promise((resolve) => {
            fs.readFile(this.DOMAINS_FILE_NAME, 'utf8', (err, data) => {
                if (err) {
                    console.log(err);
                    resolve();
                }
                let domains = data.split(Crawler.BREAK_SPACE).map(domain => {
                    return domain.replace('\r', '');
                });
                let newText = this.array1_minus_array2(domains, domainsToRemove);
                fs.writeFileSync(this.DOMAINS_FILE_NAME, newText.join('\n'));
                resolve();
            })
        })
    }

    /**
     *
     * @param {string[]} arr array of strings
     * @param {string} stringToSearch
     * @returns {boolean}
     */
    static isArrInString(arr: string[], stringToSearch: string) {
        for (let item of arr) {
            if (typeof stringToSearch === "string" && stringToSearch.includes(item)) {
                return true;
            }
        }
        return false;
    }
}

new Crawler("./domain_list_1.txt");
// let arr = Crawler.makeMultipleRequests("india.com");
// arr.map(item=>{item.then(console.log)});