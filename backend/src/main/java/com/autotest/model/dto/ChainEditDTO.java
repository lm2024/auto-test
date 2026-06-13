package com.autotest.model.dto;

import javax.validation.constraints.NotBlank;

public class ChainEditDTO {
    private Long id;
    @NotBlank(message = "链路编码不能为空")
    private String chainCode;
    private String chainName;
    private Integer executeMode;
    private String description;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getChainCode() { return chainCode; }
    public void setChainCode(String chainCode) { this.chainCode = chainCode; }
    public String getChainName() { return chainName; }
    public void setChainName(String chainName) { this.chainName = chainName; }
    public Integer getExecuteMode() { return executeMode; }
    public void setExecuteMode(Integer executeMode) { this.executeMode = executeMode; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
}
