package com.autotest.model.dto;

import javax.validation.constraints.NotBlank;

public class ChainCreateDTO {
    @NotBlank(message = "链路名称不能为空")
    private String chainName;
    private String chainCode;
    private Integer executeMode = 1;
    private String description;

    public String getChainName() { return chainName; }
    public void setChainName(String chainName) { this.chainName = chainName; }
    public String getChainCode() { return chainCode; }
    public void setChainCode(String chainCode) { this.chainCode = chainCode; }
    public Integer getExecuteMode() { return executeMode; }
    public void setExecuteMode(Integer executeMode) { this.executeMode = executeMode; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
}
