package com.autotest.service.impl;

import com.autotest.mapper.ChainVersionMapper;
import com.autotest.mapper.NodeSnapshotMapper;
import com.autotest.model.entity.ChainVersion;
import com.autotest.model.entity.NodeSnapshot;
import com.autotest.model.vo.DiffVO;
import com.autotest.model.vo.DiffNodeVO;
import com.autotest.model.vo.VersionVO;
import com.autotest.service.DiffService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class DiffServiceImpl implements DiffService {

    @Autowired
    private NodeSnapshotMapper snapshotMapper;

    @Autowired
    private ChainVersionMapper versionMapper;

    @Override
    public DiffVO computeDiff(String chainCode, int currentVersion, int compareVersion) {
        ChainVersion currentObj = versionMapper.selectByChainCodeAndVersion(chainCode, currentVersion);
        ChainVersion compareObj = versionMapper.selectByChainCodeAndVersion(chainCode, compareVersion);

        List<NodeSnapshot> current = currentObj != null ? snapshotMapper.selectByVersionId(currentObj.getId()) : Collections.emptyList();
        List<NodeSnapshot> previous = compareObj != null ? snapshotMapper.selectByVersionId(compareObj.getId()) : Collections.emptyList();

        return computeDiffFromSnapshots(current, previous, chainCode, currentVersion, compareVersion);
    }

    @Override
    public DiffVO computeDiffFromSnapshots(List<NodeSnapshot> current, List<NodeSnapshot> previous, String chainCode, int currentVersion, int compareVersion) {
        DiffVO result = new DiffVO();
        result.setChainCode(chainCode);
        result.setCurrentVersion(currentVersion);
        result.setCompareVersion(compareVersion);

        VersionVO.DiffSummary summary = new VersionVO.DiffSummary();
        List<DiffNodeVO> diffNodes = new ArrayList<>();

        Map<String, NodeSnapshot> prevMap = previous.stream()
                .collect(Collectors.toMap(NodeSnapshot::getNodeName, n -> n, (a, b) -> b));
        Map<String, NodeSnapshot> currMap = current.stream()
                .collect(Collectors.toMap(NodeSnapshot::getNodeName, n -> n, (a, b) -> b));

        for (NodeSnapshot prev : previous) {
            NodeSnapshot curr = currMap.get(prev.getNodeName());
            if (curr == null) {
                DiffNodeVO node = new DiffNodeVO();
                node.setNodeCode(prev.getNodeCode());
                node.setNodeName(prev.getNodeName());
                node.setSortNo(prev.getSortNo());
                node.setChangeType("REMOVED");
                node.setPrevious(toSnapshotData(prev));
                diffNodes.add(node);
                summary.setRemoved(summary.getRemoved() + 1);
            } else {
                List<DiffNodeVO.FieldChange> changes = compareFields(prev, curr);
                DiffNodeVO node = new DiffNodeVO();
                node.setNodeCode(curr.getNodeCode());
                node.setNodeName(curr.getNodeName());
                node.setSortNo(curr.getSortNo());
                node.setCurrent(toSnapshotData(curr));
                node.setPrevious(toSnapshotData(prev));

                if (!changes.isEmpty()) {
                    node.setChangeType("MODIFIED");
                    node.setFieldChanges(changes);
                    summary.setModified(summary.getModified() + 1);
                } else {
                    node.setChangeType("UNCHANGED");
                    summary.setUnchanged(summary.getUnchanged() + 1);
                }
                diffNodes.add(node);
            }
        }

        for (NodeSnapshot curr : current) {
            if (!prevMap.containsKey(curr.getNodeName())) {
                DiffNodeVO node = new DiffNodeVO();
                node.setNodeCode(curr.getNodeCode());
                node.setNodeName(curr.getNodeName());
                node.setSortNo(curr.getSortNo());
                node.setChangeType("ADDED");
                node.setCurrent(toSnapshotData(curr));
                diffNodes.add(node);
                summary.setAdded(summary.getAdded() + 1);
            }
        }

        diffNodes.sort(Comparator.comparingInt(n -> n.getSortNo() != null ? n.getSortNo() : 0));

        result.setNodes(diffNodes);
        result.setSummary(summary);
        return result;
    }

    private List<DiffNodeVO.FieldChange> compareFields(NodeSnapshot prev, NodeSnapshot curr) {
        List<DiffNodeVO.FieldChange> changes = new ArrayList<>();
        checkField(changes, "requestUrl", "请求地址", prev.getRequestUrl(), curr.getRequestUrl());
        checkField(changes, "requestMethod", "请求方法", prev.getRequestMethod(), curr.getRequestMethod());
        checkField(changes, "requestHeaders", "请求头", prev.getRequestHeaders(), curr.getRequestHeaders());
        checkField(changes, "bodyData", "请求体", prev.getBodyData(), curr.getBodyData());
        checkField(changes, "responseCode", "响应码",
                prev.getResponseCode() != null ? String.valueOf(prev.getResponseCode()) : null,
                curr.getResponseCode() != null ? String.valueOf(curr.getResponseCode()) : null);
        checkField(changes, "responseBody", "响应体", prev.getResponseBody(), curr.getResponseBody());
        return changes;
    }

    private void checkField(List<DiffNodeVO.FieldChange> changes, String field, String label, String oldVal, String newVal) {
        String oldNorm = oldVal != null ? oldVal.trim() : "";
        String newNorm = newVal != null ? newVal.trim() : "";
        if (!oldNorm.equals(newNorm)) {
            changes.add(new DiffNodeVO.FieldChange(field, label, oldVal, newVal));
        }
    }

    private DiffNodeVO.NodeSnapshotData toSnapshotData(NodeSnapshot snapshot) {
        DiffNodeVO.NodeSnapshotData data = new DiffNodeVO.NodeSnapshotData();
        data.setRequestUrl(snapshot.getRequestUrl());
        data.setRequestMethod(snapshot.getRequestMethod());
        data.setRequestHeaders(snapshot.getRequestHeaders());
        data.setBodyData(snapshot.getBodyData());
        data.setResponseCode(snapshot.getResponseCode());
        data.setResponseBody(snapshot.getResponseBody());
        data.setDurationMs(snapshot.getDurationMs());
        return data;
    }
}
