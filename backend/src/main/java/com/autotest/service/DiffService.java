package com.autotest.service;

import com.autotest.model.entity.NodeSnapshot;
import com.autotest.model.vo.DiffVO;

import java.util.List;

public interface DiffService {
    DiffVO computeDiff(String chainCode, int currentVersion, int compareVersion);
    DiffVO computeDiffFromSnapshots(List<NodeSnapshot> current, List<NodeSnapshot> previous, String chainCode, int currentVersion, int compareVersion);
}
