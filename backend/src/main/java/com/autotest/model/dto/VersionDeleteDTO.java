package com.autotest.model.dto;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;

public class VersionDeleteDTO {
    @NotBlank(message = "链路编码不能为空")
    private String chainCode;
    @NotNull(message = "版本号不能为空")
    private Integer version;

    public String getChainCode() { return chainCode; }
    public void setChainCode(String chainCode) { this.chainCode = chainCode; }
    public Integer getVersion() { return version; }
    public void setVersion(Integer version) { this.version = version; }
}
