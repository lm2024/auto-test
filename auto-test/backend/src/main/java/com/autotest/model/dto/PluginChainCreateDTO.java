package com.autotest.model.dto;

import javax.validation.constraints.NotBlank;
import java.util.List;

public class PluginChainCreateDTO {
    @NotBlank(message = "链路名称不能为空")
    private String chainName;
    private Long tenantId;
    private String productCode;
    private Long categoryId;
    private List<PluginInterfaceDTO> interfaceList;

    public String getChainName() { return chainName; }
    public void setChainName(String chainName) { this.chainName = chainName; }
    public Long getTenantId() { return tenantId; }
    public void setTenantId(Long tenantId) { this.tenantId = tenantId; }
    public String getProductCode() { return productCode; }
    public void setProductCode(String productCode) { this.productCode = productCode; }
    public Long getCategoryId() { return categoryId; }
    public void setCategoryId(Long categoryId) { this.categoryId = categoryId; }
    public List<PluginInterfaceDTO> getInterfaceList() { return interfaceList; }
    public void setInterfaceList(List<PluginInterfaceDTO> interfaceList) { this.interfaceList = interfaceList; }
}
