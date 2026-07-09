package com.autotest.util;

import java.util.concurrent.ThreadLocalRandom;

public class CodeGenerator {

    private CodeGenerator() {}

    public static String generateChainCode() {
        long timestamp = System.currentTimeMillis();
        String timePart = String.valueOf(timestamp).substring(5, 11);
        String randomPart = String.format("%04X", ThreadLocalRandom.current().nextInt(0x10000));
        return "CHAIN_" + timePart + randomPart;
    }

    public static String generateNodeCode(String chainCode, int index) {
        return "NODE_" + chainCode.replace("CHAIN_", "") + "_" + index;
    }

    public static String generateExecutionId() {
        long timestamp = System.currentTimeMillis();
        String timePart = String.valueOf(timestamp).substring(5, 11);
        String randomPart = String.format("%04X", ThreadLocalRandom.current().nextInt(0x10000));
        return "EXEC_" + timePart + randomPart;
    }
}
