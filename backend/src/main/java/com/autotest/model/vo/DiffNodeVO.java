package com.autotest.model.vo;

import java.util.List;

public class DiffNodeVO {
    private String nodeCode;
    private String nodeName;
    private Integer sortNo;
    private String changeType;
    private NodeSnapshotData current;
    private NodeSnapshotData previous;
    private List<FieldChange> fieldChanges;

    public String getNodeCode() { return nodeCode; }
    public void setNodeCode(String nodeCode) { this.nodeCode = nodeCode; }
    public String getNodeName() { return nodeName; }
    public void setNodeName(String nodeName) { this.nodeName = nodeName; }
    public Integer getSortNo() { return sortNo; }
    public void setSortNo(Integer sortNo) { this.sortNo = sortNo; }
    public String getChangeType() { return changeType; }
    public void setChangeType(String changeType) { this.changeType = changeType; }
    public NodeSnapshotData getCurrent() { return current; }
    public void setCurrent(NodeSnapshotData current) { this.current = current; }
    public NodeSnapshotData getPrevious() { return previous; }
    public void setPrevious(NodeSnapshotData previous) { this.previous = previous; }
    public List<FieldChange> getFieldChanges() { return fieldChanges; }
    public void setFieldChanges(List<FieldChange> fieldChanges) { this.fieldChanges = fieldChanges; }

    public static class NodeSnapshotData {
        private String requestUrl;
        private String requestMethod;
        private String requestHeaders;
        private String bodyData;
        private Integer responseCode;
        private String responseBody;
        private Long durationMs;

        public String getRequestUrl() { return requestUrl; }
        public void setRequestUrl(String requestUrl) { this.requestUrl = requestUrl; }
        public String getRequestMethod() { return requestMethod; }
        public void setRequestMethod(String requestMethod) { this.requestMethod = requestMethod; }
        public String getRequestHeaders() { return requestHeaders; }
        public void setRequestHeaders(String requestHeaders) { this.requestHeaders = requestHeaders; }
        public String getBodyData() { return bodyData; }
        public void setBodyData(String bodyData) { this.bodyData = bodyData; }
        public Integer getResponseCode() { return responseCode; }
        public void setResponseCode(Integer responseCode) { this.responseCode = responseCode; }
        public String getResponseBody() { return responseBody; }
        public void setResponseBody(String responseBody) { this.responseBody = responseBody; }
        public Long getDurationMs() { return durationMs; }
        public void setDurationMs(Long durationMs) { this.durationMs = durationMs; }
    }

    public static class FieldChange {
        private String field;
        private String label;
        private String oldValue;
        private String newValue;

        public FieldChange() {}
        public FieldChange(String field, String label, String oldValue, String newValue) {
            this.field = field;
            this.label = label;
            this.oldValue = oldValue;
            this.newValue = newValue;
        }

        public String getField() { return field; }
        public void setField(String field) { this.field = field; }
        public String getLabel() { return label; }
        public void setLabel(String label) { this.label = label; }
        public String getOldValue() { return oldValue; }
        public void setOldValue(String oldValue) { this.oldValue = oldValue; }
        public String getNewValue() { return newValue; }
        public void setNewValue(String newValue) { this.newValue = newValue; }
    }
}
