from enum import StrEnum

class SecurityGrantInputType3Grantee(StrEnum):
    ASSIGNEE = "assignee"
    REPORTER = "reporter"

    def __str__(self) -> str:
        return str(self.value)
