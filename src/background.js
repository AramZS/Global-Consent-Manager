"use strict";

async function enable(site) {
    if (site.selector) {
        site.cs = await browser.contentScripts.register({
            matches: [`*://*.${site.domain}/*`],
            css: [{code: `${site.selector} { display: none !important }`}],
            runAt: "document_start",
        });
        console.log(site.selector + " rule set for " + site.domain);
        return;
    }
    await browser.cookies.set({
        domain: site.domain,
        name: site.name,
        value: site.value,
        url: `http://${site.domain}/`,
        firstPartyDomain: "",
    });
    console.log(`Cookie ${site.name} set for domain ${site.domain}`);
}

async function disable(site) {
    if (site.selector) {
        return site.cs.unregister();
    }
    await browser.cookies.remove({
        name: site.name,
        url: `http://${site.domain}/`,
        firstPartyDomain: "",
    });
}

let actions = {
    async message({domain, blocked}) {
        let site = await getSite(domain);
        site.storage = {blocked, manual: true};
        await browser.storage.sync.set({[site.domain]: site.storage});
        if (blocked) {
            await enable(site);
        } else {
            await disable(site);
        }
    },

    async navigation({url}) {
        let site = await getSite(new URL(url).host);
        let date = new Date().toISOString().substr(0, 10);

        if (!site || site.manual || !site.blocked || date in site.storage) {
            return;
        }

        if (Object.keys(site.storage).length <= 5) {
            site.storage[date] = 1;
        } else {
            site.storage = {blocked: false};
            await disable(site);
        }
        await browser.storage.sync.set({[site.domain]: site.storage});
    },
};

async function main() {
    for (let {domain} of sites) {
        let site = await getSite(domain);
        if (site.blocked) {
            await enable(site);
        }
    }

    async function bug(e) {
        let [URL] =  await browser.tabs.query({active: true, currentWindow: true});
        let domain = (URL.url).split("/")[2];
        let body = "I found a bug in Global Consent Manager!";
        body += "%0A%0A";
        body += "(Explain the issue here)";
        await browser.tabs.create({
            url: "https://github.com/SociallyCompute/Global-Consent-Manager/issues/new?title="
                + "Bug found while browsing " + domain + "&body=" + body +
                "&projects=loading..." + "&labels=bug",
        });
        window.close();
    }

    browser.contextMenus.create({
        id: "report-bug",
        title: "Report a GCM Bug",
        contexts: ["all"]
      });
      
      browser.contextMenus.onClicked.addListener(bug);
    await browser.runtime.onMessage.addListener(actions.message);
    await browser.webNavigation.onCommitted.addListener(actions.navigation);
}
main();
