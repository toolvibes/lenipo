from enum import StrEnum

class PermissionGrantInputType3Permission(StrEnum):
    ASSIGN_ISSUES = "assign-issues"
    COMMENT = "comment"
    DELETE_ISSUES = "delete-issues"
    EDIT_ISSUES = "edit-issues"
    TRANSITION_ISSUES = "transition-issues"

    def __str__(self) -> str:
        return str(self.value)
