function getKatalonEndpoint() {
    let manifestData = browser.runtime.getManifest();
    return manifestData.homepage_url;
}

function getHubspotEndpoint(){
    const manifestData = browser.runtime.getManifest();
    return manifestData.hubspot_url;
}

/**
 * 
 * @param {string} user Email of the user
 */
export async function setHubspotUser(user) {
    let result = await browser.storage.local.get('hubspot');
    if (result.hubspot) {
        result.hubspot.user = user;
    } else {
        result = {
            hubspot: {
                user: user
            }
        }
    }
    await browser.storage.local.set(result);
}

async function trackingHubspotApi(data) {
    const settingData = await browser.storage.local.get("setting");
    if (settingData.setting.tracking){
        let fetchData = {
            method: 'POST',
            body: JSON.stringify(data),
            headers: { "Content-type": "application/json; charset=UTF-8" },
        }
        const result = await fetch(`${getHubspotEndpoint()}wp-json/restful_api/v1/hubspot/update-contact`, fetchData);
        const json = await  result.json();
        return json;
    }
}

function getLoggedInUserAPI() {
    return fetch(`${getKatalonEndpoint()}wp-json/restful_api/v1/auth/kr/me`)
        .then(response => response.json())
        .then(data => {
            let user;
            if (data.user_info) {
                user = { email: data.user_info };
            } else {
                user = {};
            }
            return Promise.resolve(user);
        }).catch(error => {
            console.log(error);
            return Promise.resolve({});
        })
}

export async function trackingHubspot(action){
    let result = await browser.storage.local.get('hubspot');
    if (!result.hubspot) {
        result = {
            hubspot: {
                user: ''
            }
        }
        let user = await getLoggedInUserAPI();

        if (user.email) {
            result.hubspot.user = user.email.email;
        }
        browser.storage.local.set(result);
    }

    let data = {
        email: '',
    }
    if (result.hubspot.user){
        data.email = result.hubspot.user;
    }
    let properties = {};

    if (action) {
        for (const key in action) {
            if (Object.hasOwnProperty.call(action, key)) {
                const element = action[key];
                properties[key] = element;
            }
        }
    }
    data["properties"] = properties;
    return trackingHubspotApi(data);
}

export async function trackingHubspotLogin(){
    return trackingHubspot({
        "kr_product_registration": "Signed In"
    });
}

export async function trackingHubspotSignup(){
    return trackingHubspot({
        "kr_inapp_signup": "Signed up"
    });
}



