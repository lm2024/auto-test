let copyText = "";

function copyBtn() {
    const div = document.createElement('div');
    div.id = 'grid-cell-copy-btn';
    div.setAttribute("class", "grid-cell-copy-btn tooltips");
    div.setAttribute("tooltip", "Copy");

    div.addEventListener('click', function(event) {
        const targetTd = $(this).parents('td');
        targetTd.find("#command-value").select();
        document.execCommand("copy");
        copyText = targetTd.find("#command-value").val();
    });

    const copyBtn = document.createElement('img');
    copyBtn.src = 'icons/copy.svg';
    div.appendChild(copyBtn);

    const span = document.createElement('span');
    div.appendChild(span);

    return div;
}

function cutBtn() {
    const div = document.createElement('div');
    div.id = 'grid-cell-cut-btn';
    div.setAttribute("class", "grid-cell-cut-btn tooltips");
    div.setAttribute("tooltip", "Cut");

    div.addEventListener('click', function(event) {
        const targetTd = $(this).parents('td');
        targetTd.find("#command-value").select();
        copyText = targetTd.find("#command-value").val();
        document.execCommand("cut");
    });

    const cutBtn = document.createElement('img');
    cutBtn.src = 'icons/cut.svg';
    div.appendChild(cutBtn);

    const span = document.createElement('span');
    div.appendChild(span);

    return div;
}

function pasteBtn() {
    const div = document.createElement('div');
    div.id = 'grid-cell-paste-btn';
    div.setAttribute("class", "grid-cell-paste-btn tooltips");
    div.setAttribute("tooltip", "Paste");

    div.addEventListener('click', function(event) {
        const targetTd = $(this).parents('td');
        targetTd.find("#command-value").val(copyText);
    });

    const pasteBtn = document.createElement('img');
    pasteBtn.src = 'icons/paste.svg';
    div.appendChild(pasteBtn);

    const span = document.createElement('span');
    div.appendChild(span);

    return div;
}

function deleteBtn() {
    //add btn delete
    const div = document.createElement('div');
    div.id = 'grid-cell-delete-btn';
    div.setAttribute("class", "grid-cell-delete-btn tooltips");
    div.setAttribute("tooltip", "Delete");

    div.addEventListener('click', function(event) {
        const targetTd = $(this).parents('td');
        targetTd.find("#command-value").val("");
    });

    const delBtn = document.createElement('img');
    delBtn.src = 'icons/delete-btn.svg';
    div.appendChild(delBtn);

    const span = document.createElement('span');
    div.appendChild(span);

    return div;
}

function toolbarValueBtn(i) {
    const div = document.createElement('div');
    div.id = 'toolbar-value-btn' + i;
    div.setAttribute('class', 'toolbar-value-btn');
    div.style = 'display:none;'

    const copy = copyBtn();
    const cut = cutBtn();
    const paste = pasteBtn();
    const deleteBt = deleteBtn();

    div.appendChild(copy);
    div.appendChild(cut);
    div.appendChild(paste);
    div.appendChild(deleteBt);

    return div;
}

//contextmenu
function copyCtm() {
    const div = document.createElement('div');
    div.id = 'grid-cell-copy-ctm';
    div.setAttribute("class", "grid-cell-copy-ctm")

    div.addEventListener('click', function(event) {
        const targetTd = $(this).parents('td');
        targetTd.find("#command-value").select();
        document.execCommand("copy");
        copyText = targetTd.find("#command-value").val();
        $('.ctm-value-btn').hide();
    });

    const copyBtn = document.createElement('img');
    copyBtn.src = 'icons/copy.svg';
    div.appendChild(copyBtn);

    const p = document.createElement('p');
    p.innerText = "Copy";
    div.appendChild(p);

    const delBtn1 = document.createElement('img');
    delBtn1.src = 'icons/copy-ctm.svg';
    div.appendChild(delBtn1);

    return div;
}

function cutCtm() {
    const div = document.createElement('div');
    div.id = 'grid-cell-cut-ctm';
    div.setAttribute("class", "grid-cell-cut-ctm");

    div.addEventListener('click', function(event) {
        const targetTd = $(this).parents('td');
        targetTd.find("#command-value").select();
        copyText = targetTd.find("#command-value").val();
        document.execCommand("cut");
        $('.ctm-value-btn').hide();
    });

    const cutBtn = document.createElement('img');
    cutBtn.src = 'icons/cut.svg';
    div.appendChild(cutBtn);

    const p = document.createElement('p');
    p.innerText = "Cut";
    div.appendChild(p);

    const delBtn1 = document.createElement('img');
    delBtn1.src = 'icons/cut-ctm.svg';
    div.appendChild(delBtn1);

    return div;
}

function pasteCtm() {
    const div = document.createElement('div');
    div.id = 'grid-cell-paste-ctm';
    div.setAttribute("class", "grid-cell-paste-ctm");

    div.addEventListener('click', function(event) {
        const targetTd = $(this).parents('td');
        targetTd.find("#command-value").val(copyText);
        $('.ctm-value-btn').hide();
    });

    const pasteBtn = document.createElement('img');
    pasteBtn.src = 'icons/paste.svg';
    div.appendChild(pasteBtn);

    const p = document.createElement('p');
    p.innerText = "Paste";
    div.appendChild(p);

    const delBtn1 = document.createElement('img');
    delBtn1.src = 'icons/paste-ctm.svg';
    div.appendChild(delBtn1);

    return div;
}

function deleteCtm() {
    //add btn delete
    const div = document.createElement('div');
    div.id = 'grid-cell-delete-ctm';
    div.setAttribute("class", "grid-cell-delete-ctm");

    div.addEventListener('click', function(event) {
        const targetTd = $(this).parents('td');
        targetTd.find("#command-value").val("");
        $('.ctm-value-btn').hide();
    });

    const delBtn = document.createElement('img');
    delBtn.src = 'icons/delete-btn.svg';
    div.appendChild(delBtn);

    const p = document.createElement('p');
    p.innerText = "Delete";
    div.appendChild(p);

    const delBtn1 = document.createElement('img');
    delBtn1.src = 'icons/delete-ctm.svg';
    div.appendChild(delBtn1);

    return div;
}

function toolbarValueCtm(i) {
    const div = document.createElement('div');
    div.id = 'ctm-value-btn' + i;
    div.setAttribute('class', 'ctm-value-btn');
    div.style = 'display:none;'

    const copy = copyCtm();
    const cut = cutCtm();
    const paste = pasteCtm();
    const deleteBt = deleteCtm();

    div.appendChild(copy);
    div.appendChild(cut);
    div.appendChild(paste);
    div.appendChild(deleteBt);

    return div;
}

export {
    toolbarValueBtn,
    toolbarValueCtm
}