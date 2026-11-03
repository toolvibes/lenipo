from enum import StrEnum

class CreateSpaceRequestType(StrEnum):
    DOCUMENTATION = "documentation"
    PROJECT = "project"
    TEAM = "team"

    def __str__(self) -> str:
        return str(self.value)
