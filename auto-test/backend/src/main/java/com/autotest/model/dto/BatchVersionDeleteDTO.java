package com.autotest.model.dto;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;

public class BatchVersionDeleteDTO {
    @NotBlank(message = "链路编码不能为空")
    private String chainCode;
    @NotNull(message = "版本号不能为空")
    private Integer beforeVersion;

    public String getChainCode() { return chainCode; }
    public void setChainCode(String chainCode) { this.chainCode = chainCode; }
    public Integer getBeforeVersion() { return beforeVersion; }
    public void setBeforeVersion(Integer beforeVersion) { this.beforeVersion = beforeVersion; }
}
