package com.autotest.service;

import com.autotest.model.dto.ReplayPushDTO;
import com.autotest.model.dto.VersionDeleteDTO;
import com.autotest.model.vo.DiffVO;
import com.autotest.model.vo.VersionVO;

import java.util.List;
import java.util.Map;

public interface VersionService {
    Map<String, Object> pushReplayResult(ReplayPushDTO dto);
    List<VersionVO> getVersions(String chainCode, boolean all);
    DiffVO getVersionDiff(String chainCode, int version);
    void deleteVersion(VersionDeleteDTO dto);
    void batchDeleteVersions(String chainCode, int beforeVersion);
}
