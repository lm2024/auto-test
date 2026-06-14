function getTdRealValueNode(node, index) {
    return node.getElementsByTagName("td")[index].getElementsByTagName("div")[0];
}

function getTdShowValueNode(node, index) {
    return node.getElementsByTagName("td")[index].getElementsByTagName("div")[1];
}

function getTargetDatalist(node) {
    return node.getElementsByTagName("td")[2].getElementsByTagName("datalist")[0];
}

function getCommandName(tr, for_show) {
    if (for_show) {
        return getTdShowValueNode(tr, 1).textContent;
    }
    return getTdRealValueNode(tr, 1).textContent;
}

function getCommandTarget(tr, for_show) {
    if (for_show) {
        return getTdShowValueNode(tr, 2).textContent;
    }
    return getTdRealValueNode(tr, 2).textContent;
}

function getCommandValue(tr, for_show) {
    if (for_show) {
        return getTdShowValueNode(tr, 3).textContent;
    }
    return getTdRealValueNode(tr, 3).textContent;
}

function getCommandTargets(tr) {
    if (tr === undefined || !getTargetDatalist(tr)) {
        return [];
    }
    return [...getTargetDatalist(tr).getElementsByTagName("option")].map(ele => ele.textContent);
}

export { getTdRealValueNode, getTdShowValueNode, getTargetDatalist, getCommandName, getCommandTarget, getCommandValue, getCommandTargets }