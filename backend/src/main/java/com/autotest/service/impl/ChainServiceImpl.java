package com.autotest.service.impl;

import com.autotest.exception.BusinessException;
import com.autotest.mapper.TestChainMapper;
import com.autotest.mapper.TestNodeConfigMapper;
import com.autotest.model.dto.*;
import com.autotest.model.entity.TestChain;
import com.autotest.model.entity.TestNodeConfig;
import com.autotest.model.vo.ChainVO;
import com.autotest.model.vo.NodeVO;
import com.autotest.service.ChainService;
import com.autotest.service.NodeConfigService;
import com.autotest.util.CodeGenerator;
import com.autotest.util.JsonPathUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class ChainServiceImpl implements ChainService {

    private static final Logger log = LoggerFactory.getLogger(ChainServiceImpl.class);

    @Autowired
    private TestChainMapper chainMapper;

    @Autowired
    private TestNodeConfigMapper nodeConfigMapper;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ChainVO createChain(ChainCreateDTO dto) {
        String chainCode = dto.getChainCode();
        if (chainCode == null || chainCode.isEmpty()) {
            chainCode = generateUniqueChainCode();
        } else {
            if (chainMapper.countByChainCode(chainCode) > 0) {
                throw new BusinessException(409, "链路编码已存在: " + chainCode);
            }
        }

        TestChain chain = new TestChain();
        chain.setChainCode(chainCode);
        chain.setChainName(dto.getChainName());
        chain.setExecuteMode(dto.getExecuteMode() != null ? dto.getExecuteMode() : 1);
        chain.setDescription(dto.getDescription());
        chain.setStatus(1);
        chainMapper.insert(chain);

        return buildChainVO(chain);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ChainVO editChain(ChainEditDTO dto) {
        TestChain existing = chainMapper.selectByChainCode(dto.getChainCode());
        if (existing == null) {
            throw new BusinessException(404, "链路不存在");
        }

        TestChain chain = new TestChain();
        chain.setChainCode(dto.getChainCode());
        if (dto.getChainName() != null) chain.setChainName(dto.getChainName());
        if (dto.getExecuteMode() != null) chain.setExecuteMode(dto.getExecuteMode());
        if (dto.getDescription() != null) chain.setDescription(dto.getDescription());
        chainMapper.update(chain);

        return getChainDetail(dto.getChainCode());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteChain(String chainCode) {
        TestChain existing = chainMapper.selectByChainCode(chainCode);
        if (existing == null) {
            throw new BusinessException(404, "链路不存在");
        }
        nodeConfigMapper.deleteByChainCode(chainCode);
        chainMapper.deleteByChainCode(chainCode);
    }

    @Override
    public List<ChainVO> listChains(String chainName, Integer executeMode) {
        List<TestChain> chains = chainMapper.selectList(chainName, executeMode);
        return chains.stream().map(chain -> {
            ChainVO vo = buildChainVO(chain);
            vo.setNodeCount(nodeConfigMapper.countByChainCode(chain.getChainCode()));
            return vo;
        }).collect(Collectors.toList());
    }

    @Override
    public ChainVO getChainDetail(String chainCode) {
        TestChain chain = chainMapper.selectByChainCode(chainCode);
        if (chain == null) {
            throw new BusinessException(404, "链路不存在");
        }
        ChainVO vo = buildChainVO(chain);
        List<TestNodeConfig> nodes = nodeConfigMapper.selectByChainCode(chainCode);
        vo.setNodeList(nodes.stream().map(this::buildNodeVO).collect(Collectors.toList()));
        vo.setNodeCount(nodes.size());
        return vo;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ChainVO copyChain(String chainCode) {
        TestChain original = chainMapper.selectByChainCode(chainCode);
        if (original == null) {
            throw new BusinessException(404, "源链路不存在");
        }

        // Generate new chain code
        String copySuffix = "_副本";
        String newChainCode = chainCode + copySuffix;
        int copyNum = 1;
        while (chainMapper.countByChainCode(newChainCode) > 0) {
            newChainCode = chainCode + copySuffix + copyNum;
            copyNum++;
        }

        // Create new chain
        TestChain newChain = new TestChain();
        newChain.setChainCode(newChainCode);
        newChain.setChainName(original.getChainName() + copySuffix);
        newChain.setExecuteMode(original.getExecuteMode());
        newChain.setDescription(original.getDescription());
        newChain.setStatus(1);
        chainMapper.insert(newChain);

        // Copy nodes
        List<TestNodeConfig> originalNodes = nodeConfigMapper.selectByChainCode(chainCode);
        if (!originalNodes.isEmpty()) {
            List<TestNodeConfig> newNodes = new ArrayList<>();
            for (TestNodeConfig node : originalNodes) {
                TestNodeConfig newNode = new TestNodeConfig();
                newNode.setChainCode(newChainCode);
                newNode.setNodeId((long) (newNodes.size() + 1));
                newNode.setNodeCode(CodeGenerator.generateNodeCode(newChainCode, newNodes.size() + 1));
                newNode.setNodeName(node.getNodeName());
                newNode.setNodeType(node.getNodeType());
                newNode.setSortNo(node.getSortNo());
                newNode.setParallelGroup(node.getParallelGroup());
                newNode.setRequestUrl(node.getRequestUrl());
                newNode.setRequestMethod(node.getRequestMethod());
                newNode.setRequestHeaders(node.getRequestHeaders());
                newNode.setBodyType(node.getBodyType());
                newNode.setBodyData(node.getBodyData());
                newNode.setExtractRules(node.getExtractRules());
                newNode.setAssertRules(node.getAssertRules());
                newNode.setVariableMapping(node.getVariableMapping());
                newNodes.add(newNode);
            }
            nodeConfigMapper.batchInsert(newNodes);
        }

        return getChainDetail(newChainCode);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ChainVO pluginCreateChain(PluginChainCreateDTO dto) {
        // Create chain
        String chainCode = generateUniqueChainCode();
        TestChain chain = new TestChain();
        chain.setChainCode(chainCode);
        chain.setChainName(dto.getChainName());
        chain.setExecuteMode(1); // Default serial
        chain.setStatus(1);
        chainMapper.insert(chain);

        // Create nodes and identify dependencies
        List<DependencyResult> depResults = new ArrayList<>();
        List<TestNodeConfig> nodes = new ArrayList<>();
        int maxNodeId = 0;

        for (int i = 0; i < dto.getInterfaceList().size(); i++) {
            PluginInterfaceDTO iface = dto.getInterfaceList().get(i);
            TestNodeConfig node = new TestNodeConfig();
            node.setChainCode(chainCode);
            int nodeId = i + 1;
            node.setNodeId((long) nodeId);
            node.setNodeCode(CodeGenerator.generateNodeCode(chainCode, nodeId));
            node.setNodeName(iface.getNodeName() != null ? iface.getNodeName() : "节点" + nodeId);
            node.setNodeType("HTTP");
            node.setSortNo(iface.getSort() != null ? iface.getSort() : nodeId);
            node.setParallelGroup(iface.getParallelGroup());
            node.setRequestUrl(iface.getUrl());
            node.setRequestMethod(iface.getMethod());
            node.setRequestHeaders(iface.getHeaders());
            node.setBodyData(iface.getBodyData());
            nodes.add(node);

            // Identify parameter dependencies with previous nodes
            if (i > 0 && iface.getBodyData() != null && !iface.getBodyData().isEmpty()) {
                Map<String, String> requestPaths = JsonPathUtil.extractRequestBodyPaths(iface.getBodyData());
                for (int j = 0; j < i; j++) {
                    PluginInterfaceDTO prevIface = dto.getInterfaceList().get(j);
                    if (prevIface.getResponseData() != null && !prevIface.getResponseData().isEmpty()) {
                        Map<String, String> responsePaths = JsonPathUtil.extractResponseLeafPaths(prevIface.getResponseData());
                        for (Map.Entry<String, String> reqEntry : requestPaths.entrySet()) {
                            String reqFieldName = JsonPathUtil.normalizeFieldName(reqEntry.getKey());
                            for (Map.Entry<String, String> respEntry : responsePaths.entrySet()) {
                                String respFieldName = JsonPathUtil.normalizeFieldName(respEntry.getKey());
                                if (reqFieldName.equals(respFieldName) && !reqFieldName.isEmpty()) {
                                    DependencyResult dr = new DependencyResult();
                                    dr.fromNode = nodes.get(j).getNodeCode();
                                    dr.toNode = node.getNodeCode();
                                    dr.extractPath = respEntry.getKey();
                                    dr.targetPath = reqEntry.getKey();
                                    dr.matched = true;
                                    depResults.add(dr);

                                    // Generate extract rule for previous node
                                    String extractRules = nodes.get(j).getExtractRules();
                                    String varName = reqFieldName;
                                    String newRule = "{\"varName\":\"" + varName + "\",\"jsonPath\":\"" + respEntry.getKey() + "\"}";
                                    if (extractRules == null || extractRules.isEmpty()) {
                                        nodes.get(j).setExtractRules("{\"rules\":[" + newRule + "]}");
                                    } else {
                                        extractRules = extractRules.replace("]", "," + newRule + "]");
                                        nodes.get(j).setExtractRules(extractRules);
                                    }

                                    // Set placeholder in current node body
                                    String body = node.getBodyData();
                                    String placeholder = "\"${" + varName + "}\"";
                                    body = body.replace("\"" + reqEntry.getValue() + "\"", placeholder);
                                    node.setBodyData(body);
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        }

        nodeConfigMapper.batchInsert(nodes);

        ChainVO vo = getChainDetail(chainCode);
        vo.setNodeList(vo.getNodeList() != null ? vo.getNodeList() : new ArrayList<>());
        return vo;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ChainVO pluginAppendChain(PluginChainAppendDTO dto) {
        TestChain existing = chainMapper.selectByChainCode(dto.getChainCode());
        if (existing == null) {
            throw new BusinessException(404, "链路不存在");
        }

        int maxSortNo = nodeConfigMapper.getMaxSortNo(dto.getChainCode());
        int maxNodeId = nodeConfigMapper.getMaxNodeId(dto.getChainCode());

        List<TestNodeConfig> newNodes = new ArrayList<>();
        for (int i = 0; i < dto.getInterfaceList().size(); i++) {
            PluginInterfaceDTO iface = dto.getInterfaceList().get(i);
            TestNodeConfig node = new TestNodeConfig();
            node.setChainCode(dto.getChainCode());
            int nodeId = maxNodeId + i + 1;
            node.setNodeId((long) nodeId);
            node.setNodeCode(CodeGenerator.generateNodeCode(dto.getChainCode(), nodeId));
            node.setNodeName(iface.getNodeName() != null ? iface.getNodeName() : "节点" + nodeId);
            node.setNodeType("HTTP");
            node.setSortNo(maxSortNo + i + 1);
            node.setParallelGroup(iface.getParallelGroup());
            node.setRequestUrl(iface.getUrl());
            node.setRequestMethod(iface.getMethod());
            node.setRequestHeaders(iface.getHeaders());
            node.setBodyData(iface.getBodyData());
            newNodes.add(node);
        }

        nodeConfigMapper.batchInsert(newNodes);
        return getChainDetail(dto.getChainCode());
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

    private ChainVO buildChainVO(TestChain chain) {
        ChainVO vo = new ChainVO();
        vo.setChainId(chain.getId());
        vo.setChainCode(chain.getChainCode());
        vo.setChainName(chain.getChainName());
        vo.setExecuteMode(chain.getExecuteMode());
        vo.setDescription(chain.getDescription());
        vo.setCreateTime(chain.getCreateTime());
        vo.setUpdateTime(chain.getUpdateTime());
        return vo;
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
        return vo;
    }

    private static class DependencyResult {
        String fromNode;
        String toNode;
        String extractPath;
        String targetPath;
        boolean matched;
    }
}
