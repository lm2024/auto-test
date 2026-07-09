package com.autotest.model.dto;

import java.util.List;

public class NodeImportDTO {
    private String chainCode;
    private List<PluginInterfaceDTO> interfaces;

    public String getChainCode() { return chainCode; }
    public void setChainCode(String chainCode) { this.chainCode = chainCode; }
    public List<PluginInterfaceDTO> getInterfaces() { return interfaces; }
    public void setInterfaces(List<PluginInterfaceDTO> interfaces) { this.interfaces = interfaces; }
}
