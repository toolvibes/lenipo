from enum import StrEnum

class PermissionGrantee(StrEnum):
    ASSIGNEE = "assignee"
    GROUP = "group"
    REPORTER = "reporter"
    ROLE = "role"
    USER = "user"

    def __str__(self) -> str:
        return str(self.value)
