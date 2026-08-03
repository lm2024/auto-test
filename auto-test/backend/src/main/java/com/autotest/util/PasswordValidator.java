package com.autotest.util;

import java.util.regex.Pattern;

/**
 * 密码强度验证工具类
 */
public class PasswordValidator {
    
    // 密码最小长度
    private static final int MIN_LENGTH = 8;
    
    // 密码最大长度
    private static final int MAX_LENGTH = 32;
    
    // 正则表达式：至少包含一个大写字母
    private static final Pattern UPPERCASE_PATTERN = Pattern.compile("[A-Z]");
    
    // 正则表达式：至少包含一个小写字母
    private static final Pattern LOWERCASE_PATTERN = Pattern.compile("[a-z]");
    
    // 正则表达式：至少包含一个数字
    private static final Pattern DIGIT_PATTERN = Pattern.compile("[0-9]");
    
    // 正则表达式：至少包含一个特殊字符
    private static final Pattern SPECIAL_CHAR_PATTERN = Pattern.compile("[!@#$%^&*()_+\\-=\\[\\]{};':\"\\\\|,.<>/?`~]");
    
    // 正则表达式：不允许包含空格
    private static final Pattern NO_SPACE_PATTERN = Pattern.compile("^\\S+$");
    
    // 常见弱密码列表
    private static final String[] WEAK_PASSWORDS = {
        "password", "123456", "12345678", "qwerty", "abc123", 
        "password1", "admin", "admin123", "letmein", "welcome",
        "monkey", "master", "dragon", "login", "princess",
        "football", "shadow", "sunshine", "trustno1", "iloveyou"
    };
    
    /**
     * 密码强度验证结果
     */
    public static class PasswordStrengthResult {
        private boolean valid;
        private String message;
        private int score; // 0-100
        
        public PasswordStrengthResult(boolean valid, String message, int score) {
            this.valid = valid;
            this.message = message;
            this.score = score;
        }
        
        public boolean isValid() {
            return valid;
        }
        
        public String getMessage() {
            return message;
        }
        
        public int getScore() {
            return score;
        }
    }
    
    /**
     * 验证密码强度
     * @param password 密码
     * @return 验证结果
     */
    public static PasswordStrengthResult validatePassword(String password) {
        if (password == null || password.isEmpty()) {
            return new PasswordStrengthResult(false, "密码不能为空", 0);
        }
        
        // 检查长度
        if (password.length() < MIN_LENGTH) {
            return new PasswordStrengthResult(false, "密码长度不能少于" + MIN_LENGTH + "个字符", 0);
        }
        
        if (password.length() > MAX_LENGTH) {
            return new PasswordStrengthResult(false, "密码长度不能超过" + MAX_LENGTH + "个字符", 0);
        }
        
        // 检查是否包含空格
        if (!NO_SPACE_PATTERN.matcher(password).matches()) {
            return new PasswordStrengthResult(false, "密码不能包含空格", 0);
        }
        
        // 检查是否是常见弱密码
        String lowerPassword = password.toLowerCase();
        for (String weakPassword : WEAK_PASSWORDS) {
            if (lowerPassword.equals(weakPassword)) {
                return new PasswordStrengthResult(false, "密码过于简单，请选择更复杂的密码", 0);
            }
        }
        
        // 计算密码强度分数
        int score = calculatePasswordStrength(password);
        
        // 检查基本要求
        boolean hasUppercase = UPPERCASE_PATTERN.matcher(password).find();
        boolean hasLowercase = LOWERCASE_PATTERN.matcher(password).find();
        boolean hasDigit = DIGIT_PATTERN.matcher(password).find();
        boolean hasSpecialChar = SPECIAL_CHAR_PATTERN.matcher(password).find();
        
        // 强密码要求：至少包含大写字母、小写字母、数字和特殊字符中的3种
        int categoryCount = 0;
        if (hasUppercase) categoryCount++;
        if (hasLowercase) categoryCount++;
        if (hasDigit) categoryCount++;
        if (hasSpecialChar) categoryCount++;
        
        if (categoryCount < 3) {
            return new PasswordStrengthResult(false, 
                "密码必须包含大写字母、小写字母、数字和特殊字符中的至少3种", score);
        }
        
        // 检查是否包含连续字符或重复字符
        if (hasConsecutiveChars(password) || hasRepeatedChars(password)) {
            return new PasswordStrengthResult(false, 
                "密码不能包含连续字符（如123、abc）或重复字符（如aaa）", score);
        }
        
        // 根据分数判断强度
        String strengthMessage;
        if (score < 40) {
            strengthMessage = "密码强度较弱";
        } else if (score < 70) {
            strengthMessage = "密码强度中等";
        } else {
            strengthMessage = "密码强度较强";
        }
        
        return new PasswordStrengthResult(true, strengthMessage, score);
    }
    
    /**
     * 计算密码强度分数
     * @param password 密码
     * @return 分数 (0-100)
     */
    private static int calculatePasswordStrength(String password) {
        int score = 0;
        
        // 长度分数
        score += Math.min(password.length() * 4, 40);
        
        // 字符类型分数
        if (UPPERCASE_PATTERN.matcher(password).find()) score += 10;
        if (LOWERCASE_PATTERN.matcher(password).find()) score += 10;
        if (DIGIT_PATTERN.matcher(password).find()) score += 10;
        if (SPECIAL_CHAR_PATTERN.matcher(password).find()) score += 15;
        
        // 多样性分数
        int uniqueChars = countUniqueChars(password);
        score += Math.min(uniqueChars * 2, 20);
        
        // 长度奖励
        if (password.length() >= 12) score += 10;
        if (password.length() >= 16) score += 5;
        
        return Math.min(score, 100);
    }
    
    /**
     * 统计唯一字符数量
     * @param password 密码
     * @return 唯一字符数量
     */
    private static int countUniqueChars(String password) {
        java.util.Set<Character> uniqueChars = new java.util.HashSet<>();
        for (char c : password.toCharArray()) {
            uniqueChars.add(c);
        }
        return uniqueChars.size();
    }
    
    /**
     * 检查是否包含连续字符
     * @param password 密码
     * @return 是否包含连续字符
     */
    private static boolean hasConsecutiveChars(String password) {
        for (int i = 0; i < password.length() - 2; i++) {
            char c1 = password.charAt(i);
            char c2 = password.charAt(i + 1);
            char c3 = password.charAt(i + 2);
            
            // 检查连续数字
            if (Character.isDigit(c1) && Character.isDigit(c2) && Character.isDigit(c3)) {
                if (c2 - c1 == 1 && c3 - c2 == 1) {
                    return true;
                }
                if (c1 - c2 == 1 && c2 - c3 == 1) {
                    return true;
                }
            }
            
            // 检查连续字母
            if (Character.isLetter(c1) && Character.isLetter(c2) && Character.isLetter(c3)) {
                if (c2 - c1 == 1 && c3 - c2 == 1) {
                    return true;
                }
                if (c1 - c2 == 1 && c2 - c3 == 1) {
                    return true;
                }
            }
        }
        return false;
    }
    
    /**
     * 检查是否包含重复字符
     * @param password 密码
     * @return 是否包含重复字符
     */
    private static boolean hasRepeatedChars(String password) {
        for (int i = 0; i < password.length() - 2; i++) {
            char c1 = password.charAt(i);
            char c2 = password.charAt(i + 1);
            char c3 = password.charAt(i + 2);
            
            if (c1 == c2 && c2 == c3) {
                return true;
            }
        }
        return false;
    }
    
    /**
     * 快速验证密码是否有效
     * @param password 密码
     * @return 是否有效
     */
    public static boolean isValidPassword(String password) {
        return validatePassword(password).isValid();
    }
    
    /**
     * 获取密码强度描述
     * @param password 密码
     * @return 强度描述
     */
    public static String getPasswordStrengthDescription(String password) {
        return validatePassword(password).getMessage();
    }
}