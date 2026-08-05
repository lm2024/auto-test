package com.autotest.model.vo;

import java.util.ArrayList;
import java.util.List;

/**
 * 系统调用关系图数据 VO，字段名与前端渲染契约严格对应。
 */
public class CallGraphVO {

    private List<NodeItem> nodes = new ArrayList<NodeItem>();
    private List<EdgeItem> edges = new ArrayList<EdgeItem>();
    private List<ModuleStat> statsByModule = new ArrayList<ModuleStat>();
    private List<ScopeStat> statsByScope = new ArrayList<ScopeStat>();
    private List<DomainStat> byDomain = new ArrayList<DomainStat>();
    private List<DetailItem> detail = new ArrayList<DetailItem>();

    public List<NodeItem> getNodes() { return nodes; }
    public void setNodes(List<NodeItem> nodes) { this.nodes = nodes; }
    public List<EdgeItem> getEdges() { return edges; }
    public void setEdges(List<EdgeItem> edges) { this.edges = edges; }
    public List<ModuleStat> getStatsByModule() { return statsByModule; }
    public void setStatsByModule(List<ModuleStat> statsByModule) { this.statsByModule = statsByModule; }
    public List<ScopeStat> getStatsByScope() { return statsByScope; }
    public void setStatsByScope(List<ScopeStat> statsByScope) { this.statsByScope = statsByScope; }
    public List<DomainStat> getByDomain() { return byDomain; }
    public void setByDomain(List<DomainStat> byDomain) { this.byDomain = byDomain; }
    public List<DetailItem> getDetail() { return detail; }
    public void setDetail(List<DetailItem> detail) { this.detail = detail; }

    /**
     * 图节点：中心节点 SUT 或某个目标系统
     */
    public static class NodeItem {
        private String id;
        private String name;
        private String scope;
        private String category;

        public NodeItem() {
        }

        public NodeItem(String id, String name, String scope, String category) {
            this.id = id;
            this.name = name;
            this.scope = scope;
            this.category = category;
        }

        public String getId() { return id; }
        public void setId(String id) { this.id = id; }
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public String getScope() { return scope; }
        public void setScope(String scope) { this.scope = scope; }
        public String getCategory() { return category; }
        public void setCategory(String category) { this.category = category; }
    }

    /**
     * 图连线：由被测系统指向目标系统
     */
    public static class EdgeItem {
        private String source;
        private String target;
        private Integer count;

        public EdgeItem() {
        }

        public EdgeItem(String source, String target, Integer count) {
            this.source = source;
            this.target = target;
            this.count = count;
        }

        public String getSource() { return source; }
        public void setSource(String source) { this.source = source; }
        public String getTarget() { return target; }
        public void setTarget(String target) { this.target = target; }
        public Integer getCount() { return count; }
        public void setCount(Integer count) { this.count = count; }
    }

    /**
     * 按目标系统聚合的调用量
     */
    public static class ModuleStat {
        private String module;
        private Integer count;

        public ModuleStat() {
        }

        public ModuleStat(String module, Integer count) {
            this.module = module;
            this.count = count;
        }

        public String getModule() { return module; }
        public void setModule(String module) { this.module = module; }
        public Integer getCount() { return count; }
        public void setCount(Integer count) { this.count = count; }
    }

    /**
     * 按内外网范围聚合的调用量
     */
    public static class ScopeStat {
        private String scope;
        private Integer count;

        public ScopeStat() {
        }

        public ScopeStat(String scope, Integer count) {
            this.scope = scope;
            this.count = count;
        }

        public String getScope() { return scope; }
        public void setScope(String scope) { this.scope = scope; }
        public Integer getCount() { return count; }
        public void setCount(Integer count) { this.count = count; }
    }

    /**
     * 按域名聚合的调用量
     */
    public static class DomainStat {
        private String domain;
        private String scope;
        private String systemName;
        private Integer count;

        public DomainStat() {
        }

        public DomainStat(String domain, String scope, String systemName, Integer count) {
            this.domain = domain;
            this.scope = scope;
            this.systemName = systemName;
            this.count = count;
        }

        public String getDomain() { return domain; }
        public void setDomain(String domain) { this.domain = domain; }
        public String getScope() { return scope; }
        public void setScope(String scope) { this.scope = scope; }
        public String getSystemName() { return systemName; }
        public void setSystemName(String systemName) { this.systemName = systemName; }
        public Integer getCount() { return count; }
        public void setCount(Integer count) { this.count = count; }
    }

    /**
     * 调用明细行
     */
    public static class DetailItem {
        private String chainCode;
        private String chainName;
        private String targetSystem;
        private String method;
        private String url;
        private String scope;
        private Integer count;

        public String getChainCode() { return chainCode; }
        public void setChainCode(String chainCode) { this.chainCode = chainCode; }
        public String getChainName() { return chainName; }
        public void setChainName(String chainName) { this.chainName = chainName; }
        public String getTargetSystem() { return targetSystem; }
        public void setTargetSystem(String targetSystem) { this.targetSystem = targetSystem; }
        public String getMethod() { return method; }
        public void setMethod(String method) { this.method = method; }
        public String getUrl() { return url; }
        public void setUrl(String url) { this.url = url; }
        public String getScope() { return scope; }
        public void setScope(String scope) { this.scope = scope; }
        public Integer getCount() { return count; }
        public void setCount(Integer count) { this.count = count; }
    }
}
