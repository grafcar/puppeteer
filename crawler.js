const puppeteer = require('puppeteer');
const fs = require('fs/promises');
const URL = require('url').URL;

class WebCrawler {
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
        this.visitedUrls = new Set();
        this.errors = [];
    }

    isValidUrl(url) {
        try {
            const parsedUrl = new URL(url);
            return parsedUrl.hostname === new URL(this.baseUrl).hostname;
        } catch (error) {
            return false;
        }
    }

    async logError(source, destination, statusCode) {
        const errorLog = `Source: ${source}\nDestination: ${destination}\nError Code: ${statusCode}\n-------------------\n`;
        this.errors.push(errorLog);
        await fs.appendFile('error_log.txt', errorLog);
    }

    async extractLinks(page) {
        return await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a'));
            return links
                .map(link => link.href)
                .filter(href => href && href.startsWith('http'));
        });
    }

    async crawl(url, source = 'Initial Page') {
        if (this.visitedUrls.has(url) || !this.isValidUrl(url)) {
            return;
        }

        this.visitedUrls.add(url);
        console.log(`Crawling: ${url}`);

        try {
            const browser = await puppeteer.launch({
                headless: "new",
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--disable-gpu'
                ]
            });
            const page = await browser.newPage();

            // Handle response to check status code
            page.on('response', async (response) => {
                const status = response.status();
                if ((status >= 400 && status < 600) && response.url() === url) {
                    await this.logError(source, url, status);
                }
            });

            await page.goto(url, { waitUntil: 'networkidle0' });
            const links = await this.extractLinks(page);
            await browser.close();

            // Recursively crawl all found links
            for (const link of links) {
                await this.crawl(link, url);
            }
        } catch (error) {
            console.error(`Error crawling ${url}:`, error.message);
            await this.logError(source, url, 'Connection Error');
        }
    }

    getErrors() {
        return this.errors;
    }
}

async function main() {
    const baseUrl = 'https://elittile.com'; // Replace with your website
    const crawler = new WebCrawler(baseUrl);
    
    console.log('Starting crawler...');
    await crawler.crawl(baseUrl);
    console.log('Crawling complete!');
    
    const errors = crawler.getErrors();
    if (errors.length > 0) {
        console.log('\nErrors found:');
        console.log(errors.join('\n'));
    } else {
        console.log('\nNo errors found!');
    }
}

main().catch(console.error); 