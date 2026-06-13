package com.autotest.model.dto;

import javax.validation.constraints.NotBlank;
import java.util.List;

public class PluginChainCreateDTO {
    @NotBlank(message = "链路名称不能为空")
    private String chainName;
    private List<PluginInterfaceDTO> interfaceList;

    public String getChainName() { return chainName; }
    public void setChainName(String chainName) { this.chainName = chainName; }
    public List<PluginInterfaceDTO> getInterfaceList() { return interfaceList; }
    public void setInterfaceList(List<PluginInterfaceDTO> interfaceList) { this.interfaceList = interfaceList; }
}
