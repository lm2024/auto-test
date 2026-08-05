package com.autotest.model.vo;

/**
 * 调用关系图原始查询行：test_node_config 关联 test_chain 后的单条节点记录。
 */
public class CallGraphRow {
    private String chainCode;
    private String chainName;
    private String requestUrl;
    private String requestMethod;
    private String interfaceScope;
    private String targetSystem;

    public String getChainCode() { return chainCode; }
    public void setChainCode(String chainCode) { this.chainCode = chainCode; }
    public String getChainName() { return chainName; }
    public void setChainName(String chainName) { this.chainName = chainName; }
    public String getRequestUrl() { return requestUrl; }
    public void setRequestUrl(String requestUrl) { this.requestUrl = requestUrl; }
    public String getRequestMethod() { return requestMethod; }
    public void setRequestMethod(String requestMethod) { this.requestMethod = requestMethod; }
    public String getInterfaceScope() { return interfaceScope; }
    public void setInterfaceScope(String interfaceScope) { this.interfaceScope = interfaceScope; }
    public String getTargetSystem() { return targetSystem; }
    public void setTargetSystem(String targetSystem) { this.targetSystem = targetSystem; }
}
