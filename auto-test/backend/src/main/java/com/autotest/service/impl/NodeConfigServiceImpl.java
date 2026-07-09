package com.autotest.service.impl;

import com.autotest.exception.BusinessException;
import com.autotest.mapper.TestNodeConfigMapper;
import com.autotest.model.dto.NodeCreateDTO;
import com.autotest.model.dto.NodeEditDTO;
import com.autotest.model.dto.PluginInterfaceDTO;
import com.autotest.model.entity.TestNodeConfig;
import com.autotest.model.vo.NodeVO;
import com.autotest.service.NodeConfigService;
import com.autotest.util.CodeGenerator;
import com.autotest.util.JsonPathUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class NodeConfigServiceImpl implements NodeConfigService {

    @Autowired
    private TestNodeConfigMapper nodeConfigMapper;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public NodeVO createNode(NodeCreateDTO dto) {
        int maxSortNo = nodeConfigMapper.getMaxSortNo(dto.getChainCode());
        int maxNodeId = nodeConfigMapper.getMaxNodeId(dto.getChainCode());

        TestNodeConfig node = new TestNodeConfig();
        node.setChainCode(dto.getChainCode());
        node.setNodeId((long) (maxNodeId + 1));
        node.setNodeCode(CodeGenerator.generateNodeCode(dto.getChainCode(), maxNodeId + 1));
        node.setNodeName(dto.getNodeName());
        node.setNodeType(dto.getNodeType() != null ? dto.getNodeType() : "HTTP");
        node.setSortNo(dto.getSortNo() != null ? dto.getSortNo() : maxSortNo + 1);
        node.setParallelGroup(dto.getParallelGroup());
        node.setRequestUrl(dto.getRequestUrl());
        node.setRequestMethod(dto.getRequestMethod());
        node.setRequestHeaders(dto.getRequestHeaders());
        node.setBodyType(dto.getBodyType());
        node.setBodyData(dto.getBodyData());
        node.setExtractRules(dto.getExtractRules());
        node.setAssertRules(dto.getAssertRules());
        node.setVariableMapping(dto.getVariableMapping());
        node.setDelaySeconds(dto.getDelaySeconds());

        nodeConfigMapper.insert(node);
        return buildNodeVO(node);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public NodeVO editNode(NodeEditDTO dto) {
        TestNodeConfig existing = nodeConfigMapper.selectById(dto.getId());
        if (existing == null) {
            throw new BusinessException(404, "节点不存在");
        }

        TestNodeConfig node = new TestNodeConfig();
        node.setId(dto.getId());
        if (dto.getNodeName() != null) node.setNodeName(dto.getNodeName());
        if (dto.getSortNo() != null) node.setSortNo(dto.getSortNo());
        if (dto.getParallelGroup() != null) node.setParallelGroup(dto.getParallelGroup());
        if (dto.getRequestUrl() != null) node.setRequestUrl(dto.getRequestUrl());
        if (dto.getRequestMethod() != null) node.setRequestMethod(dto.getRequestMethod());
        if (dto.getRequestHeaders() != null) node.setRequestHeaders(dto.getRequestHeaders());
        if (dto.getBodyType() != null) node.setBodyType(dto.getBodyType());
        if (dto.getBodyData() != null) node.setBodyData(dto.getBodyData());
        if (dto.getExtractRules() != null) node.setExtractRules(dto.getExtractRules());
        if (dto.getAssertRules() != null) node.setAssertRules(dto.getAssertRules());
        if (dto.getVariableMapping() != null) node.setVariableMapping(dto.getVariableMapping());
        if (dto.getDelaySeconds() != null) node.setDelaySeconds(dto.getDelaySeconds());

        nodeConfigMapper.update(node);
        return buildNodeVO(nodeConfigMapper.selectById(dto.getId()));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteNode(Long id) {
        TestNodeConfig node = nodeConfigMapper.selectById(id);
        if (node == null) {
            throw new BusinessException(404, "节点不存在");
        }
        nodeConfigMapper.deleteById(id);
    }

    @Override
    public List<NodeVO> listNodes(String chainCode) {
        List<TestNodeConfig> nodes = nodeConfigMapper.selectByChainCode(chainCode);
        return nodes.stream().map(this::buildNodeVO).collect(Collectors.toList());
    }

    @Override
    public NodeVO getNodeDetail(Long id) {
        TestNodeConfig node = nodeConfigMapper.selectById(id);
        if (node == null) {
            throw new BusinessException(404, "节点不存在");
        }
        return buildNodeVO(node);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> importNodes(String chainCode, List<PluginInterfaceDTO> interfaces) {
        int maxSortNo = nodeConfigMapper.getMaxSortNo(chainCode);
        int maxNodeId = nodeConfigMapper.getMaxNodeId(chainCode);

        List<TestNodeConfig> nodes = new ArrayList<>();
        int successCount = 0;
        int failCount = 0;

        for (int i = 0; i < interfaces.size(); i++) {
            PluginInterfaceDTO iface = interfaces.get(i);
            try {
                TestNodeConfig node = new TestNodeConfig();
                node.setChainCode(chainCode);
                int nodeId = maxNodeId + i + 1;
                node.setNodeId((long) nodeId);
                node.setNodeCode(CodeGenerator.generateNodeCode(chainCode, nodeId));
                node.setNodeName(iface.getNodeName() != null ? iface.getNodeName() : "节点" + nodeId);
                node.setNodeType("HTTP");
                node.setSortNo(maxSortNo + i + 1);
                node.setParallelGroup(iface.getParallelGroup());
                node.setRequestUrl(iface.getUrl());
                node.setRequestMethod(iface.getMethod());
                node.setRequestHeaders(iface.getHeaders());
                node.setBodyData(iface.getBodyData());
                nodes.add(node);
                successCount++;
            } catch (Exception e) {
                failCount++;
            }
        }

        if (!nodes.isEmpty()) {
            nodeConfigMapper.batchInsert(nodes);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("successCount", successCount);
        result.put("failCount", failCount);
        result.put("nodes", nodes.stream().map(n -> {
            Map<String, Object> m = new HashMap<>();
            m.put("nodeCode", n.getNodeCode());
            m.put("nodeId", n.getNodeId());
            m.put("sortNo", n.getSortNo());
            return m;
        }).collect(Collectors.toList()));
        return result;
    }

    @Override
    public List<DependencyRelation> identifyDependencies(String chainCode) {
        List<TestNodeConfig> nodes = nodeConfigMapper.selectByChainCode(chainCode);
        List<DependencyRelation> relations = new ArrayList<>();

        for (int i = 0; i < nodes.size(); i++) {
            TestNodeConfig current = nodes.get(i);
            if (current.getBodyData() == null || current.getBodyData().isEmpty()) continue;

            Map<String, String> requestPaths = JsonPathUtil.extractRequestBodyPaths(current.getBodyData());

            for (int j = 0; j < i; j++) {
                TestNodeConfig prev = nodes.get(j);
                // Use extract rules from previous node to identify dependencies
                if (prev.getExtractRules() != null && !prev.getExtractRules().isEmpty()) {
                    // Parse extract rules to find response paths
                    try {
                        com.alibaba.fastjson.JSONObject rules = com.alibaba.fastjson.JSON.parseObject(prev.getExtractRules());
                        com.alibaba.fastjson.JSONArray rulesArray = rules.getJSONArray("rules");
                        if (rulesArray != null) {
                            for (int k = 0; k < rulesArray.size(); k++) {
                                com.alibaba.fastjson.JSONObject rule = rulesArray.getJSONObject(k);
                                String jsonPath = rule.getString("jsonPath");
                                String varName = rule.getString("varName");
                                // Check if this variable is referenced in current node's body
                                if (current.getBodyData().contains("${" + varName + "}")) {
                                    DependencyRelation dr = new DependencyRelation();
                                    dr.setFromNode(prev.getNodeCode());
                                    dr.setToNode(current.getNodeCode());
                                    dr.setExtractPath(jsonPath);
                                    dr.setTargetPath("${" + varName + "}");
                                    dr.setMatched(true);
                                    relations.add(dr);
                                }
                            }
                        }
                    } catch (Exception e) {
                        // Skip invalid JSON
                    }
                }
            }
        }
        return relations;
    }

    private NodeVO buildNodeVO(TestNodeConfig node) {
        NodeVO vo = new NodeVO();
        vo.setId(node.getId());
        vo.setNodeId(node.getNodeId());
        vo.setNodeCode(node.getNodeCode());
        vo.setNodeName(node.getNodeName());
        vo.setNodeType(node.getNodeType());
        vo.setSortNo(node.getSortNo());
        vo.setParallelGroup(node.getParallelGroup());
        vo.setRequestUrl(node.getRequestUrl());
        vo.setRequestMethod(node.getRequestMethod());
        vo.setRequestHeaders(node.getRequestHeaders());
        vo.setBodyType(node.getBodyType());
        vo.setBodyData(node.getBodyData());
        vo.setExtractRules(node.getExtractRules());
        vo.setAssertRules(node.getAssertRules());
        vo.setVariableMapping(node.getVariableMapping());
        vo.setDelaySeconds(node.getDelaySeconds());
        vo.setBizOperTraceId(node.getBizOperTraceId());
        vo.setTriggerEvent(node.getTriggerEvent());
        vo.setTargetDom(node.getTargetDom());
        vo.setPageUrl(node.getPageUrl());
        vo.setWindowId(node.getWindowId());
        vo.setIsIgnored(node.getIsIgnored());
        return vo;
    }
}
