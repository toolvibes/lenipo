from enum import StrEnum

class PermissionGrantInputType3Grantee(StrEnum):
    ASSIGNEE = "assignee"
    REPORTER = "reporter"

    def __str__(self) -> str:
        return str(self.value)
