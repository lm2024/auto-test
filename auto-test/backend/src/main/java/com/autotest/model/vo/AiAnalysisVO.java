package com.autotest.model.vo;

import java.util.List;

public class AiAnalysisVO {
    private String summary;
    private List<String> impacts;
    private List<String> suggestions;

    public String getSummary() { return summary; }
    public void setSummary(String summary) { this.summary = summary; }
    public List<String> getImpacts() { return impacts; }
    public void setImpacts(List<String> impacts) { this.impacts = impacts; }
    public List<String> getSuggestions() { return suggestions; }
    public void setSuggestions(List<String> suggestions) { this.suggestions = suggestions; }
}
