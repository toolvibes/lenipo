from enum import StrEnum

class ProjectPermission(StrEnum):
    ADMINISTER = "administer"
    ASSIGN_ISSUES = "assign-issues"
    BROWSE = "browse"
    COMMENT = "comment"
    CREATE_ISSUES = "create-issues"
    DELETE_ISSUES = "delete-issues"
    EDIT_ISSUES = "edit-issues"
    SET_ISSUE_SECURITY = "set-issue-security"
    TRANSITION_ISSUES = "transition-issues"

    def __str__(self) -> str:
        return str(self.value)
