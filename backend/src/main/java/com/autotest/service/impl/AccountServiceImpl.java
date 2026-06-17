package com.autotest.service.impl;

import com.autotest.exception.BusinessException;
import com.autotest.mapper.TestAccountMapper;
import com.autotest.model.dto.AccountCreateDTO;
import com.autotest.model.entity.TestAccount;
import com.autotest.service.AccountService;
import com.autotest.util.AESUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Date;
import java.util.List;

/**
 * 测试账号管理服务实现
 */
@Service
public class AccountServiceImpl implements AccountService {

    private static final Logger log = LoggerFactory.getLogger(AccountServiceImpl.class);

    @Autowired
    private TestAccountMapper accountMapper;

    @Value("${account.aes-key:autotest_default_}")
    private String aesKey;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public TestAccount createAccount(AccountCreateDTO dto) {
        if (accountMapper.selectByAccountCode(dto.getAccountCode()) != null) {
            throw new BusinessException(409, "账号编码已存在: " + dto.getAccountCode());
        }

        TestAccount account = new TestAccount();
        account.setAccountCode(dto.getAccountCode());
        account.setAccountName(dto.getAccountName());
        account.setSystemName(dto.getSystemName());
        account.setUsername(dto.getUsername());
        // 密码加密存储
        account.setPassword(AESUtil.encrypt(dto.getPassword(), aesKey));
        account.setAuthType(dto.getAuthType() != null ? dto.getAuthType() : "PASSWORD");
        account.setAuthConfig(dto.getAuthConfig());
        account.setStatus(1); // 默认可用

        accountMapper.insert(account);
        return decryptPassword(account);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public TestAccount updateAccount(Long id, AccountCreateDTO dto) {
        TestAccount existing = accountMapper.selectById(id);
        if (existing == null) {
            throw new BusinessException(404, "账号不存在");
        }

        TestAccount account = new TestAccount();
        account.setId(id);
        if (dto.getAccountName() != null) account.setAccountName(dto.getAccountName());
        if (dto.getSystemName() != null) account.setSystemName(dto.getSystemName());
        if (dto.getUsername() != null) account.setUsername(dto.getUsername());
        if (dto.getPassword() != null) {
            account.setPassword(AESUtil.encrypt(dto.getPassword(), aesKey));
        }
        if (dto.getAuthType() != null) account.setAuthType(dto.getAuthType());
        if (dto.getAuthConfig() != null) account.setAuthConfig(dto.getAuthConfig());

        accountMapper.update(account);
        return decryptPassword(accountMapper.selectById(id));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteAccount(Long id) {
        TestAccount existing = accountMapper.selectById(id);
        if (existing == null) {
            throw new BusinessException(404, "账号不存在");
        }
        accountMapper.deleteById(id);
    }

    @Override
    public TestAccount getAccount(Long id) {
        TestAccount account = accountMapper.selectById(id);
        if (account == null) {
            throw new BusinessException(404, "账号不存在");
        }
        return decryptPassword(account);
    }

    @Override
    public List<TestAccount> listAccounts(String systemName, Integer status, int offset, int pageSize) {
        List<TestAccount> accounts = accountMapper.selectList(systemName, status, offset, pageSize);
        // 返回时解密密码
        accounts.forEach(this::decryptPassword);
        return accounts;
    }

    @Override
    public int countAccounts(String systemName, Integer status) {
        return accountMapper.countList(systemName, status);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public TestAccount acquireAccount(String accountCode) {
        TestAccount available = accountMapper.selectAvailableByCode(accountCode);
        if (available == null) {
            throw new BusinessException(409, "账号不可用: " + accountCode);
        }

        // 锁定30分钟
        Date lockUntil = new Date(System.currentTimeMillis() + 30 * 60 * 1000);
        int updated = accountMapper.lockAccount(accountCode, lockUntil);
        if (updated == 0) {
            throw new BusinessException(409, "账号已被占用: " + accountCode);
        }

        TestAccount account = accountMapper.selectByAccountCode(accountCode);
        return decryptPassword(account);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void releaseAccount(String accountCode) {
        accountMapper.releaseAccount(accountCode);
        log.info("[Account] 释放账号: {}", accountCode);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void batchLock(String accountCode, int minutes) {
        Date lockUntil = new Date(System.currentTimeMillis() + minutes * 60L * 1000);
        int updated = accountMapper.lockAccount(accountCode, lockUntil);
        if (updated == 0) {
            throw new BusinessException(409, "账号不可用: " + accountCode);
        }
        log.info("[Account] 批量锁定账号: {}, 时长: {}分钟", accountCode, minutes);
    }

    /**
     * 解密密码
     */
    private TestAccount decryptPassword(TestAccount account) {
        if (account != null && account.getPassword() != null) {
            try {
                account.setPassword(AESUtil.decrypt(account.getPassword(), aesKey));
            } catch (Exception e) {
                log.warn("[Account] 密码解密失败 accountCode: {}", account.getAccountCode());
            }
        }
        return account;
    }
}