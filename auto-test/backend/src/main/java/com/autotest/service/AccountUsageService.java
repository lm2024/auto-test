package com.autotest.service;

import com.autotest.model.entity.TestAccount;
import com.autotest.model.entity.TestAccountUsage;

import java.util.List;

public interface AccountUsageService {
    void start(TestAccount account, String executionId, Long taskId, String chainCode,
               String dataPoolCode, String usageType, Long userId, String operatorName);
    void finish(String executionId, String status, String releaseReason);
    List<TestAccountUsage> list(Long accountId, int pageNo, int pageSize);
    int count(Long accountId);
}
