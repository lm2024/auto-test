package com.autotest.service.impl;

import com.autotest.context.TenantContext;
import com.autotest.mapper.TestAccountUsageMapper;
import com.autotest.model.entity.TestAccount;
import com.autotest.model.entity.TestAccountUsage;
import com.autotest.service.AccountUsageService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.Date;
import java.util.List;

@Service
public class AccountUsageServiceImpl implements AccountUsageService {
    @Autowired
    private TestAccountUsageMapper usageMapper;

    @Override
    public void start(TestAccount account, String executionId, Long taskId, String chainCode,
                      String dataPoolCode, String usageType, Long userId, String operatorName) {
        TestAccountUsage usage = new TestAccountUsage();
        usage.setAccountId(account.getId());
        usage.setAccountCode(account.getAccountCode());
        usage.setTenantId(TenantContext.getTenantId() != null ? TenantContext.getTenantId() : account.getTenantId());
        usage.setUserId(userId);
        usage.setOperatorName(operatorName);
        usage.setExecutionId(executionId);
        usage.setTaskId(taskId);
        usage.setChainCode(chainCode);
        usage.setDataPoolCode(dataPoolCode);
        usage.setUsageType(usageType);
        usage.setStatus("RUNNING");
        usage.setStartedAt(new Date());
        usageMapper.insert(usage);
    }

    @Override
    public void finish(String executionId, String status, String releaseReason) {
        if (executionId != null) usageMapper.finishByExecutionId(executionId, status, releaseReason);
    }

    @Override
    public List<TestAccountUsage> list(Long accountId, int pageNo, int pageSize) {
        int safePage = Math.max(pageNo, 1);
        int safeSize = Math.max(Math.min(pageSize, 100), 1);
        return usageMapper.selectByAccount(accountId, (safePage - 1) * safeSize, safeSize);
    }

    @Override
    public int count(Long accountId) { return usageMapper.countByAccount(accountId); }
}
