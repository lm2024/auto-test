package com.autotest.service;

import com.autotest.model.dto.AccountCreateDTO;
import com.autotest.model.entity.TestAccount;

import java.util.List;

/**
 * 测试账号管理服务接口
 */
public interface AccountService {

    /**
     * 创建测试账号（密码自动加密存储）
     */
    TestAccount createAccount(AccountCreateDTO dto);

    /**
     * 更新测试账号
     */
    TestAccount updateAccount(Long id, AccountCreateDTO dto);

    /**
     * 删除测试账号
     */
    void deleteAccount(Long id);

    /**
     * 获取账号详情（密码自动解密）
     */
    TestAccount getAccount(Long id);

    /**
     * 查询账号列表
     */
    List<TestAccount> listAccounts(String systemName, Integer status, int offset, int pageSize);

    /**
     * 查询账号总数
     */
    int countAccounts(String systemName, Integer status);

    /**
     * 获取并锁定可用账号
     * @param accountCode 账号编码
     * @return 锁定成功的账号（密码已解密）
     */
    TestAccount acquireAccount(String accountCode);

    /**
     * 释放账号锁定
     */
    void releaseAccount(String accountCode);

    /**
     * 批量锁定账号
     * @param accountCode 账号编码
     * @param minutes 锁定时长（分钟）
     */
    void batchLock(String accountCode, int minutes);
}