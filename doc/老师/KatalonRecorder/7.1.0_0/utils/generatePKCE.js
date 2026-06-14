const base64UrlEncode = (a) => {
    var str = "";
    var bytes = new Uint8Array(a);
    var len = bytes.byteLength;
    for (var i = 0; i < len; i++) {
        str += String.fromCharCode(bytes[i]);
    }
    return btoa(str)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

const generateRandomString = (length = 128) => {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i += 1) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
};

const generatePKCE = async () => {
    const codeVerifier = generateRandomString();
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const digest = await window.crypto.subtle.digest("SHA-256", data);
    const codeChallenge = base64UrlEncode(digest);

    await browser.storage.local.set({
        "codePKCE": {
            code_verifier: codeVerifier,
            code_challenge: codeChallenge,
        }
    })
    return {
        code_verifier: codeVerifier,
        code_challenge: codeChallenge,
    };
};

export {
    generatePKCE,
}
