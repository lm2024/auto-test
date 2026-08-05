package com.autotest.model.vo;

/**
 * 接口内外网分类结果 VO。
 * scope 取值：INTERNAL / EXTERNAL / UNKNOWN
 */
public class ClassifyResult {
    private String scope;
    private String systemCode;
    private String systemName;

    public ClassifyResult() {
    }

    public ClassifyResult(String scope, String systemCode, String systemName) {
        this.scope = scope;
        this.systemCode = systemCode;
        this.systemName = systemName;
    }

    public String getScope() { return scope; }
    public void setScope(String scope) { this.scope = scope; }
    public String getSystemCode() { return systemCode; }
    public void setSystemCode(String systemCode) { this.systemCode = systemCode; }
    public String getSystemName() { return systemName; }
    public void setSystemName(String systemName) { this.systemName = systemName; }
}
