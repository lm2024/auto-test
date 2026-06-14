let textFile = null;

const makeTextFile = (text) => {
    const data = new Blob([text], {
        type: 'text/*'
    });
    // If we are replacing a previously generated file we need to
    // manually revoke the object URL to avoid memory leaks.
    if (textFile !== null) {
        window.URL.revokeObjectURL(textFile);
    }
    textFile = window.URL.createObjectURL(data);
    return textFile;
};

const makeTextFileJSON = (text) => {
    const data = new Blob([text], {
        type: 'application/json'
    });
    // If we are replacing a previously generated file we need to
    // manually revoke the object URL to avoid memory leaks.
    if (textFile !== null) {
        window.URL.revokeObjectURL(textFile);
    }
    textFile = window.URL.createObjectURL(data);
    return textFile;
};

export { makeTextFile, makeTextFileJSON }