package com.autotest.service.impl;

import com.autotest.mapper.CallGraphMapper;
import com.autotest.model.entity.SysSystemRegistry;
import com.autotest.model.vo.CallGraphRow;
import com.autotest.model.vo.CallGraphVO;
import com.autotest.model.vo.ClassifyResult;
import com.autotest.service.CallGraphService;
import com.autotest.service.SystemRegistryService;
import com.autotest.util.InterfaceClassifier;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 系统调用关系图服务实现：以被测系统 SUT 为中心，聚合各链路节点指向的外部/内部系统。
 * 节点未落库分类（interface_scope 为空）时现场调用 InterfaceClassifier 补齐。
 */
@Service
public class CallGraphServiceImpl implements CallGraphService {

    private static final String SUT_ID = "SUT";
    private static final String SUT_NAME = "被测系统";
    private static final String UNKNOWN_DOMAIN = "UNKNOWN";
    private static final String UNKNOWN_SYSTEM = "未知系统";

    @Autowired
    private CallGraphMapper callGraphMapper;

    @Autowired
    private InterfaceClassifier interfaceClassifier;

    @Autowired
    private SystemRegistryService systemRegistryService;

    @Override
    public CallGraphVO buildCallGraph(String chainCode) {
        return buildCallGraph(chainCode, null, null, null, null, 1, 20, 200);
    }

    @Override
    public CallGraphVO buildCallGraph(String chainCode, String keyword, String scope, String method,
                                      String category, Integer pageNo, Integer pageSize, Integer maxNodes) {
        int safePageNo = pageNo == null || pageNo < 1 ? 1 : pageNo;
        int safePageSize = pageSize == null || pageSize < 1 ? 20 : Math.min(pageSize, 100);
        int safeMaxNodes = maxNodes == null || maxNodes < 20 ? 200 : Math.min(maxNodes, 500);
        String normalizedScope = isBlank(scope) ? null : scope.trim().toUpperCase();
        String normalizedMethod = isBlank(method) ? null : method.trim().toUpperCase();
        String normalizedKeyword = isBlank(keyword) ? null : keyword.trim();
        String normalizedCategory = isBlank(category) ? null : category.trim();

        CallGraphVO vo = new CallGraphVO();
        vo.getNodes().add(new CallGraphVO.NodeItem(SUT_ID, SUT_NAME, "SUT", null));

        int totalRows = callGraphMapper.countCallRows(chainCode, normalizedKeyword, normalizedScope, normalizedMethod, normalizedCategory);
        List<CallGraphRow> detailRows = callGraphMapper.selectCallRows(
                chainCode, normalizedKeyword, normalizedScope, normalizedMethod, normalizedCategory,
                (safePageNo - 1) * safePageSize, safePageSize);
        List<CallGraphRow> graphRows = callGraphMapper.selectGraphRows(
                chainCode, normalizedKeyword, normalizedScope, normalizedMethod, normalizedCategory, safeMaxNodes);
        vo.setTotalRows(Integer.valueOf(totalRows));
        vo.setTotalSystems(Integer.valueOf(callGraphMapper.countDistinctSystems(chainCode, normalizedKeyword, normalizedScope, normalizedMethod, normalizedCategory)));
        vo.setPageNo(Integer.valueOf(safePageNo));
        vo.setPageSize(Integer.valueOf(safePageSize));
        vo.setGraphTruncated(Boolean.valueOf(totalRows > safeMaxNodes));

        fillDatabaseStats(vo, chainCode, normalizedKeyword, normalizedScope, normalizedMethod, normalizedCategory);
        if (graphRows == null || graphRows.isEmpty()) {
            vo.setDetail(new ArrayList<CallGraphVO.DetailItem>());
            return vo;
        }

        Map<String, String> categoryMap = buildCategoryMap();
        Map<String, SystemAgg> systemMap = new LinkedHashMap<String, SystemAgg>();
        Map<String, DomainAgg> domainMap = new LinkedHashMap<String, DomainAgg>();
        Map<String, Integer> scopeMap = new LinkedHashMap<String, Integer>();
        Map<String, CallGraphVO.DetailItem> detailMap = new LinkedHashMap<String, CallGraphVO.DetailItem>();

        for (CallGraphRow row : graphRows) {
            String url = row.getRequestUrl();
            String host = interfaceClassifier.extractHost(url);
            ClassifyResult classified = interfaceClassifier.classify(url);

            String scopeName = isBlank(row.getInterfaceScope())
                    ? classified.getScope() : row.getInterfaceScope().trim().toUpperCase();
            if (isBlank(scopeName)) {
                scopeName = InterfaceClassifier.SCOPE_UNKNOWN;
            }

            String systemCode = classified.getSystemCode();
            String displayName = resolveSystemName(row, classified, host);
            String nodeId = "SYS_" + (isBlank(systemCode) ? sanitize(host != null ? host : displayName) : systemCode);
            String categoryValue = isBlank(row.getCategory()) ? (isBlank(systemCode) ? null : categoryMap.get(systemCode)) : row.getCategory();

            SystemAgg systemAgg = systemMap.get(nodeId);
            if (systemAgg == null) {
                systemAgg = new SystemAgg(nodeId, displayName, scopeName, categoryValue);
                systemMap.put(nodeId, systemAgg);
            }
            systemAgg.count++;

            String domainKey = host == null ? UNKNOWN_DOMAIN : host;
            DomainAgg domainAgg = domainMap.get(domainKey);
            if (domainAgg == null) {
                domainAgg = new DomainAgg(domainKey, scope, displayName);
                domainMap.put(domainKey, domainAgg);
            }
            domainAgg.count++;

            Integer scopeCount = scopeMap.get(scopeName);
            scopeMap.put(scopeName, Integer.valueOf(scopeCount == null ? 1 : scopeCount.intValue() + 1));

        }
        if (detailRows != null) {
            for (CallGraphRow row : detailRows) {
                String host = interfaceClassifier.extractHost(row.getRequestUrl());
                ClassifyResult classified = interfaceClassifier.classify(row.getRequestUrl());
                String detailScope = isBlank(row.getInterfaceScope()) ? classified.getScope() : row.getInterfaceScope().trim().toUpperCase();
                accumulateDetail(detailMap, row, resolveSystemName(row, classified, host), isBlank(detailScope) ? InterfaceClassifier.SCOPE_UNKNOWN : detailScope);
            }
        }

        fillNodesAndEdges(vo, systemMap);
        fillByDomain(vo, domainMap);
        fillDetail(vo, detailMap);
        return vo;
    }

    private void fillDatabaseStats(CallGraphVO vo, String chainCode, String keyword, String scope, String method, String category) {
        vo.setStatsByScope(toScopeStats(callGraphMapper.selectScopeStats(chainCode, keyword, scope, method, category)));
        vo.setStatsByMethod(toDimensionStats(callGraphMapper.selectMethodStats(chainCode, keyword, scope, method, category)));
        vo.setStatsByChain(toDimensionStats(callGraphMapper.selectChainStats(chainCode, keyword, scope, method, category)));
        vo.setStatsByModule(toModuleStats(callGraphMapper.selectSystemStats(chainCode, keyword, scope, method, category)));
    }

    private List<CallGraphVO.DimensionStat> toDimensionStats(List<Map<String, Object>> rows) {
        List<CallGraphVO.DimensionStat> result = new ArrayList<CallGraphVO.DimensionStat>();
        if (rows != null) for (Map<String, Object> row : rows) {
            result.add(new CallGraphVO.DimensionStat(String.valueOf(row.get("name")), ((Number) row.get("count")).intValue()));
        }
        return result;
    }

    private List<CallGraphVO.ModuleStat> toModuleStats(List<Map<String, Object>> rows) {
        List<CallGraphVO.ModuleStat> result = new ArrayList<CallGraphVO.ModuleStat>();
        if (rows != null) for (Map<String, Object> row : rows) {
            result.add(new CallGraphVO.ModuleStat(String.valueOf(row.get("name")), ((Number) row.get("count")).intValue()));
        }
        return result;
    }

    private List<CallGraphVO.ScopeStat> toScopeStats(List<Map<String, Object>> rows) {
        List<CallGraphVO.ScopeStat> result = new ArrayList<CallGraphVO.ScopeStat>();
        if (rows != null) for (Map<String, Object> row : rows) {
            result.add(new CallGraphVO.ScopeStat(String.valueOf(row.get("name")), ((Number) row.get("count")).intValue()));
        }
        return result;
    }

    /**
     * 明细按 链路+方法+URL+范围 聚合
     */
    private void accumulateDetail(Map<String, CallGraphVO.DetailItem> detailMap, CallGraphRow row,
                                  String displayName, String scope) {
        String method = isBlank(row.getRequestMethod()) ? "GET" : row.getRequestMethod().trim().toUpperCase();
        String key = row.getChainCode() + "|" + method + "|" + row.getRequestUrl() + "|" + scope + "|" + displayName;
        CallGraphVO.DetailItem detail = detailMap.get(key);
        if (detail == null) {
            detail = new CallGraphVO.DetailItem();
            detail.setChainCode(row.getChainCode());
            detail.setChainName(row.getChainName());
            detail.setTargetSystem(displayName);
            detail.setMethod(method);
            detail.setUrl(row.getRequestUrl());
            detail.setScope(scope);
            detail.setCount(Integer.valueOf(0));
            detailMap.put(key, detail);
        }
        detail.setCount(Integer.valueOf(detail.getCount().intValue() + 1));
    }

    private void fillNodesAndEdges(CallGraphVO vo, Map<String, SystemAgg> systemMap) {
        List<SystemAgg> systems = new ArrayList<SystemAgg>(systemMap.values());
        systems.sort(new Comparator<SystemAgg>() {
            @Override
            public int compare(SystemAgg a, SystemAgg b) {
                return b.count - a.count;
            }
        });
        for (SystemAgg agg : systems) {
            vo.getNodes().add(new CallGraphVO.NodeItem(agg.nodeId, agg.name, agg.scope, agg.category));
            vo.getEdges().add(new CallGraphVO.EdgeItem(SUT_ID, agg.nodeId, Integer.valueOf(agg.count)));
        }
    }

    private void fillStatsByModule(CallGraphVO vo, Map<String, SystemAgg> systemMap) {
        Map<String, Integer> moduleMap = new LinkedHashMap<String, Integer>();
        for (SystemAgg agg : systemMap.values()) {
            Integer current = moduleMap.get(agg.name);
            moduleMap.put(agg.name, Integer.valueOf(current == null ? agg.count : current.intValue() + agg.count));
        }
        List<CallGraphVO.ModuleStat> stats = new ArrayList<CallGraphVO.ModuleStat>();
        for (Map.Entry<String, Integer> entry : moduleMap.entrySet()) {
            stats.add(new CallGraphVO.ModuleStat(entry.getKey(), entry.getValue()));
        }
        stats.sort(new Comparator<CallGraphVO.ModuleStat>() {
            @Override
            public int compare(CallGraphVO.ModuleStat a, CallGraphVO.ModuleStat b) {
                return b.getCount().intValue() - a.getCount().intValue();
            }
        });
        vo.setStatsByModule(stats);
    }

    private void fillStatsByScope(CallGraphVO vo, Map<String, Integer> scopeMap) {
        List<CallGraphVO.ScopeStat> stats = new ArrayList<CallGraphVO.ScopeStat>();
        for (Map.Entry<String, Integer> entry : scopeMap.entrySet()) {
            stats.add(new CallGraphVO.ScopeStat(entry.getKey(), entry.getValue()));
        }
        stats.sort(new Comparator<CallGraphVO.ScopeStat>() {
            @Override
            public int compare(CallGraphVO.ScopeStat a, CallGraphVO.ScopeStat b) {
                return b.getCount().intValue() - a.getCount().intValue();
            }
        });
        vo.setStatsByScope(stats);
    }

    private void fillByDomain(CallGraphVO vo, Map<String, DomainAgg> domainMap) {
        List<CallGraphVO.DomainStat> stats = new ArrayList<CallGraphVO.DomainStat>();
        for (DomainAgg agg : domainMap.values()) {
            stats.add(new CallGraphVO.DomainStat(agg.domain, agg.scope, agg.systemName, Integer.valueOf(agg.count)));
        }
        stats.sort(new Comparator<CallGraphVO.DomainStat>() {
            @Override
            public int compare(CallGraphVO.DomainStat a, CallGraphVO.DomainStat b) {
                return b.getCount().intValue() - a.getCount().intValue();
            }
        });
        vo.setByDomain(stats);
    }

    private void fillDetail(CallGraphVO vo, Map<String, CallGraphVO.DetailItem> detailMap) {
        vo.setDetail(new ArrayList<CallGraphVO.DetailItem>(detailMap.values()));
    }

    /**
     * systemCode -> category，用于给图节点补分类标签
     */
    private Map<String, String> buildCategoryMap() {
        Map<String, String> map = new LinkedHashMap<String, String>();
        List<SysSystemRegistry> registries = systemRegistryService.listAll();
        for (SysSystemRegistry registry : registries) {
            if (!isBlank(registry.getSystemCode())) {
                map.put(registry.getSystemCode(), registry.getCategory());
            }
        }
        return map;
    }

    /**
     * 目标系统展示名：优先节点落库值，其次分类结果，再次域名
     */
    private String resolveSystemName(CallGraphRow row, ClassifyResult classified, String host) {
        if (!isBlank(row.getTargetSystem())) {
            return row.getTargetSystem().trim();
        }
        if (classified != null && !isBlank(classified.getSystemName())) {
            return classified.getSystemName();
        }
        if (host != null && !host.isEmpty()) {
            return host;
        }
        return UNKNOWN_SYSTEM;
    }

    /**
     * 节点 id 片段规范化：非字母数字替换为下划线
     */
    private String sanitize(String text) {
        if (isBlank(text)) {
            return UNKNOWN_DOMAIN;
        }
        return text.trim().replaceAll("[^a-zA-Z0-9]", "_");
    }

    private boolean isBlank(String text) {
        return text == null || text.trim().isEmpty();
    }

    /**
     * 目标系统聚合中间结构
     */
    private static class SystemAgg {
        private final String nodeId;
        private final String name;
        private final String scope;
        private final String category;
        private int count;

        SystemAgg(String nodeId, String name, String scope, String category) {
            this.nodeId = nodeId;
            this.name = name;
            this.scope = scope;
            this.category = category;
        }
    }

    /**
     * 域名聚合中间结构
     */
    private static class DomainAgg {
        private final String domain;
        private final String scope;
        private final String systemName;
        private int count;

        DomainAgg(String domain, String scope, String systemName) {
            this.domain = domain;
            this.scope = scope;
            this.systemName = systemName;
        }
    }
}
