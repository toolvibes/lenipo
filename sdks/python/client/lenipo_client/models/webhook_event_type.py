from enum import StrEnum

class WebhookEventType(StrEnum):
    COMMENT_CREATED = "comment.created"
    COMMENT_DELETED = "comment.deleted"
    COMMENT_UPDATED = "comment.updated"
    ISSUE_CREATED = "issue.created"
    ISSUE_DELETED = "issue.deleted"
    ISSUE_TRANSITIONED = "issue.transitioned"
    ISSUE_UPDATED = "issue.updated"
    PAGE_COMMENTED = "page.commented"
    PAGE_PUBLISHED = "page.published"
    SPRINT_COMPLETED = "sprint.completed"
    SPRINT_STARTED = "sprint.started"
    VERSION_RELEASED = "version.released"
    WORKLOG_CREATED = "worklog.created"
    WORKLOG_DELETED = "worklog.deleted"
    WORKLOG_UPDATED = "worklog.updated"

    def __str__(self) -> str:
        return str(self.value)
