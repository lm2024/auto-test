package com.autotest.service;

import org.springframework.stereotype.Service;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 图形验证码服务。
 *
 * 设计要点：
 * 1. 不依赖 Redis / Session，使用进程内 ConcurrentHashMap 按 token 存储，
 *    单实例部署（docker / 本地）即可正常工作，部署简单。
 * 2. 每张验证码带过期时间，过期自动失效并清理；校验成功后立即失效（防重放）。
 * 3. 使用 JDK 自带的 BufferedImage 生成 PNG，无需额外依赖。
 */
@Service
public class CaptchaService {

    /** 图片宽高 */
    private static final int WIDTH = 130;
    private static final int HEIGHT = 44;
    /** 验证码有效时长（秒） */
    public static final int EXPIRE_SECONDS = 60;
    /** 字符集：去掉易混淆的 0/O/1/I/L */
    private static final String CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    private static final int CODE_LEN = 4;

    /** token -> 验证码信息 */
    private final Map<String, CaptchaInfo> store = new ConcurrentHashMap<>();

    private static class CaptchaInfo {
        final String code;
        final long expireAt; // 毫秒时间戳

        CaptchaInfo(String code, long expireAt) {
            this.code = code;
            this.expireAt = expireAt;
        }
    }

    /**
     * 生成一张新验证码。
     * @return 包含 token、image（data URL）、expireSeconds 的 Map
     */
    public synchronized Map<String, Object> generate() {
        // 顺手清理过期项，避免内存无限增长
        long now = System.currentTimeMillis();
        store.entrySet().removeIf(e -> e.getValue().expireAt < now);

        String token = UUID.randomUUID().toString().replace("-", "");
        String code = randomCode(CODE_LEN);
        store.put(token, new CaptchaInfo(code, now + EXPIRE_SECONDS * 1000L));

        Map<String, Object> data = new HashMap<>(4);
        data.put("token", token);
        data.put("image", "data:image/png;base64," + render(code));
        data.put("expireSeconds", EXPIRE_SECONDS);
        return data;
    }

    /**
     * 校验验证码：一次性、大小写不敏感、需未过期。
     * 无论成功失败，token 都会被消费掉，防止同一张码重复提交。
     */
    public boolean validate(String token, String input) {
        if (token == null || input == null || input.trim().isEmpty()) {
            return false;
        }
        CaptchaInfo info = store.remove(token);
        if (info == null) {
            return false; // 已用过或不存在
        }
        if (info.expireAt < System.currentTimeMillis()) {
            return false; // 已过期
        }
        return info.code.equalsIgnoreCase(input.trim());
    }

    /** 生成随机验证码字符串 */
    private String randomCode(int len) {
        StringBuilder sb = new StringBuilder(len);
        for (int i = 0; i < len; i++) {
            sb.append(CHARS.charAt((int) (Math.random() * CHARS.length())));
        }
        return sb.toString();
    }

    /** 将验证码渲染成 PNG 并返回 base64 */
    private String render(String code) {
        BufferedImage img = new BufferedImage(WIDTH, HEIGHT, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        // 抗锯齿，让字体更顺滑
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);

        // 背景
        g.setColor(new Color(243, 247, 250));
        g.fillRect(0, 0, WIDTH, HEIGHT);

        // 干扰线
        for (int i = 0; i < 5; i++) {
            g.setColor(new Color(
                    (int) (Math.random() * 150),
                    (int) (Math.random() * 150),
                    (int) (Math.random() * 150)));
            g.drawLine(
                    (int) (Math.random() * WIDTH), (int) (Math.random() * HEIGHT),
                    (int) (Math.random() * WIDTH), (int) (Math.random() * HEIGHT));
        }
        // 噪点
        for (int i = 0; i < 40; i++) {
            g.setColor(new Color(
                    (int) (Math.random() * 180),
                    (int) (Math.random() * 180),
                    (int) (Math.random() * 180)));
            g.fillRect((int) (Math.random() * WIDTH), (int) (Math.random() * HEIGHT), 1, 1);
        }

        // 字符（逐字旋转 + 抖动，增加机器识别难度）
        g.setFont(new Font("Consolas", Font.BOLD, 28));
        int step = WIDTH / (code.length() + 1);
        for (int i = 0; i < code.length(); i++) {
            int angle = (int) (Math.random() * 34 - 17);
            int x = step * (i + 1);
            int y = HEIGHT / 2 + 10 + (int) (Math.random() * 6 - 3);
            g.rotate(Math.toRadians(angle), x, y);
            // 主色取蓝绿色系，与前端主题一致
            g.setColor(new Color(40, 130, 116));
            g.drawString(String.valueOf(code.charAt(i)), x - 8, y);
            g.rotate(-Math.toRadians(angle), x, y);
        }

        g.dispose();
        try {
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            ImageIO.write(img, "PNG", baos);
            return Base64.getEncoder().encodeToString(baos.toByteArray());
        } catch (Exception e) {
            throw new RuntimeException("生成验证码图片失败", e);
        }
    }
}
