-- Portal Operations：门户运营（总体设计 §5 门户运营）。
-- 公告单向流转：DRAFT → PUBLISHED → ARCHIVED（发布时落 published_at，归档后不再变更）；
-- 反馈 PENDING → HANDLED（处理说明必填），终态防重由服务层保证。
CREATE TABLE portal_notice (
    id VARCHAR(36) NOT NULL,
    code VARCHAR(40) NOT NULL,
    title VARCHAR(200) NOT NULL,
    content LONGTEXT NOT NULL,
    section VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL,
    published_at TIMESTAMP(6) NULL,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'default',
    created_at TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_portal_notice_code UNIQUE (code),
    INDEX idx_portal_notice_section (section, status, published_at)
);

CREATE TABLE portal_feedback (
    id VARCHAR(36) NOT NULL,
    code VARCHAR(40) NOT NULL,
    title VARCHAR(200) NOT NULL,
    content VARCHAR(2000) NOT NULL,
    contact VARCHAR(200) NULL,
    status VARCHAR(32) NOT NULL,
    handle_note VARCHAR(500) NULL,
    handled_at TIMESTAMP(6) NULL,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'default',
    created_at TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_portal_feedback_code UNIQUE (code),
    INDEX idx_portal_feedback_status (status, created_at)
);
