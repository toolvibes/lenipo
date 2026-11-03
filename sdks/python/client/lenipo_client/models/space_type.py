from enum import StrEnum

class SpaceType(StrEnum):
    DOCUMENTATION = "documentation"
    PERSONAL = "personal"
    PROJECT = "project"
    TEAM = "team"

    def __str__(self) -> str:
        return str(self.value)
