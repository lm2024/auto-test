package com.autotest.model.dto;

public class TestDataGenerateDTO {
    private String chainCode;
    private String idGenerateMode = "AUTO_INCREMENT";
    private Integer idStep = 1;
    private Long customStartId;

    public String getChainCode() { return chainCode; }
    public void setChainCode(String chainCode) { this.chainCode = chainCode; }
    public String getIdGenerateMode() { return idGenerateMode; }
    public void setIdGenerateMode(String idGenerateMode) { this.idGenerateMode = idGenerateMode; }
    public Integer getIdStep() { return idStep; }
    public void setIdStep(Integer idStep) { this.idStep = idStep; }
    public Long getCustomStartId() { return customStartId; }
    public void setCustomStartId(Long customStartId) { this.customStartId = customStartId; }
}
