package com.autotest.service.impl;

import com.autotest.exception.BusinessException;
import com.autotest.mapper.TestChainMapper;
import com.autotest.mapper.TestNodeConfigMapper;
import com.autotest.mapper.SysProductMapper;
import com.autotest.model.dto.*;
import com.autotest.model.entity.SysProduct;
import com.autotest.model.entity.TestChain;
import com.autotest.model.entity.TestNodeConfig;
import com.autotest.model.vo.ChainVO;
import com.autotest.model.vo.NodeVO;
import com.autotest.service.ChainService;
import com.autotest.service.NodeConfigService;
import com.autotest.model.vo.ClassifyResult;
import com.autotest.util.CodeGenerator;
import com.autotest.util.DagPlanner;
import com.autotest.util.GraphDataBuilder;
import com.autotest.util.InterfaceClassifier;
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

    @Autowired
    private SysProductMapper productMapper;

    @Autowired
    private InterfaceClassifier interfaceClassifier;

    /**
     * 按 URL 自动填充节点的内外网范围与归属系统，识别失败不影响主流程
     */
    private void applyClassification(TestNodeConfig node) {
        try {
            ClassifyResult result = interfaceClassifier.classify(node.getRequestUrl());
            if (result != null) {
                node.setInterfaceScope(result.getScope());
                node.setTargetSystem(result.getSystemCode());
            }
        } catch (Exception e) {
            log.warn("[Chain] 接口内外网识别失败: url={}, {}", node.getRequestUrl(), e.getMessage());
        }
    }

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
        // 自动设置 tenantId
        if (chain.getTenantId() == null) {
            chain.setTenantId(com.autotest.context.TenantContext.getTenantId());
        }
        if (dto.getCategoryId() != null) chain.setCategoryId(dto.getCategoryId());
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
        if (dto.getAccountCode() != null) chain.setAccountCode(dto.getAccountCode());
        if (dto.getSystemCategory() != null) chain.setSystemCategory(dto.getSystemCategory());
        if (dto.getFuncCategory() != null) chain.setFuncCategory(dto.getFuncCategory());
        if (dto.getPriority() != null) chain.setPriority(dto.getPriority());
        if (dto.getCategoryId() != null) chain.setCategoryId(dto.getCategoryId());
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
    public List<ChainVO> listChainsByCategory(String chainName, Integer executeMode,
                                               List<String> systemCategories, List<String> funcCategories, Integer priority,
                                               List<Long> categoryIds, int offset, int pageSize) {
        List<TestChain> chains = chainMapper.selectListByCategory(chainName, executeMode, systemCategories, funcCategories, priority, categoryIds, offset, pageSize);
        return chains.stream().map(chain -> {
            ChainVO vo = buildChainVO(chain);
            vo.setNodeCount(nodeConfigMapper.countByChainCode(chain.getChainCode()));
            return vo;
        }).collect(Collectors.toList());
    }

    @Override
    public int countChainsByCategory(String chainName, Integer executeMode,
                                      List<String> systemCategories, List<String> funcCategories, Integer priority,
                                      List<Long> categoryIds) {
        return chainMapper.countByCategory(chainName, executeMode, systemCategories, funcCategories, priority, categoryIds);
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
        // 详情接口才带画布数据；老库可能为空，此时按节点顺序生成一份线性画布兜底
        String graph = chain.getGraphData();
        if (graph == null || graph.trim().isEmpty()) {
            graph = GraphDataBuilder.buildLinear(nodes);
        }
        vo.setGraphData(graph);
        return vo;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public List<List<String>> saveGraph(String chainCode, String graphData) {
        TestChain existing = chainMapper.selectByChainCode(chainCode);
        if (existing == null) {
            throw new BusinessException(404, "链路不存在");
        }
        String graph = (graphData == null || graphData.trim().isEmpty())
                ? "{\"cells\":[]}" : graphData.trim();

        // 落库前先跑一次拓扑排序，环形依赖直接拒绝，避免把坏画布写进库
        List<TestNodeConfig> nodes = nodeConfigMapper.selectByChainCode(chainCode);
        List<List<String>> layers = toCodeLayers(DagPlanner.planLayers(graph, nodes));

        TestChain update = new TestChain();
        update.setChainCode(chainCode);
        update.setGraphData(graph);
        chainMapper.update(update);
        return layers;
    }

    @Override
    public List<List<String>> previewLayers(String chainCode) {
        TestChain chain = chainMapper.selectByChainCode(chainCode);
        if (chain == null) {
            throw new BusinessException(404, "链路不存在");
        }
        List<TestNodeConfig> nodes = nodeConfigMapper.selectByChainCode(chainCode);
        return toCodeLayers(DagPlanner.planLayers(chain.getGraphData(), nodes));
    }

    private List<List<String>> toCodeLayers(List<List<TestNodeConfig>> layers) {
        List<List<String>> result = new ArrayList<>();
        for (List<TestNodeConfig> layer : layers) {
            result.add(layer.stream().map(TestNodeConfig::getNodeCode).collect(Collectors.toList()));
        }
        return result;
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
        newChain.setGraphData(original.getGraphData());
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
        if (dto.getTenantId() == null) {
            throw new BusinessException(400, "请选择租户后再推送");
        }
        if (dto.getInterfaceList() == null || dto.getInterfaceList().isEmpty()) {
            throw new BusinessException(400, "至少选择一个接口后再推送");
        }
        if (dto.getProductCode() != null && !dto.getProductCode().trim().isEmpty()) {
            SysProduct product = productMapper.selectByProductCode(dto.getProductCode().trim());
            if (product == null || !dto.getTenantId().equals(product.getTenantId()) || product.getStatus() == null || product.getStatus() != 1) {
                throw new BusinessException(400, "所选产品不存在或已停用，请重新选择产品");
            }
        }
        // Create chain
        String chainCode = generateUniqueChainCode();
        TestChain chain = new TestChain();
        chain.setChainCode(chainCode);
        chain.setChainName(dto.getChainName());
        chain.setExecuteMode(1); // Default serial
        chain.setStatus(1);
        // 设置租户、产品、分类
        chain.setTenantId(dto.getTenantId());
        chain.setProductCode(dto.getProductCode());
        chain.setCategoryId(dto.getCategoryId());
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
            node.setNodeType("MACRO".equals(iface.getMethod()) ? "MACRO" : "HTTP");
            node.setRequestUrl(iface.getUrl());
            node.setRequestMethod(iface.getMethod());
            node.setRequestHeaders(iface.getHeaders());
            node.setBodyData(iface.getBodyData());
            // 阶段二：透传 TraceId 等新字段
            node.setBizOperTraceId(iface.getBizOperTraceId());
            node.setTriggerEvent(iface.getTriggerEvent());
            node.setTargetDom(iface.getTargetDom());
            node.setPageUrl(iface.getPageUrl());
            node.setWindowId(iface.getWindowId());
            node.setIsIgnored(iface.getIsIgnored() != null && iface.getIsIgnored() ? 1 : 0);
            applyClassification(node);
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

        // 录制顺序即初始执行顺序：自动生成一条线性 DAG 画布
        TestChain graphUpdate = new TestChain();
        graphUpdate.setChainCode(chainCode);
        graphUpdate.setGraphData(GraphDataBuilder.buildLinear(nodes));
        chainMapper.update(graphUpdate);

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
            node.setRequestUrl(iface.getUrl());
            node.setRequestMethod(iface.getMethod());
            node.setRequestHeaders(iface.getHeaders());
            node.setBodyData(iface.getBodyData());
            node.setBizOperTraceId(iface.getBizOperTraceId());
            node.setTriggerEvent(iface.getTriggerEvent());
            node.setTargetDom(iface.getTargetDom());
            node.setPageUrl(iface.getPageUrl());
            node.setWindowId(iface.getWindowId());
            node.setIsIgnored(iface.getIsIgnored() != null && iface.getIsIgnored() ? 1 : 0);
            applyClassification(node);
            newNodes.add(node);
        }

        nodeConfigMapper.batchInsert(newNodes);

        // 追加节点接到原画布末尾
        TestChain graphUpdate = new TestChain();
        graphUpdate.setChainCode(dto.getChainCode());
        graphUpdate.setGraphData(GraphDataBuilder.appendLinear(existing.getGraphData(), newNodes));
        chainMapper.update(graphUpdate);

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
        vo.setBizOperTraceId(chain.getBizOperTraceId());
        vo.setAccountCode(chain.getAccountCode());
        vo.setSystemCategory(chain.getSystemCategory());
        vo.setFuncCategory(chain.getFuncCategory());
        vo.setPriority(chain.getPriority());
        vo.setCategoryId(chain.getCategoryId());
        return vo;
    }

    private NodeVO buildNodeVO(TestNodeConfig node) {
        NodeVO vo = new NodeVO();
        vo.setId(node.getId());
        vo.setNodeId(node.getNodeId());
        vo.setNodeCode(node.getNodeCode());
        vo.setNodeName(node.getNodeName());
        vo.setNodeType(node.getNodeType());
        vo.setInterfaceScope(node.getInterfaceScope());
        vo.setTargetSystem(node.getTargetSystem());
        vo.setRequestUrl(node.getRequestUrl());
        vo.setRequestMethod(node.getRequestMethod());
        vo.setRequestHeaders(node.getRequestHeaders());
        vo.setBodyType(node.getBodyType());
        vo.setBodyData(node.getBodyData());
        vo.setExtractRules(node.getExtractRules());
        vo.setAssertRules(node.getAssertRules());
        vo.setVariableMapping(node.getVariableMapping());
        vo.setBizOperTraceId(node.getBizOperTraceId());
        vo.setTriggerEvent(node.getTriggerEvent());
        vo.setTargetDom(node.getTargetDom());
        vo.setPageUrl(node.getPageUrl());
        vo.setWindowId(node.getWindowId());
        vo.setIsIgnored(node.getIsIgnored());
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
