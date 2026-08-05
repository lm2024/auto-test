package com.autotest.service;

import com.autotest.model.entity.SysSystemRegistry;
import com.autotest.model.vo.ClassifyResult;

import java.util.List;

/**
 * 系统注册表服务接口，提供注册系统维护与 URL 内外网分类能力。
 */
public interface SystemRegistryService {

    List<SysSystemRegistry> listAll();

    /**
     * 保存系统注册信息，id 为空则新增，否则更新，返回保存后的行
     */
    SysSystemRegistry saveRegistry(SysSystemRegistry registry);

    void deleteRegistry(Long id);

    /**
     * 对 URL 做内外网与归属系统分类
     */
    ClassifyResult classify(String url);
}
