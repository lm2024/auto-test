package com.autotest.mapper;

import com.autotest.model.entity.TestAccount;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.Date;
import java.util.List;

@Mapper
public interface TestAccountMapper {
    int insert(TestAccount account);
    int update(TestAccount account);
    int deleteById(@Param("id") Long id);
    TestAccount selectById(@Param("id") Long id);
    TestAccount selectByAccountCode(@Param("accountCode") String accountCode);
    List<TestAccount> selectList(@Param("systemName") String systemName, @Param("status") Integer status,
                                  @Param("offset") int offset, @Param("pageSize") int pageSize);
    int countList(@Param("systemName") String systemName, @Param("status") Integer status);

    /**
     * 锁定账号
     */
    int lockAccount(@Param("accountCode") String accountCode, @Param("lockUntil") Date lockUntil);

    /**
     * 释放账号
     */
    int releaseAccount(@Param("accountCode") String accountCode);

    /**
     * 查询可用的账号（status=1 且 lock_until 为 null 或已过期）
     */
    TestAccount selectAvailableByCode(@Param("accountCode") String accountCode);
}