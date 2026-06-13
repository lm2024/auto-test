package com.autotest.model.dto;

import javax.validation.constraints.NotBlank;
import java.util.List;

public class PluginChainAppendDTO {
    @NotBlank(message = "链路编码不能为空")
    private String chainCode;
    private List<PluginInterfaceDTO> interfaceList;

    public String getChainCode() { return chainCode; }
    public void setChainCode(String chainCode) { this.chainCode = chainCode; }
    public List<PluginInterfaceDTO> getInterfaceList() { return interfaceList; }
    public void setInterfaceList(List<PluginInterfaceDTO> interfaceList) { this.interfaceList = interfaceList; }
}
