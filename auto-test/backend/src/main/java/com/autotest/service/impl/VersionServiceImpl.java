package com.autotest.service.impl;

import com.autotest.exception.BusinessException;
import com.autotest.mapper.ChainVersionMapper;
import com.autotest.mapper.NodeSnapshotMapper;
import com.autotest.mapper.TestChainMapper;
import com.autotest.model.dto.ReplayNodeDTO;
import com.autotest.model.dto.ReplayPushDTO;
import com.autotest.model.dto.VersionDeleteDTO;
import com.autotest.model.entity.ChainVersion;
import com.autotest.model.entity.NodeSnapshot;
import com.autotest.model.entity.TestChain;
import com.autotest.model.vo.DiffVO;
import com.autotest.model.vo.VersionVO;
import com.autotest.service.DiffService;
import com.autotest.service.VersionService;
import com.autotest.util.ChainFingerprintUtil;
import com.autotest.util.CodeGenerator;
import com.alibaba.fastjson.JSON;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class VersionServiceImpl implements VersionService {

    private static final Logger log = LoggerFactory.getLogger(VersionServiceImpl.class);

    @Autowired
    private ChainVersionMapper versionMapper;

    @Autowired
    private NodeSnapshotMapper snapshotMapper;

    @Autowired
    private TestChainMapper chainMapper;

    @Autowired
    private DiffService diffService;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> pushReplayResult(ReplayPushDTO dto) {
        List<ReplayNodeDTO> nodes = dto.getReplayNodes();
        if (nodes == null || nodes.isEmpty()) {
            throw new BusinessException("回放节点列表不能为空");
        }

        // 1. 生成链路指纹
        String fingerprint = ChainFingerprintUtil.generate(nodes);

        // 2. 查找是否已存在相同指纹的链路
        String chainCode = dto.getChainCode();
        TestChain chain = null;
        int newVersion;

        if (chainCode != null && !chainCode.isEmpty()) {
            chain = chainMapper.selectByChainCode(chainCode);
        }

        if (chain != null) {
            // 已有链路，版本号+1
            newVersion = versionMapper.getMaxVersion(chainCode) + 1;
            // 更新指纹和版本号
            chain.setChainFingerprint(fingerprint);
            chain.setCurrentVersion(newVersion);
            if (dto.getChainName() != null) {
                chain.setChainName(dto.getChainName());
            }
            chainMapper.update(chain);
        } else {
            // 新链路，创建
            chainCode = generateUniqueChainCode();
            newVersion = 1;
            chain = new TestChain();
            chain.setChainCode(chainCode);
            chain.setChainName(dto.getChainName() != null ? dto.getChainName() : "回放链路-" + chainCode);
            chain.setExecuteMode(1);
            chain.setChainFingerprint(fingerprint);
            chain.setCurrentVersion(1);
            chain.setStatus(1);
            chainMapper.insert(chain);
        }

        // 3. 保存版本
        ChainVersion version = new ChainVersion();
        version.setChainCode(chainCode);
        version.setChainFingerprint(fingerprint);
        version.setVersion(newVersion);
        version.setChainName(chain.getChainName());
        version.setExecuteMode(chain.getExecuteMode());
        version.setNodeSnapshot(JSON.toJSONString(nodes));
        version.setStatus("ACTIVE");
        versionMapper.insert(version);

        // 4. 保存接口快照
        List<NodeSnapshot> snapshots = buildSnapshots(version.getId(), chainCode, nodes);
        if (!snapshots.isEmpty()) {
            snapshotMapper.batchInsert(snapshots);
        }

        // 5. 计算Diff
        DiffVO diffResult = null;
        if (newVersion > 1) {
            diffResult = diffService.computeDiff(chainCode, newVersion, newVersion - 1);
            // 保存Diff结果
            version.setDiffResult(JSON.toJSONString(diffResult));
            versionMapper.update(version);
        }

        // 6. 组装返回
        Map<String, Object> result = new HashMap<>();
        result.put("chainCode", chainCode);
        result.put("version", newVersion);
        result.put("chainFingerprint", fingerprint);
        if (diffResult != null) {
            result.put("diffResult", diffResult.getSummary());
        }
        result.put("message", "推送成功，版本 v" + newVersion);

        return result;
    }

    @Override
    public List<VersionVO> getVersions(String chainCode, boolean all) {
        List<ChainVersion> versions;
        if (all) {
            versions = versionMapper.selectByChainCode(chainCode);
        } else {
            versions = versionMapper.selectRecentByChainCode(chainCode, 5);
        }

        return versions.stream().map(v -> {
            VersionVO vo = new VersionVO();
            vo.setVersionId(v.getId());
            vo.setVersion(v.getVersion());
            vo.setChainCode(v.getChainCode());
            vo.setChainName(v.getChainName());
            vo.setCreateTime(v.getCreateTime());
            vo.setCreateBy(v.getCreateBy());

            // 统计节点数
            List<NodeSnapshot> snapshots = snapshotMapper.selectByVersionId(v.getId());
            vo.setNodeCount(snapshots.size());

            // 解析Diff摘要
            if (v.getDiffResult() != null) {
                try {
                    DiffVO diff = JSON.parseObject(v.getDiffResult(), DiffVO.class);
                    vo.setDiffSummary(diff.getSummary());
                } catch (Exception e) {
                    // ignore
                }
            }

            return vo;
        }).collect(Collectors.toList());
    }

    @Override
    public DiffVO getVersionDiff(String chainCode, int version) {
        ChainVersion currentVersionObj = versionMapper.selectByChainCodeAndVersion(chainCode, version);
        if (currentVersionObj == null) {
            throw new BusinessException(404, "版本不存在");
        }

        // 先尝试从缓存读取Diff
        if (currentVersionObj.getDiffResult() != null) {
            try {
                DiffVO cached = JSON.parseObject(currentVersionObj.getDiffResult(), DiffVO.class);
                if (cached != null && cached.getNodes() != null) {
                    return cached;
                }
            } catch (Exception e) {
                // ignore, recompute
            }
        }

        // 重新计算
        if (version > 1) {
            return diffService.computeDiff(chainCode, version, version - 1);
        } else {
            // 第一个版本，所有节点都是新增
            List<NodeSnapshot> current = snapshotMapper.selectByVersionId(currentVersionObj.getId());
            DiffVO diff = diffService.computeDiffFromSnapshots(current, Collections.emptyList(), chainCode, version, 0);
            currentVersionObj.setDiffResult(JSON.toJSONString(diff));
            versionMapper.update(currentVersionObj);
            return diff;
        }
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteVersion(VersionDeleteDTO dto) {
        ChainVersion version = versionMapper.selectByChainCodeAndVersion(dto.getChainCode(), dto.getVersion());
        if (version == null) {
            throw new BusinessException(404, "版本不存在");
        }

        // 删除快照
        snapshotMapper.deleteByVersionId(version.getId());
        // 删除版本
        versionMapper.deleteByChainCodeAndVersion(dto.getChainCode(), dto.getVersion());

        // 如果删除的是当前版本，更新链路的当前版本号
        TestChain chain = chainMapper.selectByChainCode(dto.getChainCode());
        if (chain != null && chain.getCurrentVersion() == dto.getVersion()) {
            int maxVersion = versionMapper.getMaxVersion(dto.getChainCode());
            chain.setCurrentVersion(maxVersion > 0 ? maxVersion : 1);
            chainMapper.update(chain);
        }
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void batchDeleteVersions(String chainCode, int beforeVersion) {
        List<ChainVersion> toDelete = versionMapper.selectByChainCode(chainCode);
        toDelete = toDelete.stream()
                .filter(v -> v.getVersion() <= beforeVersion)
                .collect(Collectors.toList());

        for (ChainVersion v : toDelete) {
            snapshotMapper.deleteByVersionId(v.getId());
        }
        versionMapper.deleteByChainCodeBeforeVersion(chainCode, beforeVersion);

        // 更新当前版本号
        TestChain chain = chainMapper.selectByChainCode(chainCode);
        if (chain != null) {
            int maxVersion = versionMapper.getMaxVersion(chainCode);
            chain.setCurrentVersion(maxVersion > 0 ? maxVersion : 1);
            chainMapper.update(chain);
        }
    }

    private List<NodeSnapshot> buildSnapshots(Long versionId, String chainCode, List<ReplayNodeDTO> nodes) {
        List<NodeSnapshot> snapshots = new ArrayList<>();
        for (int i = 0; i < nodes.size(); i++) {
            ReplayNodeDTO node = nodes.get(i);
            NodeSnapshot snapshot = new NodeSnapshot();
            snapshot.setVersionId(versionId);
            snapshot.setChainCode(chainCode);
            snapshot.setNodeId((long) (i + 1));
            snapshot.setNodeCode(CodeGenerator.generateNodeCode(chainCode, i + 1));
            snapshot.setNodeName(node.getNodeName() != null ? node.getNodeName() : "节点" + (i + 1));
            snapshot.setNodeType(node.getNodeType() != null ? node.getNodeType() : "HTTP");
            snapshot.setSortNo(node.getSort() != null ? node.getSort() : (i + 1));
            snapshot.setParallelGroup(node.getParallelGroup());
            snapshot.setRequestUrl(node.getRequestUrl());
            snapshot.setRequestMethod(node.getRequestMethod());
            snapshot.setRequestHeaders(node.getRequestHeaders());
            snapshot.setBodyType(node.getBodyType());
            snapshot.setBodyData(node.getBodyData());
            snapshot.setResponseCode(node.getResponseCode());
            snapshot.setResponseHeaders(node.getResponseHeaders());
            snapshot.setResponseBody(node.getResponseBody());
            snapshot.setDurationMs(node.getDurationMs());
            snapshots.add(snapshot);
        }
        return snapshots;
    }

    private String generateUniqueChainCode() {
        String code;
        int attempts = 0;
        do {
            code = CodeGenerator.generateChainCode();
            attempts++;
            if (attempts > 10) {
                throw new BusinessException("生成链路编码失败，请重试");
            }
        } while (chainMapper.countByChainCode(code) > 0);
        return code;
    }
}
